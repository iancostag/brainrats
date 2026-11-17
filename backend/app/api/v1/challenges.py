import re
import secrets
import string
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.seed import attach_default_category_configs, ensure_default_categories
from app.models.challenge import (
    Category,
    Challenge,
    ChallengeCategoryConfig,
    ChallengeMember,
    RestDay,
)
from app.models.checkin import CheckIn
from app.models.user import User
from app.schemas.challenge import (
    CategoryConfigOut,
    ChallengeCreateRequest,
    ChallengeDetailResponse,
    ChallengeJoinRequest,
    ChallengeListItem,
    LeaderboardEntry,
    RestDayResponse,
)
from app.services.scoring import calculate_streak, compute_study_date

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _slugify(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:50] or "desafio"
    suffix = secrets.token_hex(3)
    return f"{base}-{suffix}"


def _generate_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _iso_week_bounds(target: date) -> tuple[date, date]:
    start = target - timedelta(days=target.weekday())
    return start, start + timedelta(days=6)


def _to_list_item(
    challenge: Challenge,
    membership: ChallengeMember | None,
    members_count: int,
) -> ChallengeListItem:
    return ChallengeListItem(
        id=challenge.id,
        slug=challenge.slug,
        title=challenge.title,
        description=challenge.description,
        visibility=challenge.visibility,  # type: ignore[arg-type]
        invite_code=challenge.invite_code,
        scoring_mode=challenge.scoring_mode,  # type: ignore[arg-type]
        timezone=challenge.timezone,
        start_date=challenge.start_date,
        end_date=challenge.end_date,
        rest_days_per_week=challenge.rest_days_per_week,
        daily_points_cap=challenge.daily_points_cap,
        is_member=membership is not None,
        member_role=membership.role if membership else None,  # type: ignore[arg-type]
        members_count=members_count,
        created_at=challenge.created_at,
    )


@router.get("", response_model=list[ChallengeListItem])
async def list_challenges(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChallengeListItem]:
    """List public challenges and private challenges where the user is a member."""
    user_memberships = (
        await db.scalars(
            select(ChallengeMember).where(ChallengeMember.user_id == current_user.id)
        )
    ).all()
    membership_by_ch = {m.challenge_id: m for m in user_memberships}
    member_challenge_ids = list(membership_by_ch.keys())

    query = select(Challenge).order_by(Challenge.created_at.desc())
    if member_challenge_ids:
        query = query.where(
            or_(Challenge.visibility == "public", Challenge.id.in_(member_challenge_ids))
        )
    else:
        query = query.where(Challenge.visibility == "public")

    challenges = (await db.scalars(query)).all()
    if not challenges:
        return []

    counts_rows = (
        await db.execute(
            select(ChallengeMember.challenge_id, func.count(ChallengeMember.id))
            .where(ChallengeMember.challenge_id.in_([ch.id for ch in challenges]))
            .group_by(ChallengeMember.challenge_id)
        )
    ).all()
    counts_by_ch = {row[0]: int(row[1]) for row in counts_rows}

    return [
        _to_list_item(ch, membership_by_ch.get(ch.id), counts_by_ch.get(ch.id, 0))
        for ch in challenges
    ]


@router.post("", response_model=ChallengeListItem, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    payload: ChallengeCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeListItem:
    """Create a new challenge and configure categories and scoring mode."""
    try:
        ZoneInfo(payload.timezone)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fuso horário inválido: '{payload.timezone}'.",
        ) from exc

    today = compute_study_date(datetime.now(UTC), payload.timezone)
    start_date = payload.start_date or today
    if payload.end_date is not None and payload.end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data de término não pode ser anterior à data de início.",
        )

    categories_by_slug = await ensure_default_categories(db)
    challenge = Challenge(
        slug=_slugify(payload.title),
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        visibility=payload.visibility,
        invite_code=_generate_invite_code(),
        scoring_mode=payload.scoring_mode,
        timezone=payload.timezone,
        start_date=start_date,
        end_date=payload.end_date,
        rest_days_per_week=payload.rest_days_per_week,
        daily_points_cap=1 if payload.scoring_mode == "checkin" else payload.daily_points_cap,
        created_by=current_user.id,
    )
    db.add(challenge)
    await db.flush()

    membership = ChallengeMember(
        challenge_id=challenge.id,
        user_id=current_user.id,
        role="admin",
    )
    db.add(membership)

    overrides = {
        cfg.category_slug: {
            "is_enabled": cfg.is_enabled,
            "base_points": cfg.base_points,
            "daily_cap": cfg.daily_cap,
        }
        for cfg in payload.category_configs
        if cfg.category_slug in categories_by_slug
    }
    await attach_default_category_configs(db, challenge.id, categories_by_slug, overrides)

    await db.commit()
    await db.refresh(challenge)
    return _to_list_item(challenge, membership, 1)


@router.post("/join", response_model=ChallengeListItem)
async def join_challenge(
    payload: ChallengeJoinRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeListItem:
    """Join a challenge by invite_code (private/public) or challenge_id (public only)."""
    challenge: Challenge | None = None
    if payload.invite_code:
        code = payload.invite_code.strip().upper()
        challenge = await db.scalar(select(Challenge).where(Challenge.invite_code == code))
        if challenge is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Código de convite não encontrado.",
            )
    elif payload.challenge_id:
        challenge = await db.scalar(select(Challenge).where(Challenge.id == payload.challenge_id))
        if challenge is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Desafio não encontrado.",
            )
        if challenge.visibility != "public":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Desafio privado exige código de convite.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe invite_code ou challenge_id.",
        )

    membership = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge.id,
            ChallengeMember.user_id == current_user.id,
        )
    )
    if membership is None:
        membership = ChallengeMember(
            challenge_id=challenge.id,
            user_id=current_user.id,
            role="member",
        )
        db.add(membership)
        await db.commit()

    members_count = int(
        await db.scalar(
            select(func.count(ChallengeMember.id)).where(
                ChallengeMember.challenge_id == challenge.id
            )
        )
        or 0
    )
    return _to_list_item(challenge, membership, members_count)


@router.get("/{challenge_id}", response_model=ChallengeDetailResponse)
async def get_challenge_detail(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeDetailResponse:
    """Return challenge settings, category configs, rest days, and computed leaderboard."""
    challenge = await db.scalar(select(Challenge).where(Challenge.id == challenge_id))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desafio não encontrado.")

    members = (
        await db.scalars(
            select(ChallengeMember).where(ChallengeMember.challenge_id == challenge.id)
        )
    ).all()
    membership_by_user = {m.user_id: m for m in members}
    user_membership = membership_by_user.get(current_user.id)

    if challenge.visibility == "private" and user_membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não participa deste desafio privado.",
        )

    configs_rows = (
        await db.execute(
            select(ChallengeCategoryConfig, Category)
            .join(Category, Category.id == ChallengeCategoryConfig.category_id)
            .where(ChallengeCategoryConfig.challenge_id == challenge.id)
            .order_by(Category.name.asc())
        )
    ).all()
    category_configs = [
        CategoryConfigOut(
            category_id=cat.id,
            slug=cat.slug,
            name=cat.name,
            is_enabled=cfg.is_enabled,
            base_points=cfg.base_points,
            daily_cap=cfg.daily_cap,
            weights_json=cfg.weights_json or {},
        )
        for cfg, cat in configs_rows
    ]

    users = (
        await db.scalars(select(User).where(User.id.in_(list(membership_by_user.keys()))))
    ).all()
    users_by_id = {u.id: u for u in users}

    valid_checkins = (
        await db.scalars(
            select(CheckIn).where(
                CheckIn.challenge_id == challenge.id,
                CheckIn.status == "valid",
            )
        )
    ).all()
    all_rest_days = (
        await db.scalars(select(RestDay).where(RestDay.challenge_id == challenge.id))
    ).all()

    points_by_user: dict[uuid.UUID, int] = defaultdict(int)
    checkins_count_by_user: dict[uuid.UUID, int] = defaultdict(int)
    active_dates_by_user: dict[uuid.UUID, set[date]] = defaultdict(set)
    for c in valid_checkins:
        points_by_user[c.user_id] += c.points_awarded
        checkins_count_by_user[c.user_id] += 1
        active_dates_by_user[c.user_id].add(c.study_date)

    rest_dates_by_user: dict[uuid.UUID, set[date]] = defaultdict(set)
    for r in all_rest_days:
        rest_dates_by_user[r.user_id].add(r.rest_date)

    today = compute_study_date(datetime.now(UTC), challenge.timezone)
    week_start, week_end = _iso_week_bounds(today)

    leaderboard: list[LeaderboardEntry] = []
    for member in members:
        u = users_by_id.get(member.user_id)
        if u is None:
            continue
        active_dates = active_dates_by_user[u.id]
        rest_dates = rest_dates_by_user[u.id]
        used_this_week = sum(1 for d in rest_dates if week_start <= d <= week_end)
        streak = calculate_streak(
            active_dates=active_dates,
            rest_dates=rest_dates,
            reference_date=today,
        )
        leaderboard.append(
            LeaderboardEntry(
                user_id=u.id,
                username=u.username,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                role=member.role,  # type: ignore[arg-type]
                total_points=points_by_user[u.id],
                active_days=len(active_dates),
                checkins_count=checkins_count_by_user[u.id],
                current_streak=streak,
                rest_days_used_this_week=used_this_week,
            )
        )

    leaderboard.sort(
        key=lambda e: (e.total_points, e.current_streak, e.active_days),
        reverse=True,
    )

    user_rest_dates = sorted(rest_dates_by_user[current_user.id])
    user_used_week = sum(1 for d in user_rest_dates if week_start <= d <= week_end)
    remaining_week = max(0, challenge.rest_days_per_week - user_used_week)

    return ChallengeDetailResponse(
        challenge=_to_list_item(challenge, user_membership, len(members)),
        category_configs=category_configs,
        leaderboard=leaderboard,
        user_rest_dates=user_rest_dates,
        rest_days_remaining_this_week=remaining_week,
    )


@router.post("/{challenge_id}/rest-days", response_model=RestDayResponse)
async def register_rest_day(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RestDayResponse:
    """Register today as a Rest Day in the challenge timezone if weekly quota allows."""
    challenge = await db.scalar(select(Challenge).where(Challenge.id == challenge_id))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desafio não encontrado.")

    membership = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge.id,
            ChallengeMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Entre no desafio antes de registrar um dia de descanso.",
        )

    today = compute_study_date(datetime.now(UTC), challenge.timezone)
    week_start, week_end = _iso_week_bounds(today)

    user_week_rest_days = (
        await db.scalars(
            select(RestDay).where(
                RestDay.challenge_id == challenge.id,
                RestDay.user_id == current_user.id,
                RestDay.rest_date >= week_start,
                RestDay.rest_date <= week_end,
            )
        )
    ).all()

    if any(r.rest_date == today for r in user_week_rest_days):
        used = len(user_week_rest_days)
        return RestDayResponse(
            rest_date=today,
            rest_days_used_this_week=used,
            rest_days_remaining_this_week=max(0, challenge.rest_days_per_week - used),
        )

    if len(user_week_rest_days) >= challenge.rest_days_per_week:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Limite semanal de {challenge.rest_days_per_week} dia(s) de descanso "
                "já foi atingido."
            ),
        )

    db.add(RestDay(challenge_id=challenge.id, user_id=current_user.id, rest_date=today))
    await db.commit()

    used = len(user_week_rest_days) + 1
    return RestDayResponse(
        rest_date=today,
        rest_days_used_this_week=used,
        rest_days_remaining_this_week=max(0, challenge.rest_days_per_week - used),
    )
