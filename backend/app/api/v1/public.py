import html
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.challenge import Category
from app.models.checkin import CheckIn
from app.models.user import User, UserBadge
from app.schemas.auth import UserBadgeOut
from app.schemas.checkin import DiaryHeatmapDay
from app.services.badges import serialize_badge

router = APIRouter(prefix="/public", tags=["public"])


class PublicProfileOut(BaseModel):
    username: str
    display_name: str
    avatar_url: str | None
    bio: str | None
    is_public_profile: bool = True
    total_studies: int
    total_active_days: int
    current_streak: int
    longest_streak: int
    by_category: dict[str, int] = Field(default_factory=dict)
    badges: list[UserBadgeOut] = Field(default_factory=list)
    heatmap: list[DiaryHeatmapDay] = Field(default_factory=list)


def _compute_streaks(active_dates: set[date], today: date) -> tuple[int, int]:
    if not active_dates:
        return 0, 0
    cursor = today if today in active_dates else (today - timedelta(days=1))
    current = 0
    while cursor in active_dates:
        current += 1
        cursor -= timedelta(days=1)
    ordered = sorted(active_dates)
    longest = 1
    run = 1
    for idx in range(1, len(ordered)):
        if ordered[idx] == ordered[idx - 1] + timedelta(days=1):
            run += 1
            if run > longest:
                longest = run
        else:
            run = 1
    return current, longest


async def _load_public_user_stats(
    db: AsyncSession, username: str, *, allow_private: bool = False
) -> PublicProfileOut:
    user = await db.scalar(select(User).where(User.username == username.strip().lower()))
    if user is None or (not allow_private and not user.is_public_profile):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil público não encontrado.",
        )

    rows = (
        await db.execute(
            select(CheckIn.study_date, Category.slug, CheckIn.source, CheckIn.external_event_id)
            .join(Category, Category.id == CheckIn.category_id)
            .where(CheckIn.user_id == user.id, CheckIn.status == "valid")
        )
    ).all()

    seen_ext: set[tuple[str, str]] = set()
    by_day: dict[date, Counter[str]] = defaultdict(Counter)
    by_category: Counter[str] = Counter()
    total_studies = 0
    for sdate, cat_slug, source, ext_id in rows:
        if ext_id:
            key = (source, ext_id)
            if key in seen_ext:
                continue
            seen_ext.add(key)
        total_studies += 1
        by_day[sdate][cat_slug] += 1
        by_category[cat_slug] += 1

    today = datetime.now(UTC).date()
    since_16w = today - timedelta(days=112)
    heatmap = [
        DiaryHeatmapDay(
            study_date=d,
            count=sum(cnt.values()),
            top_category=cnt.most_common(1)[0][0] if cnt else None,
        )
        for d, cnt in sorted(by_day.items())
        if d >= since_16w
    ]
    current_streak, longest_streak = _compute_streaks(set(by_day.keys()), today)

    badges = (
        await db.scalars(
            select(UserBadge)
            .where(UserBadge.user_id == user.id)
            .order_by(UserBadge.unlocked_at.desc())
        )
    ).all()

    return PublicProfileOut(
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        is_public_profile=bool(user.is_public_profile),
        total_studies=total_studies,
        total_active_days=len(by_day),
        current_streak=current_streak,
        longest_streak=longest_streak,
        by_category=dict(by_category),
        badges=[serialize_badge(b) for b in badges],
        heatmap=heatmap,
    )


@router.get("/users/{username}", response_model=PublicProfileOut)
async def get_public_user_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> PublicProfileOut:
    """Return an opt-in public developer study consistency profile (no private data)."""
    return await _load_public_user_stats(db, username)


@router.get("/users/{username}/badge.svg")
async def get_public_user_badge_svg(
    username: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Render an embeddable BrainRats consistency SVG badge for GitHub READMEs."""
    stats = await _load_public_user_stats(db, username)
    safe_name = html.escape(f"@{stats.username}")
    streak_text = html.escape(f"{stats.current_streak}d ofensiva")
    studies_text = html.escape(f"{stats.total_studies} estudos")

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="380" height="84" '
        'viewBox="0 0 380 84" role="img" aria-label="BrainRats stats">'
        '<rect width="380" height="84" rx="14" fill="#111827"/>'
        '<rect x="1" y="1" width="378" height="82" rx="13" fill="none" stroke="#2c3649"/>'
        '<rect x="14" y="14" width="6" height="56" rx="3" fill="#F4511E"/>'
        '<text x="32" y="34" fill="#F3F4F7" font-family="system-ui,sans-serif" '
        'font-size="14" font-weight="800">Brain<tspan fill="#F4511E">Rats</tspan> · '
        f"{safe_name}</text>"
        '<text x="32" y="60" fill="#FBBF24" font-family="ui-monospace,monospace" '
        f'font-size="13" font-weight="700">{streak_text}</text>'
        '<text x="175" y="60" fill="#34D399" font-family="ui-monospace,monospace" '
        f'font-size="13" font-weight="700">{studies_text}</text>'
        "</svg>"
    )
    return Response(
        content=svg,
        media_type="image/svg+xml; charset=utf-8",
        headers={
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )
