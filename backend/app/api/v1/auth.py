import re
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.models.challenge import Challenge, ChallengeMember
from app.models.user import User, UserIntegration
from app.schemas.auth import (
    AuthResponse,
    IntegrationOut,
    LoginRequest,
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


async def _upsert_integration(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    provider: str,
    external_username: str,
    target_challenge_id: uuid.UUID | None,
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
            )
        )
    else:
        existing.external_username = cleaned
        if target_challenge_id is not None:
            existing.target_challenge_id = target_challenge_id


async def _build_user_out(db: AsyncSession, user: User) -> UserOut:
    integrations = (
        await db.scalars(select(UserIntegration).where(UserIntegration.user_id == user.id))
    ).all()
    return UserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        integrations=[
            IntegrationOut(
                provider=item.provider,  # type: ignore[arg-type]
                external_username=item.external_username,
                target_challenge_id=item.target_challenge_id,
                last_synced_at=item.last_synced_at,
            )
            for item in integrations
        ],
    )


@router.post("/login", response_model=AuthResponse)
async def login_or_register(
    payload: LoginRequest, db: AsyncSession = Depends(get_db)
) -> AuthResponse:
    """Passwordless MVP login/registration by username with optional GitHub/LeetCode linking."""
    username = _normalize_username(payload.username)
    user = await db.scalar(select(User).where(User.username == username))

    if user is None:
        display_name = (payload.display_name or payload.username).strip() or username
        user = User(username=username, display_name=display_name)
        db.add(user)
        await db.flush()
    elif payload.display_name and payload.display_name.strip():
        user.display_name = payload.display_name.strip()

    if payload.github_username and not user.avatar_url:
        avatar_url, bio = await _fetch_github_profile(payload.github_username.strip())
        if avatar_url:
            user.avatar_url = avatar_url
        if bio and not user.bio:
            user.bio = bio

    # Ensure user participates in at least one initial public challenge on first login.
    first_membership = await db.scalar(
        select(ChallengeMember.challenge_id).where(ChallengeMember.user_id == user.id).limit(1)
    )
    default_challenge_id = first_membership
    if default_challenge_id is None:
        first_public = await db.scalar(
            select(Challenge)
            .where(Challenge.visibility == "public")
            .order_by(Challenge.created_at.asc())
            .limit(1)
        )
        if first_public is not None:
            db.add(
                ChallengeMember(
                    challenge_id=first_public.id,
                    user_id=user.id,
                    role="member",
                )
            )
            default_challenge_id = first_public.id

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
    user_out = await _build_user_out(db, user)
    return AuthResponse(access_token=token, user=user_out)


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

    await db.commit()
    await db.refresh(current_user)
    return await _build_user_out(db, current_user)
