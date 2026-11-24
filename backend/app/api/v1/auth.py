import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.core.security import (
    create_access_token,
    create_oauth_state,
    encrypt_secret,
    get_current_user,
    hash_opaque_code,
    hash_password,
    is_valid_github_username,
    verify_oauth_state,
    verify_password,
)
from app.models.challenge import Challenge, ChallengeMember
from app.models.user import (
    MonitoredRepository,
    OAuthExchangeCode,
    User,
    UserBadge,
    UserIntegration,
)
from app.schemas.auth import (
    AuthProvidersResponse,
    AuthResponse,
    ChangePasswordRequest,
    GitHubOAuthLinkRequest,
    GitHubOAuthLinkResponse,
    IntegrationOut,
    LoginRequest,
    OAuthExchangeRequest,
    PasswordLoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserBadgeOut,
    UserOut,
)
from app.services.badges import BADGE_CATALOG, serialize_badge

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_username(raw: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_.-]", "", raw.strip().lower())
    if len(cleaned) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username deve ter pelo menos 2 caracteres válidos (letras, números, _, ., -).",
        )
    return cleaned


async def _find_available_username(db: AsyncSession, base: str) -> str:
    candidates = [base[:50], f"{base[:46]}_gh"]
    for candidate in candidates:
        exists = await db.scalar(select(User.id).where(User.username == candidate))
        if exists is None:
            return candidate
    for _ in range(10):
        candidate = f"{base[:43]}_{secrets.token_hex(3)}"
        exists = await db.scalar(select(User.id).where(User.username == candidate))
        if exists is None:
            return candidate
    return f"dev_{secrets.token_hex(6)}"


async def _fetch_github_profile(github_username: str) -> tuple[str | None, str | None]:
    cleaned = github_username.strip()
    if not is_valid_github_username(cleaned):
        return None, None
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"https://api.github.com/users/{cleaned}",
                headers={"Accept": "application/vnd.github+json", "User-Agent": "BrainRats/1.0"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("avatar_url"), data.get("bio")
    except Exception:
        pass
    return None, None


async def _ensure_default_membership(db: AsyncSession, user_id: uuid.UUID) -> uuid.UUID | None:
    first_membership = await db.scalar(
        select(ChallengeMember.challenge_id).where(ChallengeMember.user_id == user_id).limit(1)
    )
    if first_membership is not None:
        return first_membership

    first_public = await db.scalar(
        select(Challenge)
        .where(Challenge.visibility == "public")
        .order_by(Challenge.created_at.asc())
        .limit(1)
    )
    if first_public is None:
        return None
    db.add(ChallengeMember(challenge_id=first_public.id, user_id=user_id, role="member"))
    return first_public.id


async def _upsert_integration(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    provider: str,
    external_username: str,
    target_challenge_id: uuid.UUID | None,
    access_token_encrypted: str | None = None,
) -> None:
    cleaned = external_username.strip()
    if not cleaned:
        return
    if provider == "github" and not is_valid_github_username(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username do GitHub inválido (use apenas letras, números e hífens).",
        )
    existing = await db.scalar(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == provider,
        )
    )
    if existing is None:
        db.add(
            UserIntegration(
                user_id=user_id,
                provider=provider,
                external_username=cleaned,
                target_challenge_id=target_challenge_id,
                access_token_encrypted=access_token_encrypted,
            )
        )
    else:
        existing.external_username = cleaned
        if target_challenge_id is not None:
            existing.target_challenge_id = target_challenge_id
        if access_token_encrypted is not None:
            existing.access_token_encrypted = access_token_encrypted


async def _build_user_out(db: AsyncSession, user: User) -> UserOut:
    integrations = (
        await db.scalars(select(UserIntegration).where(UserIntegration.user_id == user.id))
    ).all()
    has_oauth = any(
        item.provider == "github" and bool(item.access_token_encrypted) for item in integrations
    )
    return UserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        bio=user.bio,
        last_challenge_id=user.last_challenge_id,
        has_github_oauth=has_oauth,
        has_password=bool(user.password_hash),
        is_public_profile=bool(user.is_public_profile),
        notify_streak_reminder=bool(user.notify_streak_reminder),
        notify_social=bool(user.notify_social),
        integrations=[
            IntegrationOut(
                provider=item.provider,  # type: ignore[arg-type]
                external_username=item.external_username,
                target_challenge_id=item.target_challenge_id,
                last_synced_at=item.last_synced_at,
                has_oauth_token=bool(item.access_token_encrypted),
            )
            for item in integrations
        ],
    )


@router.get("/providers", response_model=AuthProvidersResponse)
async def get_auth_providers() -> AuthProvidersResponse:
    """Expose which authentication methods are enabled in this environment."""
    github_enabled = bool(settings.github_client_id and settings.github_client_secret)
    return AuthProvidersResponse(
        github_oauth_enabled=github_enabled,
        password_auth_enabled=True,
        dev_login_enabled=settings.allow_dev_login,
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("auth_register", max_requests=20, window_seconds=300))],
)
async def register_with_password(
    payload: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """Create a password-protected account with optional GitHub/LeetCode usernames."""
    username = _normalize_username(payload.username)
    existing = await db.scalar(select(User).where(User.username == username))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"O username '@{username}' já está em uso.",
        )

    email = payload.email.strip().lower() if payload.email and payload.email.strip() else None
    if email is not None:
        email_taken = await db.scalar(select(User.id).where(User.email == email))
        if email_taken is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este e-mail já está cadastrado.",
            )

    display_name = (payload.display_name or payload.username).strip() or username
    user = User(
        username=username,
        display_name=display_name,
        email=email,
        password_hash=hash_password(payload.password),
    )
    if payload.github_username and payload.github_username.strip():
        avatar_url, bio = await _fetch_github_profile(payload.github_username.strip())
        if avatar_url:
            user.avatar_url = avatar_url
        if bio:
            user.bio = bio

    db.add(user)
    await db.flush()

    default_challenge_id = await _ensure_default_membership(db, user.id)
    if payload.github_username and payload.github_username.strip():
        await _upsert_integration(
            db,
            user_id=user.id,
            provider="github",
            external_username=payload.github_username,
            target_challenge_id=default_challenge_id,
        )
    if payload.leetcode_username and payload.leetcode_username.strip():
        await _upsert_integration(
            db,
            user_id=user.id,
            provider="leetcode",
            external_username=payload.leetcode_username,
            target_challenge_id=default_challenge_id,
        )

    await db.commit()
    await db.refresh(user)
    token = create_access_token(user.id, user.token_version)
    return AuthResponse(access_token=token, user=await _build_user_out(db, user))


@router.post(
    "/password-login",
    response_model=AuthResponse,
    dependencies=[Depends(rate_limit("auth_password_login", max_requests=15, window_seconds=300))],
)
async def login_with_password(
    payload: PasswordLoginRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """Authenticate an existing account using username and password."""
    username = _normalize_username(payload.username)
    user = await db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username ou senha incorretos.",
        )

    token = create_access_token(user.id, user.token_version)
    return AuthResponse(access_token=token, user=await _build_user_out(db, user))


@router.post("/login", response_model=AuthResponse)
async def login_or_register_dev(
    payload: LoginRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """Quick passwordless dev/demo login when ALLOW_DEV_LOGIN is enabled."""
    if not settings.allow_dev_login:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login rápido desativado. Use senha ou GitHub OAuth.",
        )

    username = _normalize_username(payload.username)
    user = await db.scalar(select(User).where(User.username == username))

    if user is None:
        display_name = (payload.display_name or payload.username).strip() or username
        user = User(username=username, display_name=display_name)
        db.add(user)
        await db.flush()
    elif user.password_hash is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esta conta possui senha. Entre usando sua senha ou GitHub.",
        )
    elif payload.display_name and payload.display_name.strip():
        user.display_name = payload.display_name.strip()

    if payload.github_username and not user.avatar_url:
        avatar_url, bio = await _fetch_github_profile(payload.github_username.strip())
        if avatar_url:
            user.avatar_url = avatar_url
        if bio and not user.bio:
            user.bio = bio

    default_challenge_id = await _ensure_default_membership(db, user.id)
    if payload.github_username and payload.github_username.strip():
        await _upsert_integration(
            db,
            user_id=user.id,
            provider="github",
            external_username=payload.github_username,
            target_challenge_id=default_challenge_id,
        )
    if payload.leetcode_username and payload.leetcode_username.strip():
        await _upsert_integration(
            db,
            user_id=user.id,
            provider="leetcode",
            external_username=payload.leetcode_username,
            target_challenge_id=default_challenge_id,
        )

    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.token_version)
    return AuthResponse(access_token=token, user=await _build_user_out(db, user))


def _build_github_authorize_url(
    request: Request,
    *,
    link_user_id: uuid.UUID | None = None,
    redirect_tab: str | None = None,
    include_private_repos: bool = False,
) -> str:
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth não está configurado neste servidor.",
        )

    redirect_uri = str(request.url_for("github_oauth_callback"))
    scope = "read:user user:email repo" if include_private_repos else "read:user user:email"
    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": redirect_uri,
            "scope": scope,
            "state": create_oauth_state(link_user_id=link_user_id, redirect_tab=redirect_tab),
        }
    )
    return f"https://github.com/login/oauth/authorize?{params}"


async def _delete_user_integration(
    db: AsyncSession, *, user_id: uuid.UUID, provider: Literal["github", "leetcode"]
) -> None:
    await db.execute(
        delete(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == provider,
        )
    )
    if provider == "github":
        await db.execute(delete(MonitoredRepository).where(MonitoredRepository.user_id == user_id))


@router.get("/github/login")
async def github_oauth_login(request: Request) -> RedirectResponse:
    """Redirect the user to GitHub OAuth authorization page with minimal login scope."""
    return RedirectResponse(url=_build_github_authorize_url(request, include_private_repos=False))


@router.post("/github/link", response_model=GitHubOAuthLinkResponse)
async def github_oauth_link_url(
    request: Request,
    payload: GitHubOAuthLinkRequest | None = None,
    current_user: User = Depends(get_current_user),
) -> GitHubOAuthLinkResponse:
    """Build a GitHub OAuth URL that links GitHub to the authenticated account."""
    redirect_tab = payload.redirect_tab if payload is not None else "integrations"
    include_private = payload.include_private_repos if payload is not None else False
    return GitHubOAuthLinkResponse(
        url=_build_github_authorize_url(
            request,
            link_user_id=current_user.id,
            redirect_tab=redirect_tab,
            include_private_repos=include_private,
        )
    )


@router.get("/github/callback", name="github_oauth_callback")
async def github_oauth_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle GitHub OAuth callback, persist encrypted token, and redirect with a one-time code."""
    state_payload = verify_oauth_state(state)
    link_user_raw = state_payload.get("link_user_id")
    redirect_tab = str(state_payload.get("redirect_tab") or "").strip()
    tab_suffix = f"&tab={redirect_tab}" if redirect_tab in ("integrations", "settings") else ""

    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth não está configurado neste servidor.",
        )

    redirect_uri = str(request.url_for("github_oauth_callback"))
    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        token_data = token_resp.json()
        gh_access_token = token_data.get("access_token")
        if not gh_access_token:
            error_url = f"{settings.frontend_url}/?oauth_error=github_token_failed{tab_suffix}"
            return RedirectResponse(url=error_url)

        gh_headers = {
            "Authorization": f"Bearer {gh_access_token}",
            "Accept": "application/vnd.github+json",
        }
        profile_resp = await client.get("https://api.github.com/user", headers=gh_headers)
        if profile_resp.status_code != 200:
            return RedirectResponse(
                url=f"{settings.frontend_url}/?oauth_error=github_user_failed{tab_suffix}"
            )
        gh_user = profile_resp.json()

        email = gh_user.get("email")
        if not email:
            emails_resp = await client.get("https://api.github.com/user/emails", headers=gh_headers)
            if emails_resp.status_code == 200:
                primary = next(
                    (e for e in emails_resp.json() if e.get("primary") and e.get("verified")),
                    None,
                )
                if primary:
                    email = primary.get("email")

    github_id = int(gh_user["id"])
    gh_login = str(gh_user["login"])
    normalized = _normalize_username(gh_login)

    if link_user_raw:
        try:
            link_user_uuid = uuid.UUID(str(link_user_raw))
        except ValueError:
            return RedirectResponse(
                url=f"{settings.frontend_url}/?oauth_error=github_user_failed{tab_suffix}"
            )
        user = await db.scalar(select(User).where(User.id == link_user_uuid))
        if user is None:
            return RedirectResponse(
                url=f"{settings.frontend_url}/?oauth_error=github_user_failed{tab_suffix}"
            )
        conflict = await db.scalar(
            select(User.id).where(User.github_id == github_id, User.id != user.id)
        )
        if conflict is not None:
            return RedirectResponse(
                url=f"{settings.frontend_url}/?oauth_error=github_already_linked{tab_suffix}"
            )
        user.github_id = github_id
        if gh_user.get("avatar_url") and not user.avatar_url:
            user.avatar_url = gh_user["avatar_url"]
        if gh_user.get("bio") and not user.bio:
            user.bio = gh_user["bio"]
        if email and not user.email:
            email_taken = await db.scalar(
                select(User.id).where(User.email == email.lower(), User.id != user.id)
            )
            if email_taken is None:
                user.email = email.lower()
    else:
        # Never auto-merge by username collision (prevents account takeover).
        user = await db.scalar(select(User).where(User.github_id == github_id))
        if user is None:
            available_username = await _find_available_username(db, normalized)
            safe_email = email.lower() if email else None
            if safe_email is not None:
                email_taken = await db.scalar(select(User.id).where(User.email == safe_email))
                if email_taken is not None:
                    safe_email = None
            user = User(
                github_id=github_id,
                username=available_username,
                display_name=gh_user.get("name") or gh_login,
                email=safe_email,
                avatar_url=gh_user.get("avatar_url"),
                bio=gh_user.get("bio"),
            )
            db.add(user)
            await db.flush()
        else:
            if gh_user.get("avatar_url"):
                user.avatar_url = gh_user["avatar_url"]
            if gh_user.get("bio") and not user.bio:
                user.bio = gh_user["bio"]

    default_challenge_id = await _ensure_default_membership(db, user.id)
    await _upsert_integration(
        db,
        user_id=user.id,
        provider="github",
        external_username=gh_login,
        target_challenge_id=default_challenge_id,
        access_token_encrypted=encrypt_secret(gh_access_token),
    )

    raw_code = secrets.token_urlsafe(32)
    db.add(
        OAuthExchangeCode(
            code_hash=hash_opaque_code(raw_code),
            user_id=user.id,
            expires_at=datetime.now(UTC) + timedelta(seconds=60),
        )
    )
    await db.commit()

    linked_suffix = "&oauth_linked=1" if link_user_raw else ""
    return RedirectResponse(
        url=f"{settings.frontend_url}/?oauth_code={raw_code}{tab_suffix}{linked_suffix}"
    )


@router.post("/oauth/exchange", response_model=AuthResponse)
async def exchange_oauth_code(
    payload: OAuthExchangeRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """Exchange a short-lived single-use OAuth code for a Bearer JWT."""
    code_hash = hash_opaque_code(payload.code.strip())
    record = await db.scalar(
        select(OAuthExchangeCode).where(OAuthExchangeCode.code_hash == code_hash)
    )
    now = datetime.now(UTC)
    if record is None or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código OAuth inválido ou já utilizado.",
        )
    expires = record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código OAuth expirado. Tente entrar novamente.",
        )

    record.used_at = now
    user = await db.scalar(select(User).where(User.id == record.user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )
    await db.commit()
    token = create_access_token(user.id, user.token_version)
    return AuthResponse(access_token=token, user=await _build_user_out(db, user))


@router.get("/me", response_model=UserOut)
async def read_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Return the authenticated user's profile and linked integrations."""
    return await _build_user_out(db, current_user)


@router.get("/me/badges", response_model=list[UserBadgeOut])
async def list_my_badges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserBadgeOut]:
    """Return all achievement badges unlocked by the authenticated user."""
    badges = (
        await db.scalars(
            select(UserBadge)
            .where(UserBadge.user_id == current_user.id)
            .order_by(UserBadge.unlocked_at.desc())
        )
    ).all()
    return [serialize_badge(b) for b in badges]


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Update profile fields, privacy/notification preferences, and integration settings."""
    if payload.display_name is not None:
        current_user.display_name = payload.display_name.strip()
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None
    if payload.use_github_avatar:
        gh_integration = await db.scalar(
            select(UserIntegration).where(
                UserIntegration.user_id == current_user.id,
                UserIntegration.provider == "github",
            )
        )
        if gh_integration is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conecte sua conta do GitHub antes de usar a foto do GitHub.",
            )
        gh_avatar, _ = await _fetch_github_profile(gh_integration.external_username)
        current_user.avatar_url = (
            gh_avatar or f"https://github.com/{gh_integration.external_username}.png"
        )
    elif payload.avatar_url is not None:
        cleaned_avatar = payload.avatar_url.strip() or None
        if cleaned_avatar and cleaned_avatar.startswith("/badges/"):
            badge_key = re.sub(
                r"\.(?:png|jpg|webp)$", "", cleaned_avatar.removeprefix("/badges/")
            )
            unlocked = None
            if badge_key in BADGE_CATALOG:
                unlocked = await db.scalar(
                    select(UserBadge.id).where(
                        UserBadge.user_id == current_user.id,
                        UserBadge.badge_key == badge_key,
                    )
                )
            if unlocked is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Você só pode usar como foto uma conquista que já desbloqueou.",
                )
        current_user.avatar_url = cleaned_avatar
    if payload.is_public_profile is not None:
        current_user.is_public_profile = payload.is_public_profile
    if payload.notify_streak_reminder is not None:
        current_user.notify_streak_reminder = payload.notify_streak_reminder
    if payload.notify_social is not None:
        current_user.notify_social = payload.notify_social

    if payload.target_challenge_id is not None:
        is_member = await db.scalar(
            select(ChallengeMember.id).where(
                ChallengeMember.challenge_id == payload.target_challenge_id,
                ChallengeMember.user_id == current_user.id,
            )
        )
        if is_member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Escolha um desafio do qual você participa para sincronização.",
            )

    if payload.github_username is not None:
        cleaned_gh = payload.github_username.strip()
        if cleaned_gh:
            if not current_user.avatar_url:
                avatar_url, _ = await _fetch_github_profile(cleaned_gh)
                if avatar_url:
                    current_user.avatar_url = avatar_url
            await _upsert_integration(
                db,
                user_id=current_user.id,
                provider="github",
                external_username=cleaned_gh,
                target_challenge_id=payload.target_challenge_id,
            )
        else:
            await _delete_user_integration(db, user_id=current_user.id, provider="github")

    if payload.leetcode_username is not None:
        cleaned_lc = payload.leetcode_username.strip()
        if cleaned_lc:
            await _upsert_integration(
                db,
                user_id=current_user.id,
                provider="leetcode",
                external_username=cleaned_lc,
                target_challenge_id=payload.target_challenge_id,
            )
        else:
            await _delete_user_integration(db, user_id=current_user.id, provider="leetcode")

    if payload.target_challenge_id is not None:
        integrations = (
            await db.scalars(
                select(UserIntegration).where(UserIntegration.user_id == current_user.id)
            )
        ).all()
        for item in integrations:
            item.target_challenge_id = payload.target_challenge_id

    if payload.last_challenge_id is not None:
        challenge = await db.scalar(
            select(Challenge).where(Challenge.id == payload.last_challenge_id)
        )
        if challenge is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Desafio não encontrado.",
            )
        if challenge.visibility != "public":
            is_member = await db.scalar(
                select(ChallengeMember.id).where(
                    ChallengeMember.challenge_id == challenge.id,
                    ChallengeMember.user_id == current_user.id,
                )
            )
            if is_member is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Você não participa deste desafio.",
                )
        current_user.last_challenge_id = challenge.id

    await db.commit()
    await db.refresh(current_user)
    return await _build_user_out(db, current_user)


@router.post("/change-password", response_model=AuthResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Change or set an account password and revoke all previously issued tokens."""
    if current_user.password_hash is not None:
        if not payload.current_password or not verify_password(
            payload.current_password, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Senha atual incorreta.",
            )
    current_user.password_hash = hash_password(payload.new_password)
    current_user.token_version = (current_user.token_version or 0) + 1
    await db.commit()
    await db.refresh(current_user)
    token = create_access_token(current_user.id, current_user.token_version)
    return AuthResponse(access_token=token, user=await _build_user_out(db, current_user))


@router.post("/logout-all", status_code=status.HTTP_200_OK)
async def logout_all_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Revoke all active JWT tokens for the authenticated user."""
    current_user.token_version = (current_user.token_version or 0) + 1
    await db.commit()
    return {"detail": "Todas as sessões foram encerradas."}


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete the authenticated user's account and transfer or remove owned challenges."""
    owned_challenges = (
        await db.scalars(select(Challenge).where(Challenge.created_by == current_user.id))
    ).all()
    for ch in owned_challenges:
        other_member = await db.scalar(
            select(ChallengeMember)
            .where(
                ChallengeMember.challenge_id == ch.id,
                ChallengeMember.user_id != current_user.id,
            )
            .order_by(ChallengeMember.role.asc(), ChallengeMember.joined_at.asc())
            .limit(1)
        )
        if other_member is not None:
            other_member.role = "admin"
            ch.created_by = other_member.user_id
        else:
            await db.delete(ch)

    await db.flush()
    await db.delete(current_user)
    await db.commit()
    return {"detail": "Conta excluída com sucesso."}


@router.delete("/me/integrations/{provider}", response_model=UserOut)
async def disconnect_integration(
    provider: Literal["github", "leetcode"],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Disconnect a GitHub or LeetCode integration from the authenticated user."""
    await _delete_user_integration(db, user_id=current_user.id, provider=provider)
    await db.commit()
    await db.refresh(current_user)
    return await _build_user_out(db, current_user)


# Keep helper available for tests/callers inspecting member counts.
_ = func
