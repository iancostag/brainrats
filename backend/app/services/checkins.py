import uuid
from collections import defaultdict
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Category, Challenge, ChallengeCategoryConfig
from app.models.checkin import CheckIn
from app.models.social import CheckInComment, CheckInReaction, CheckInReport
from app.models.user import User
from app.schemas.checkin import CheckInOut, CommentOut, ReportOut
from app.services.scoring import DailyUsage, calculate_checkin_points, compute_study_date


def compute_raw_points(category_slug: str, config: ChallengeCategoryConfig, metadata: dict) -> int:
    """Calculate raw points for a check-in before applying daily caps."""
    base = config.base_points
    weights = config.weights_json or {}

    if category_slug == "leetcode":
        difficulty = str(metadata.get("difficulty", "Easy")).capitalize()
        if difficulty in weights:
            return int(weights[difficulty])
        multiplier = {"Easy": 1.0, "Medium": 2.0, "Hard": 3.5}.get(difficulty, 1.0)
        return max(1, int(round(base * multiplier)))

    if category_slug == "books":
        pages = metadata.get("pages_read")
        if isinstance(pages, int | float) and pages > 0:
            per_page = int(weights.get("per_page", 1))
            return max(base, int(pages) * per_page)
        return base

    duration = metadata.get("duration_minutes")
    if isinstance(duration, int | float) and duration > 0:
        blocks = max(1, int(duration) // 30)
        return blocks * base

    return base


async def publish_checkin(
    db: AsyncSession,
    *,
    challenge: Challenge,
    user_id: uuid.UUID,
    category: Category,
    title: str,
    description: str | None,
    source: str,
    metadata_json: dict,
    evidence_url: str | None = None,
    external_event_id: str | None = None,
    occurred_at: datetime | None = None,
) -> CheckIn | None:
    """Create a CheckIn if external_event_id is new, returning None when deduplicated."""
    if external_event_id is not None:
        existing_id = await db.scalar(
            select(CheckIn.id).where(
                CheckIn.challenge_id == challenge.id,
                CheckIn.user_id == user_id,
                CheckIn.source == source,
                CheckIn.external_event_id == external_event_id,
            )
        )
        if existing_id is not None:
            return None

    cat_config = await db.scalar(
        select(ChallengeCategoryConfig).where(
            ChallengeCategoryConfig.challenge_id == challenge.id,
            ChallengeCategoryConfig.category_id == category.id,
        )
    )
    if cat_config is None or not cat_config.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A categoria '{category.name}' não está habilitada neste desafio.",
        )

    instant = occurred_at or datetime.now(UTC)
    study_date = compute_study_date(instant, challenge.timezone)

    valid_today = (
        await db.scalars(
            select(CheckIn).where(
                CheckIn.challenge_id == challenge.id,
                CheckIn.user_id == user_id,
                CheckIn.study_date == study_date,
                CheckIn.status == "valid",
            )
        )
    ).all()

    usage = DailyUsage(
        valid_checkins_today=len(valid_today),
        category_points_today=sum(
            c.points_awarded for c in valid_today if c.category_id == category.id
        ),
        global_points_today=sum(c.points_awarded for c in valid_today),
    )

    raw_points = compute_raw_points(category.slug, cat_config, metadata_json)
    points_awarded = calculate_checkin_points(
        scoring_mode=challenge.scoring_mode,  # type: ignore[arg-type]
        raw_points=raw_points,
        category_daily_cap=cat_config.daily_cap,
        challenge_daily_cap=challenge.daily_points_cap,
        usage=usage,
    )

    checkin = CheckIn(
        challenge_id=challenge.id,
        user_id=user_id,
        category_id=category.id,
        title=title.strip(),
        description=description.strip() if description else None,
        study_date=study_date,
        source=source,
        external_event_id=external_event_id,
        metadata_json=metadata_json,
        evidence_url=evidence_url,
        points_awarded=points_awarded,
        status="valid",
        search_vector=f"{title} {description or ''}".strip(),
    )
    db.add(checkin)
    await db.flush()
    return checkin


async def hydrate_checkins(
    db: AsyncSession,
    checkins: list[CheckIn],
    current_user_id: uuid.UUID,
    admin_challenge_ids: set[uuid.UUID],
) -> list[CheckInOut]:
    """Enrich CheckIn ORM rows with author, category, challenge, reactions, comments, reports."""
    if not checkins:
        return []

    checkin_ids = [c.id for c in checkins]
    user_ids = {c.user_id for c in checkins}
    category_ids = {c.category_id for c in checkins}
    challenge_ids = {c.challenge_id for c in checkins}

    comments_rows = (
        await db.scalars(
            select(CheckInComment)
            .where(CheckInComment.checkin_id.in_(checkin_ids))
            .order_by(CheckInComment.created_at.asc())
        )
    ).all()
    for cm in comments_rows:
        user_ids.add(cm.user_id)

    reports_rows = (
        await db.scalars(
            select(CheckInReport)
            .where(CheckInReport.checkin_id.in_(checkin_ids))
            .order_by(CheckInReport.created_at.desc())
        )
    ).all()
    for rp in reports_rows:
        user_ids.add(rp.reporter_id)

    reactions_rows = (
        await db.scalars(
            select(CheckInReaction).where(CheckInReaction.checkin_id.in_(checkin_ids))
        )
    ).all()

    users_by_id = {
        u.id: u for u in (await db.scalars(select(User).where(User.id.in_(user_ids)))).all()
    }
    categories_by_id = {
        c.id: c
        for c in (await db.scalars(select(Category).where(Category.id.in_(category_ids)))).all()
    }
    challenges_by_id = {
        ch.id: ch
        for ch in (await db.scalars(select(Challenge).where(Challenge.id.in_(challenge_ids)))).all()
    }

    reaction_counts: dict[uuid.UUID, dict[str, int]] = defaultdict(
        lambda: {"fire": 0, "rocket": 0, "brain": 0, "clap": 0}
    )
    user_reactions: dict[uuid.UUID, list[str]] = defaultdict(list)
    for rx in reactions_rows:
        reaction_counts[rx.checkin_id][rx.reaction_type] = (
            reaction_counts[rx.checkin_id].get(rx.reaction_type, 0) + 1
        )
        if rx.user_id == current_user_id:
            user_reactions[rx.checkin_id].append(rx.reaction_type)

    comments_map: dict[uuid.UUID, list[CommentOut]] = defaultdict(list)
    for cm in comments_rows:
        author = users_by_id.get(cm.user_id)
        comments_map[cm.checkin_id].append(
            CommentOut(
                id=cm.id,
                user_id=cm.user_id,
                username=author.username if author else "unknown",
                display_name=author.display_name if author else "Usuário",
                content=cm.content,
                created_at=cm.created_at,
            )
        )

    reports_map: dict[uuid.UUID, list[ReportOut]] = defaultdict(list)
    reports_count: dict[uuid.UUID, int] = defaultdict(int)
    for rp in reports_rows:
        reports_count[rp.checkin_id] += 1
        reporter = users_by_id.get(rp.reporter_id)
        reports_map[rp.checkin_id].append(
            ReportOut(
                id=rp.id,
                reporter_username=reporter.username if reporter else "membro",
                reason=rp.reason,
                status=rp.status,
                created_at=rp.created_at,
            )
        )

    result: list[CheckInOut] = []
    for c in checkins:
        author = users_by_id.get(c.user_id)
        cat = categories_by_id.get(c.category_id)
        ch = challenges_by_id.get(c.challenge_id)
        is_admin = c.challenge_id in admin_challenge_ids
        result.append(
            CheckInOut(
                id=c.id,
                challenge_id=c.challenge_id,
                challenge_title=ch.title if ch else "Desafio",
                user_id=c.user_id,
                username=author.username if author else "unknown",
                display_name=author.display_name if author else "Usuário",
                avatar_url=author.avatar_url if author else None,
                category_slug=cat.slug if cat else "project",
                category_name=cat.name if cat else "Categoria",
                title=c.title,
                description=c.description,
                study_date=c.study_date,
                source=c.source,  # type: ignore[arg-type]
                metadata_json=c.metadata_json or {},
                evidence_url=c.evidence_url,
                points_awarded=c.points_awarded,
                status=c.status,  # type: ignore[arg-type]
                invalidation_reason=c.invalidation_reason,
                reactions=dict(reaction_counts[c.id]),
                user_reactions=list(user_reactions[c.id]),
                comments=list(comments_map[c.id]),
                reports_count=reports_count[c.id],
                reports=list(reports_map[c.id]) if is_admin else [],
                created_at=c.created_at,
            )
        )
    return result


async def re_evaluate_checkin_mode_points_after_invalidation(
    db: AsyncSession, challenge: Challenge, checkin: CheckIn
) -> None:
    """If an invalidated check-in held the day's single point in checkin mode, promote another."""
    if challenge.scoring_mode != "checkin" or checkin.points_awarded == 0:
        return

    replacement = await db.scalar(
        select(CheckIn)
        .where(
            CheckIn.challenge_id == challenge.id,
            CheckIn.user_id == checkin.user_id,
            CheckIn.study_date == checkin.study_date,
            CheckIn.status == "valid",
            CheckIn.id != checkin.id,
        )
        .order_by(CheckIn.created_at.asc())
        .limit(1)
    )
    if replacement is not None and replacement.points_awarded == 0:
        already_scored = await db.scalar(
            select(func.count(CheckIn.id)).where(
                CheckIn.challenge_id == challenge.id,
                CheckIn.user_id == checkin.user_id,
                CheckIn.study_date == checkin.study_date,
                CheckIn.status == "valid",
                CheckIn.points_awarded > 0,
            )
        )
        if not already_scored:
            replacement.points_awarded = 1
