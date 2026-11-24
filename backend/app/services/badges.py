import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Category, Challenge, RestDay
from app.models.checkin import CheckIn
from app.models.user import UserBadge
from app.schemas.auth import UserBadgeOut
from app.services.scoring import calculate_streak, compute_study_date

BADGE_CATALOG: dict[str, dict[str, str]] = {
    "first_checkin": {
        "title": "Primeiro Passo",
        "description": "Publicou seu primeiro estudo válido no BrainRats.",
        "icon": "sparkles",
    },
    "streak_7": {
        "title": "Semana em Chamas",
        "description": "Alcançou 7 dias consecutivos de ofensiva em um desafio.",
        "icon": "flame",
    },
    "streak_30": {
        "title": "Constância de Ferro",
        "description": "Alcançou 30 dias consecutivos de ofensiva em um desafio.",
        "icon": "trophy",
    },
    "polymath_week": {
        "title": "Polímata",
        "description": "Estudou todas as 5 categorias em uma mesma semana.",
        "icon": "layers",
    },
    "first_hard_lc": {
        "title": "Domador de Hard",
        "description": "Resolveu e registrou um problema Hard no LeetCode.",
        "icon": "code",
    },
    "bookworm_100p": {
        "title": "Leitor Técnico",
        "description": "Acumulou 100 ou mais páginas lidas em livros técnicos.",
        "icon": "book",
    },
    "night_owl": {
        "title": "Coruja de Código",
        "description": "Registrou um estudo entre 00h e 05h no fuso do desafio.",
        "icon": "moon",
    },
    "week_warrior": {
        "title": "Semana Perfeita",
        "description": "Estudou em pelo menos 5 dias diferentes na mesma semana.",
        "icon": "calendar",
    },
}


def serialize_badge(badge: UserBadge) -> UserBadgeOut:
    """Format a persisted UserBadge with its localized catalog metadata."""
    meta = BADGE_CATALOG.get(
        badge.badge_key,
        {
            "title": badge.badge_key,
            "description": "Conquista desbloqueada.",
            "icon": "medal",
        },
    )
    return UserBadgeOut(
        badge_key=badge.badge_key,
        title=meta["title"],
        description=meta["description"],
        icon=meta["icon"],
        unlocked_at=badge.unlocked_at,
        metadata_json=badge.metadata_json or {},
    )


async def evaluate_user_badges(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    challenge: Challenge,
    new_checkin: CheckIn,
    category_slug: str,
) -> list[str]:
    """Evaluate deterministic achievements and persist newly unlocked badges."""
    existing_keys = set(
        (
            await db.scalars(select(UserBadge.badge_key).where(UserBadge.user_id == user_id))
        ).all()
    )
    to_unlock: list[tuple[str, dict]] = []

    if "first_checkin" not in existing_keys:
        to_unlock.append(("first_checkin", {}))

    if (
        "first_hard_lc" not in existing_keys
        and category_slug == "leetcode"
        and str((new_checkin.metadata_json or {}).get("difficulty", "")).capitalize() == "Hard"
    ):
        to_unlock.append(("first_hard_lc", {"title": new_checkin.title}))

    if "night_owl" not in existing_keys:
        created = new_checkin.created_at or datetime.now(UTC)
        aware = created if created.tzinfo is not None else created.replace(tzinfo=UTC)
        local_hour = aware.astimezone(ZoneInfo(challenge.timezone)).hour
        if 0 <= local_hour < 5:
            to_unlock.append(("night_owl", {"hour": local_hour}))

    # Streak-based badges within the current challenge
    if "streak_7" not in existing_keys or "streak_30" not in existing_keys:
        ch_dates = set(
            (
                await db.scalars(
                    select(CheckIn.study_date)
                    .where(
                        CheckIn.challenge_id == challenge.id,
                        CheckIn.user_id == user_id,
                        CheckIn.status == "valid",
                    )
                    .distinct()
                )
            ).all()
        )
        rest_dates = set(
            (
                await db.scalars(
                    select(RestDay.rest_date).where(
                        RestDay.challenge_id == challenge.id,
                        RestDay.user_id == user_id,
                    )
                )
            ).all()
        )
        today = compute_study_date(datetime.now(UTC), challenge.timezone)
        streak = calculate_streak(
            active_dates=ch_dates, rest_dates=rest_dates, reference_date=today
        )
        if streak >= 7 and "streak_7" not in existing_keys:
            to_unlock.append(("streak_7", {"streak": streak}))
        if streak >= 30 and "streak_30" not in existing_keys:
            to_unlock.append(("streak_30", {"streak": streak}))

    # Weekly breadth & consistency badges
    if "polymath_week" not in existing_keys or "week_warrior" not in existing_keys:
        week_start = new_checkin.study_date - timedelta(days=new_checkin.study_date.weekday())
        week_end = week_start + timedelta(days=6)
        week_rows = (
            await db.execute(
                select(CheckIn.study_date, Category.slug)
                .join(Category, Category.id == CheckIn.category_id)
                .where(
                    CheckIn.user_id == user_id,
                    CheckIn.status == "valid",
                    CheckIn.study_date >= week_start,
                    CheckIn.study_date <= week_end,
                )
            )
        ).all()
        distinct_days: set[date] = {row[0] for row in week_rows}
        distinct_cats: set[str] = {row[1] for row in week_rows}
        if len(distinct_cats) >= 5 and "polymath_week" not in existing_keys:
            to_unlock.append(("polymath_week", {"week_start": week_start.isoformat()}))
        if len(distinct_days) >= 5 and "week_warrior" not in existing_keys:
            to_unlock.append(("week_warrior", {"days": len(distinct_days)}))

    # Cumulative reading badge
    if "bookworm_100p" not in existing_keys and category_slug == "books":
        book_rows = (
            await db.scalars(
                select(CheckIn.metadata_json)
                .join(Category, Category.id == CheckIn.category_id)
                .where(
                    CheckIn.user_id == user_id,
                    CheckIn.status == "valid",
                    Category.slug == "books",
                )
            )
        ).all()
        total_pages = 0
        for meta in book_rows:
            pages = (meta or {}).get("pages_read")
            if isinstance(pages, int | float) and pages > 0:
                total_pages += int(pages)
        if total_pages >= 100:
            to_unlock.append(("bookworm_100p", {"total_pages": total_pages}))

    unlocked_keys: list[str] = []
    for badge_key, meta in to_unlock:
        if badge_key in existing_keys:
            continue
        existing_keys.add(badge_key)
        db.add(
            UserBadge(
                user_id=user_id,
                challenge_id=challenge.id,
                badge_key=badge_key,
                metadata_json=meta,
            )
        )
        unlocked_keys.append(badge_key)
    return unlocked_keys
