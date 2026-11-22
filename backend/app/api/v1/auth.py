import re
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_oauth_state,
    encrypt_secret,
    get_current_user,
    hash_password,
    verify_oauth_state,
    verify_password,
)
from app.models.challenge import Challenge, ChallengeMember
from app.models.user import User, UserIntegration
from app.schemas.auth import (
    AuthProvidersResponse,
    AuthResponse,
    IntegrationOut,
    LoginRequest,
    PasswordLoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_username(raw: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_.-]", "", raw.strip().lower())
    if len(cleaned) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username deve ter pelo menos 2 caracteres válidos (letras, números, _, ., -).",
        )
    return cleaned


async def _fetch_github_profile(github_username: str) -> tuple[str | None, str | None]:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"https://api.github.com/users/{github_username}",
                headers={"Accept": "application/vnd.github+json"},
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


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
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
    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=await _build_user_out(db, user))


@router.post("/password-login", response_model=AuthResponse)
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

    token = create_access_token(user.id)
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

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=await _build_user_out(db, user))


@router.get("/github/login")
async def github_oauth_login(request: Request) -> RedirectResponse:
    """Redirect the user to GitHub OAuth authorization page."""
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth não está configurado neste servidor.",
        )

    redirect_uri = str(request.url_for("github_oauth_callback"))
    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": redirect_uri,
            "scope": "read:user user:email repo",
            "state": create_oauth_state(),
        }
    )
    return RedirectResponse(url=f"https://github.com/login/oauth/authorize?{params}")


@router.get("/github/callback", name="github_oauth_callback")
async def github_oauth_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle GitHub OAuth callback, persist encrypted access token, and redirect with JWT."""
    verify_oauth_state(state)
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
            error_url = f"{settings.frontend_url}/?oauth_error=github_token_failed"
            return RedirectResponse(url=error_url)

        gh_headers = {
            "Authorization": f"Bearer {gh_access_token}",
            "Accept": "application/vnd.github+json",
        }
        profile_resp = await client.get("https://api.github.com/user", headers=gh_headers)
        if profile_resp.status_code != 200:
            return RedirectResponse(url=f"{settings.frontend_url}/?oauth_error=github_user_failed")
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

    user = await db.scalar(select(User).where(User.github_id == github_id))
    if user is None:
        user = await db.scalar(select(User).where(User.username == normalized))

    if user is None:
        user = User(
            github_id=github_id,
            username=normalized,
            display_name=gh_user.get("name") or gh_login,
            email=email,
            avatar_url=gh_user.get("avatar_url"),
            bio=gh_user.get("bio"),
        )
        db.add(user)
        await db.flush()
    else:
        user.github_id = github_id
        if gh_user.get("avatar_url"):
            user.avatar_url = gh_user["avatar_url"]
        if gh_user.get("bio") and not user.bio:
            user.bio = gh_user["bio"]
        if email and not user.email:
            user.email = email

    default_challenge_id = await _ensure_default_membership(db, user.id)
    await _upsert_integration(
        db,
        user_id=user.id,
        provider="github",
        external_username=gh_login,
        target_challenge_id=default_challenge_id,
        access_token_encrypted=encrypt_secret(gh_access_token),
    )

    await db.commit()
    await db.refresh(user)

    jwt_token = create_access_token(user.id)
    return RedirectResponse(url=f"{settings.frontend_url}/?token={jwt_token}")


@router.get("/me", response_model=UserOut)
async def read_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Return the authenticated user's profile and linked integrations."""
    return await _build_user_out(db, current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Update profile fields and GitHub/LeetCode integration settings."""
    if payload.display_name is not None:
        current_user.display_name = payload.display_name.strip()
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None

    if payload.github_username is not None and payload.github_username.strip():
        if not current_user.avatar_url:
            avatar_url, _ = await _fetch_github_profile(payload.github_username.strip())
            if avatar_url:
                current_user.avatar_url = avatar_url
        await _upsert_integration(
            db,
            user_id=current_user.id,
            provider="github",
            external_username=payload.github_username,
            target_challenge_id=payload.target_challenge_id,
        )

    if payload.leetcode_username is not None and payload.leetcode_username.strip():
        await _upsert_integration(
            db,
            user_id=current_user.id,
            provider="leetcode",
            external_username=payload.leetcode_username,
            target_challenge_id=payload.target_challenge_id,
        )

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
