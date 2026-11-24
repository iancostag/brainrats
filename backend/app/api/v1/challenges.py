import re
import secrets
import string
import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.core.security import get_current_user
from app.core.seed import attach_default_category_configs, ensure_default_categories
from app.models.challenge import (
    Category,
    Challenge,
    ChallengeCategoryConfig,
    ChallengeMember,
    ChallengeNudge,
    RestDay,
    StudyPresence,
)
from app.models.checkin import CheckIn
from app.models.social import CheckInReport
from app.models.user import User
from app.schemas.challenge import (
    CategoryConfigOut,
    ChallengeCreateRequest,
    ChallengeDetailResponse,
    ChallengeJoinRequest,
    ChallengeListItem,
    ChallengeMemberRoleRequest,
    ChallengePreviewOut,
    ChallengeSummaryResponse,
    ChallengeUpdateRequest,
    LeaderboardEntry,
    NudgeOut,
    RestDayResponse,
    StudyPresenceOut,
    StudyPresenceRequest,
)
from app.services.outbound_webhooks import validate_outbound_webhook_url
from app.services.push import send_push_to_user
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
        collective_weekly_goal=challenge.collective_weekly_goal,
        has_discord_webhook=bool(challenge.discord_webhook_url),
        is_member=membership is not None,
        member_role=membership.role if membership else None,  # type: ignore[arg-type]
        members_count=members_count,
        created_at=challenge.created_at,
    )


async def _require_admin(
    db: AsyncSession, challenge_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Challenge, ChallengeMember]:
    challenge = await db.scalar(select(Challenge).where(Challenge.id == challenge_id))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desafio não encontrado.")
    membership = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge.id,
            ChallengeMember.user_id == user_id,
        )
    )
    if membership is None or (membership.role != "admin" and challenge.created_by != user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas admins do desafio podem executar esta ação.",
        )
    return challenge, membership


async def _build_leaderboard_and_stats(
    db: AsyncSession,
    challenge: Challenge,
    members: list[ChallengeMember],
    today: date,
) -> tuple[list[LeaderboardEntry], dict[uuid.UUID, set[date]], dict[uuid.UUID, set[date]]]:
    """Compute leaderboard using SQL aggregations + distinct study_dates for streaks."""
    member_ids = [m.user_id for m in members]
    if not member_ids:
        return [], {}, {}

    users = (await db.scalars(select(User).where(User.id.in_(member_ids)))).all()
    users_by_id = {u.id: u for u in users}

    agg_rows = (
        await db.execute(
            select(
                CheckIn.user_id,
                func.coalesce(func.sum(CheckIn.points_awarded), 0),
                func.count(CheckIn.id),
                func.count(func.distinct(CheckIn.study_date)),
            )
            .where(CheckIn.challenge_id == challenge.id, CheckIn.status == "valid")
            .group_by(CheckIn.user_id)
        )
    ).all()
    points_by_user: dict[uuid.UUID, int] = {}
    checkins_count_by_user: dict[uuid.UUID, int] = {}
    active_days_count_by_user: dict[uuid.UUID, int] = {}
    for uid, total_pts, cnt, days_cnt in agg_rows:
        points_by_user[uid] = int(total_pts or 0)
        checkins_count_by_user[uid] = int(cnt or 0)
        active_days_count_by_user[uid] = int(days_cnt or 0)

    distinct_date_rows = (
        await db.execute(
            select(CheckIn.user_id, CheckIn.study_date)
            .where(CheckIn.challenge_id == challenge.id, CheckIn.status == "valid")
            .distinct()
        )
    ).all()
    active_dates_by_user: dict[uuid.UUID, set[date]] = defaultdict(set)
    for uid, sdate in distinct_date_rows:
        active_dates_by_user[uid].add(sdate)

    all_rest_days = (
        await db.scalars(select(RestDay).where(RestDay.challenge_id == challenge.id))
    ).all()
    rest_dates_by_user: dict[uuid.UUID, set[date]] = defaultdict(set)
    for r in all_rest_days:
        rest_dates_by_user[r.user_id].add(r.rest_date)

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
                total_points=points_by_user.get(u.id, 0),
                active_days=active_days_count_by_user.get(u.id, len(active_dates)),
                checkins_count=checkins_count_by_user.get(u.id, 0),
                current_streak=streak,
                rest_days_used_this_week=used_this_week,
                checked_in_today=today in active_dates,
            )
        )

    leaderboard.sort(
        key=lambda e: (e.total_points, e.current_streak, e.active_days),
        reverse=True,
    )
    return leaderboard, active_dates_by_user, rest_dates_by_user


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

    try:
        webhook_url = validate_outbound_webhook_url(payload.discord_webhook_url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

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
        collective_weekly_goal=payload.collective_weekly_goal,
        discord_webhook_url=webhook_url,
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
    current_user.last_challenge_id = challenge.id

    await db.commit()
    await db.refresh(challenge)
    return _to_list_item(challenge, membership, 1)


@router.get(
    "/preview/{invite_code}",
    response_model=ChallengePreviewOut,
    dependencies=[Depends(rate_limit("challenge_preview", max_requests=30, window_seconds=300))],
)
async def preview_challenge_by_invite(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengePreviewOut:
    """Preview basic challenge metadata for an invite code before joining."""
    code = invite_code.strip().upper()
    challenge = await db.scalar(select(Challenge).where(Challenge.invite_code == code))
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Código de convite não encontrado."
        )
    members_count = int(
        await db.scalar(
            select(func.count(ChallengeMember.id)).where(
                ChallengeMember.challenge_id == challenge.id
            )
        )
        or 0
    )
    is_member = (
        await db.scalar(
            select(ChallengeMember.id).where(
                ChallengeMember.challenge_id == challenge.id,
                ChallengeMember.user_id == current_user.id,
            )
        )
        is not None
    )
    return ChallengePreviewOut(
        id=challenge.id,
        title=challenge.title,
        description=challenge.description,
        visibility=challenge.visibility,  # type: ignore[arg-type]
        scoring_mode=challenge.scoring_mode,  # type: ignore[arg-type]
        timezone=challenge.timezone,
        start_date=challenge.start_date,
        end_date=challenge.end_date,
        rest_days_per_week=challenge.rest_days_per_week,
        daily_points_cap=challenge.daily_points_cap,
        members_count=members_count,
        is_member=is_member,
    )


@router.post(
    "/join",
    response_model=ChallengeListItem,
    dependencies=[Depends(rate_limit("challenge_join", max_requests=25, window_seconds=300))],
)
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

    current_user.last_challenge_id = challenge.id
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
    """Return challenge settings, category configs, rest days, weekly stats, and ranking."""
    challenge = await db.scalar(select(Challenge).where(Challenge.id == challenge_id))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desafio não encontrado.")

    members = list(
        (
            await db.scalars(
                select(ChallengeMember).where(ChallengeMember.challenge_id == challenge.id)
            )
        ).all()
    )
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

    now = datetime.now(UTC)
    today = compute_study_date(now, challenge.timezone)
    week_start, week_end = _iso_week_bounds(today)

    leaderboard, active_dates_by_user, rest_dates_by_user = await _build_leaderboard_and_stats(
        db, challenge, members, today
    )

    user_rest_dates = sorted(rest_dates_by_user.get(current_user.id, set()))
    user_used_week = sum(1 for d in user_rest_dates if week_start <= d <= week_end)
    remaining_week = max(0, challenge.rest_days_per_week - user_used_week)

    user_active_week = sorted(
        d for d in active_dates_by_user.get(current_user.id, set()) if week_start <= d <= week_end
    )
    user_points_today = int(
        await db.scalar(
            select(func.coalesce(func.sum(CheckIn.points_awarded), 0)).where(
                CheckIn.challenge_id == challenge.id,
                CheckIn.user_id == current_user.id,
                CheckIn.study_date == today,
                CheckIn.status == "valid",
            )
        )
        or 0
    )

    collective_week_checkins = int(
        await db.scalar(
            select(func.count(CheckIn.id)).where(
                CheckIn.challenge_id == challenge.id,
                CheckIn.status == "valid",
                CheckIn.study_date >= week_start,
                CheckIn.study_date <= week_end,
            )
        )
        or 0
    )

    # Active study presences ("estudando agora")
    presence_rows = (
        await db.execute(
            select(StudyPresence, User)
            .join(User, User.id == StudyPresence.user_id)
            .where(
                StudyPresence.challenge_id == challenge.id,
                StudyPresence.expires_at > now,
            )
            .order_by(StudyPresence.started_at.desc())
        )
    ).all()
    active_studiers = [
        StudyPresenceOut(
            user_id=u.id,
            username=u.username,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            category_slug=p.category_slug,
            started_at=p.started_at,
            expires_at=p.expires_at,
        )
        for p, u in presence_rows
    ]

    is_admin = user_membership is not None and (
        user_membership.role == "admin" or challenge.created_by == current_user.id
    )
    pending_reports_count = 0
    if is_admin:
        pending_reports_count = int(
            await db.scalar(
                select(func.count(CheckInReport.id))
                .join(CheckIn, CheckIn.id == CheckInReport.checkin_id)
                .where(
                    CheckIn.challenge_id == challenge.id,
                    CheckInReport.status == "pending",
                )
            )
            or 0
        )

    nudge_rows = (
        await db.execute(
            select(ChallengeNudge, User)
            .join(User, User.id == ChallengeNudge.sender_id)
            .where(
                ChallengeNudge.challenge_id == challenge.id,
                ChallengeNudge.target_user_id == current_user.id,
                ChallengeNudge.nudge_date == today,
            )
            .order_by(ChallengeNudge.created_at.desc())
        )
    ).all()
    received_nudges = [
        NudgeOut(
            id=n.id,
            sender_username=sender.username,
            sender_display_name=sender.display_name,
            nudge_date=n.nudge_date,
            created_at=n.created_at,
        )
        for n, sender in nudge_rows
    ]

    return ChallengeDetailResponse(
        challenge=_to_list_item(challenge, user_membership, len(members)),
        category_configs=category_configs,
        leaderboard=leaderboard,
        user_rest_dates=user_rest_dates,
        rest_days_remaining_this_week=remaining_week,
        user_active_dates_this_week=user_active_week,
        user_points_today=user_points_today,
        collective_week_checkins=collective_week_checkins,
        active_studiers=active_studiers,
        pending_reports_count=pending_reports_count,
        received_nudges_today=received_nudges,
    )


@router.patch("/{challenge_id}", response_model=ChallengeListItem)
async def update_challenge(
    challenge_id: uuid.UUID,
    payload: ChallengeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeListItem:
    """Allow a challenge admin to edit title, dates, rules, category weights, and webhook."""
    challenge, membership = await _require_admin(db, challenge_id, current_user.id)

    if payload.title is not None:
        challenge.title = payload.title.strip()
    if payload.description is not None:
        challenge.description = payload.description.strip() or None
    if payload.visibility is not None:
        challenge.visibility = payload.visibility
    if payload.clear_end_date:
        challenge.end_date = None
    elif payload.end_date is not None:
        if payload.end_date < challenge.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A data de término não pode ser anterior à data de início.",
            )
        challenge.end_date = payload.end_date
    if payload.rest_days_per_week is not None:
        challenge.rest_days_per_week = payload.rest_days_per_week
    if payload.daily_points_cap is not None and challenge.scoring_mode == "points":
        challenge.daily_points_cap = payload.daily_points_cap
    if payload.clear_collective_weekly_goal:
        challenge.collective_weekly_goal = None
    elif payload.collective_weekly_goal is not None:
        challenge.collective_weekly_goal = payload.collective_weekly_goal
    if payload.discord_webhook_url is not None:
        try:
            challenge.discord_webhook_url = validate_outbound_webhook_url(
                payload.discord_webhook_url
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if payload.category_configs is not None:
        if not any(cfg.is_enabled for cfg in payload.category_configs):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ative pelo menos uma categoria no desafio.",
            )
        cats = {c.slug: c for c in (await db.scalars(select(Category))).all()}
        existing_cfgs = {
            cfg.category_id: cfg
            for cfg in (
                await db.scalars(
                    select(ChallengeCategoryConfig).where(
                        ChallengeCategoryConfig.challenge_id == challenge.id
                    )
                )
            ).all()
        }
        for item in payload.category_configs:
            cat = cats.get(item.category_slug)
            if cat is None:
                continue
            cfg = existing_cfgs.get(cat.id)
            if cfg is not None:
                cfg.is_enabled = item.is_enabled
                cfg.base_points = item.base_points
                cfg.daily_cap = item.daily_cap

    await db.commit()
    await db.refresh(challenge)
    members_count = int(
        await db.scalar(
            select(func.count(ChallengeMember.id)).where(
                ChallengeMember.challenge_id == challenge.id
            )
        )
        or 0
    )
    return _to_list_item(challenge, membership, members_count)


@router.post("/{challenge_id}/invite-code/regenerate", response_model=ChallengeListItem)
async def regenerate_invite_code(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeListItem:
    """Generate a new unique invite code for the challenge (admin only)."""
    challenge, membership = await _require_admin(db, challenge_id, current_user.id)
    for _ in range(10):
        candidate = _generate_invite_code()
        exists = await db.scalar(select(Challenge.id).where(Challenge.invite_code == candidate))
        if exists is None:
            challenge.invite_code = candidate
            break
    await db.commit()
    await db.refresh(challenge)
    members_count = int(
        await db.scalar(
            select(func.count(ChallengeMember.id)).where(
                ChallengeMember.challenge_id == challenge.id
            )
        )
        or 0
    )
    return _to_list_item(challenge, membership, members_count)


@router.delete("/{challenge_id}/leave", status_code=status.HTTP_200_OK)
async def leave_challenge(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Leave a challenge, preventing the last admin from stranding other members."""
    membership = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge_id,
            ChallengeMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Você não participa deste desafio."
        )

    total_members = int(
        await db.scalar(
            select(func.count(ChallengeMember.id)).where(
                ChallengeMember.challenge_id == challenge_id
            )
        )
        or 0
    )
    if membership.role == "admin" and total_members > 1:
        other_admins = int(
            await db.scalar(
                select(func.count(ChallengeMember.id)).where(
                    ChallengeMember.challenge_id == challenge_id,
                    ChallengeMember.role == "admin",
                    ChallengeMember.user_id != current_user.id,
                )
            )
            or 0
        )
        if other_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Promova outro membro a admin antes de sair do desafio.",
            )

    await db.delete(membership)
    if current_user.last_challenge_id == challenge_id:
        current_user.last_challenge_id = None
    await db.commit()
    return {"detail": "Você saiu do desafio."}


@router.patch("/{challenge_id}/members/{target_user_id}", status_code=status.HTTP_200_OK)
async def update_member_role(
    challenge_id: uuid.UUID,
    target_user_id: uuid.UUID,
    payload: ChallengeMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Promote or demote a member inside the challenge (admin only)."""
    challenge, _ = await _require_admin(db, challenge_id, current_user.id)
    target = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge.id,
            ChallengeMember.user_id == target_user_id,
        )
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membro não encontrado.")
    if target_user_id == challenge.created_by and payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O criador do desafio não pode perder o papel de admin.",
        )
    target.role = payload.role
    await db.commit()
    return {"detail": "Papel do membro atualizado."}


@router.delete("/{challenge_id}/members/{target_user_id}", status_code=status.HTTP_200_OK)
async def remove_challenge_member(
    challenge_id: uuid.UUID,
    target_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Remove a member from the challenge (admin only)."""
    challenge, _ = await _require_admin(db, challenge_id, current_user.id)
    if target_user_id == challenge.created_by or target_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível remover o criador ou a si mesmo por esta ação.",
        )
    target = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge.id,
            ChallengeMember.user_id == target_user_id,
        )
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membro não encontrado.")
    await db.delete(target)
    await db.commit()
    return {"detail": "Membro removido do desafio."}


@router.post("/{challenge_id}/presence", response_model=StudyPresenceOut)
async def upsert_study_presence(
    challenge_id: uuid.UUID,
    payload: StudyPresenceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StudyPresenceOut:
    """Announce an active focus/Pomodoro session in the challenge."""
    membership = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge_id,
            ChallengeMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participe do desafio para iniciar uma sessão de foco.",
        )
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=payload.duration_minutes)
    existing = await db.scalar(
        select(StudyPresence).where(
            StudyPresence.challenge_id == challenge_id,
            StudyPresence.user_id == current_user.id,
        )
    )
    if existing is None:
        existing = StudyPresence(
            challenge_id=challenge_id,
            user_id=current_user.id,
            category_slug=payload.category_slug,
            started_at=now,
            expires_at=expires,
        )
        db.add(existing)
    else:
        existing.category_slug = payload.category_slug
        existing.started_at = now
        existing.expires_at = expires
    await db.commit()
    return StudyPresenceOut(
        user_id=current_user.id,
        username=current_user.username,
        display_name=current_user.display_name,
        avatar_url=current_user.avatar_url,
        category_slug=existing.category_slug,
        started_at=existing.started_at,
        expires_at=existing.expires_at,
    )


@router.delete("/{challenge_id}/presence", status_code=status.HTTP_200_OK)
async def clear_study_presence(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """End the user's active focus session in the challenge."""
    await db.execute(
        delete(StudyPresence).where(
            StudyPresence.challenge_id == challenge_id,
            StudyPresence.user_id == current_user.id,
        )
    )
    await db.commit()
    return {"detail": "Sessão de foco encerrada."}


@router.post("/{challenge_id}/nudge/{target_user_id}", status_code=status.HTTP_201_CREATED)
async def nudge_member(
    challenge_id: uuid.UUID,
    target_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Send a friendly daily nudge (max 1/day per pair) to remind a teammate to study."""
    if target_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode enviar uma cutucada para si mesmo.",
        )
    challenge = await db.scalar(select(Challenge).where(Challenge.id == challenge_id))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desafio não encontrado.")

    members = (
        await db.scalars(
            select(ChallengeMember.user_id).where(
                ChallengeMember.challenge_id == challenge.id,
                ChallengeMember.user_id.in_([current_user.id, target_user_id]),
            )
        )
    ).all()
    if len(set(members)) < 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ambos precisam participar do desafio.",
        )

    today = compute_study_date(datetime.now(UTC), challenge.timezone)
    existing = await db.scalar(
        select(ChallengeNudge.id).where(
            ChallengeNudge.challenge_id == challenge.id,
            ChallengeNudge.sender_id == current_user.id,
            ChallengeNudge.target_user_id == target_user_id,
            ChallengeNudge.nudge_date == today,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você já enviou uma cutucada para este colega hoje.",
        )

    db.add(
        ChallengeNudge(
            challenge_id=challenge.id,
            sender_id=current_user.id,
            target_user_id=target_user_id,
            nudge_date=today,
        )
    )
    target_user = await db.scalar(select(User).where(User.id == target_user_id))
    if target_user is not None and target_user.notify_social:
        await send_push_to_user(
            db,
            user_id=target_user.id,
            title=f"Lembrete em {challenge.title}",
            body=f"{current_user.display_name} te lembrou de garantir o estudo de hoje!",
            url="/?tab=home",
        )
    await db.commit()
    return {"detail": "Lembrete amigável enviado!"}


@router.get("/{challenge_id}/summary", response_model=ChallengeSummaryResponse)
async def get_challenge_summary(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChallengeSummaryResponse:
    """Return retrospective summary data for a challenge (used by the shareable Wrapped card)."""
    challenge = await db.scalar(select(Challenge).where(Challenge.id == challenge_id))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desafio não encontrado.")

    members = list(
        (
            await db.scalars(
                select(ChallengeMember).where(ChallengeMember.challenge_id == challenge.id)
            )
        ).all()
    )
    if challenge.visibility == "private" and not any(
        m.user_id == current_user.id for m in members
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não participa deste desafio privado.",
        )

    today = compute_study_date(datetime.now(UTC), challenge.timezone)
    leaderboard, _, _ = await _build_leaderboard_and_stats(db, challenge, members, today)

    cat_rows = (
        await db.execute(
            select(Category.slug, func.count(CheckIn.id))
            .join(Category, Category.id == CheckIn.category_id)
            .where(CheckIn.challenge_id == challenge.id, CheckIn.status == "valid")
            .group_by(Category.slug)
        )
    ).all()
    by_category = {slug: int(cnt) for slug, cnt in cat_rows}
    top_category = max(by_category, key=lambda k: by_category[k]) if by_category else None

    my_index = next(
        (i for i, e in enumerate(leaderboard) if e.user_id == current_user.id),
        None,
    )
    return ChallengeSummaryResponse(
        challenge_id=challenge.id,
        challenge_title=challenge.title,
        scoring_mode=challenge.scoring_mode,  # type: ignore[arg-type]
        start_date=challenge.start_date,
        end_date=challenge.end_date,
        total_checkins=sum(e.checkins_count for e in leaderboard),
        total_points=sum(e.total_points for e in leaderboard),
        participants_count=len(leaderboard),
        top_category_slug=top_category,
        by_category=by_category,
        podium=leaderboard[:3],
        my_entry=leaderboard[my_index] if my_index is not None else None,
        my_position=(my_index + 1) if my_index is not None else None,
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
