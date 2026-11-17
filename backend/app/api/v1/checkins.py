import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.challenge import Category, Challenge, ChallengeMember
from app.models.checkin import CheckIn
from app.models.social import CheckInComment, CheckInReaction, CheckInReport
from app.models.user import User
from app.schemas.checkin import (
    CheckInCreateRequest,
    CheckInOut,
    CheckInUpdateRequest,
    CommentCreateRequest,
    ModerateCheckInRequest,
    ReactionToggleRequest,
    ReportCreateRequest,
)
from app.services.checkins import (
    hydrate_checkins,
    publish_checkin,
    re_evaluate_checkin_mode_points_after_invalidation,
)

router = APIRouter(tags=["checkins"])


async def _get_challenge_and_membership(
    db: AsyncSession, challenge_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Challenge, ChallengeMember | None]:
    challenge = await db.scalar(select(Challenge).where(Challenge.id == challenge_id))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desafio não encontrado.")
    membership = await db.scalar(
        select(ChallengeMember).where(
            ChallengeMember.challenge_id == challenge.id,
            ChallengeMember.user_id == user_id,
        )
    )
    return challenge, membership


async def _require_membership(
    db: AsyncSession, challenge_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Challenge, ChallengeMember]:
    challenge, membership = await _get_challenge_and_membership(db, challenge_id, user_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Participe do desafio para realizar esta ação.",
        )
    return challenge, membership


async def _get_checkin_or_404(db: AsyncSession, checkin_id: uuid.UUID) -> CheckIn:
    checkin = await db.scalar(select(CheckIn).where(CheckIn.id == checkin_id))
    if checkin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Check-in não encontrado."
        )
    return checkin


async def _load_single_checkin_out(
    db: AsyncSession, checkin: CheckIn, current_user_id: uuid.UUID, is_admin: bool
) -> CheckInOut:
    admin_ids = {checkin.challenge_id} if is_admin else set()
    items = await hydrate_checkins(db, [checkin], current_user_id, admin_ids)
    return items[0]


@router.post(
    "/challenges/{challenge_id}/checkins",
    response_model=CheckInOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkin(
    challenge_id: uuid.UUID,
    payload: CheckInCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Register a manual study check-in in one of the 5 standard categories."""
    challenge, membership = await _require_membership(db, challenge_id, current_user.id)
    category = await db.scalar(select(Category).where(Category.slug == payload.category_slug))
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoria '{payload.category_slug}' não encontrada.",
        )

    checkin = await publish_checkin(
        db,
        challenge=challenge,
        user_id=current_user.id,
        category=category,
        title=payload.title,
        description=payload.description,
        source="manual",
        metadata_json=payload.metadata_json,
        evidence_url=payload.evidence_url,
    )
    assert checkin is not None
    await db.commit()
    await db.refresh(checkin)
    return await _load_single_checkin_out(db, checkin, current_user.id, membership.role == "admin")


@router.get("/challenges/{challenge_id}/feed", response_model=list[CheckInOut])
async def get_challenge_feed(
    challenge_id: uuid.UUID,
    include_invalidated: bool = Query(default=True),
    before: datetime | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CheckInOut]:
    """List check-ins for a challenge feed, with cursor pagination (`before`)."""
    challenge, membership = await _get_challenge_and_membership(db, challenge_id, current_user.id)
    if challenge.visibility == "private" and membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado a este desafio privado.",
        )

    query = (
        select(CheckIn)
        .where(CheckIn.challenge_id == challenge.id)
        .order_by(CheckIn.created_at.desc())
        .limit(limit)
    )
    if not include_invalidated:
        query = query.where(CheckIn.status == "valid")
    if before is not None:
        query = query.where(CheckIn.created_at < before)

    checkins = (await db.scalars(query)).all()
    is_admin = membership is not None and (
        membership.role == "admin" or challenge.created_by == current_user.id
    )
    admin_ids = {challenge.id} if is_admin else set()
    return await hydrate_checkins(db, list(checkins), current_user.id, admin_ids)


@router.patch("/checkins/{checkin_id}", response_model=CheckInOut)
async def update_checkin(
    checkin_id: uuid.UUID,
    payload: CheckInUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Allow the author to edit title and free description (useful for auto-synced posts)."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    if checkin.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode editar seus próprios check-ins.",
        )

    if payload.title is not None:
        checkin.title = payload.title.strip()
    if payload.description is not None:
        checkin.description = payload.description.strip() or None
    checkin.search_vector = f"{checkin.title} {checkin.description or ''}".strip()

    await db.commit()
    await db.refresh(checkin)

    _, membership = await _get_challenge_and_membership(db, checkin.challenge_id, current_user.id)
    is_admin = membership is not None and membership.role == "admin"
    return await _load_single_checkin_out(db, checkin, current_user.id, is_admin)


@router.post("/checkins/{checkin_id}/reactions", response_model=CheckInOut)
async def toggle_reaction(
    checkin_id: uuid.UUID,
    payload: ReactionToggleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Toggle a reaction on a check-in."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    challenge, membership = await _require_membership(db, checkin.challenge_id, current_user.id)

    existing = await db.scalar(
        select(CheckInReaction).where(
            CheckInReaction.checkin_id == checkin.id,
            CheckInReaction.user_id == current_user.id,
            CheckInReaction.reaction_type == payload.reaction_type,
        )
    )
    if existing is None:
        db.add(
            CheckInReaction(
                checkin_id=checkin.id,
                user_id=current_user.id,
                reaction_type=payload.reaction_type,
            )
        )
    else:
        await db.delete(existing)

    await db.commit()
    is_admin = membership.role == "admin" or challenge.created_by == current_user.id
    return await _load_single_checkin_out(db, checkin, current_user.id, is_admin)


@router.post("/checkins/{checkin_id}/comments", response_model=CheckInOut)
async def add_comment(
    checkin_id: uuid.UUID,
    payload: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Add a comment to a check-in."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    challenge, membership = await _require_membership(db, checkin.challenge_id, current_user.id)

    db.add(
        CheckInComment(
            checkin_id=checkin.id,
            user_id=current_user.id,
            content=payload.content.strip(),
        )
    )
    await db.commit()
    is_admin = membership.role == "admin" or challenge.created_by == current_user.id
    return await _load_single_checkin_out(db, checkin, current_user.id, is_admin)


@router.post("/checkins/{checkin_id}/reports", response_model=CheckInOut)
async def report_checkin(
    checkin_id: uuid.UUID,
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Report a suspicious check-in for review by the challenge admin."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    challenge, membership = await _require_membership(db, checkin.challenge_id, current_user.id)

    db.add(
        CheckInReport(
            checkin_id=checkin.id,
            reporter_id=current_user.id,
            reason=payload.reason.strip(),
            status="pending",
        )
    )
    await db.commit()
    is_admin = membership.role == "admin" or challenge.created_by == current_user.id
    return await _load_single_checkin_out(db, checkin, current_user.id, is_admin)


@router.post("/checkins/{checkin_id}/moderate", response_model=CheckInOut)
async def moderate_checkin(
    checkin_id: uuid.UUID,
    payload: ModerateCheckInRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Allow the challenge admin to invalidate or restore a check-in."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    challenge, membership = await _require_membership(db, checkin.challenge_id, current_user.id)

    if membership.role != "admin" and challenge.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o criador/admin do desafio pode moderar check-ins.",
        )

    pending_reports = (
        await db.scalars(
            select(CheckInReport).where(
                CheckInReport.checkin_id == checkin.id,
                CheckInReport.status == "pending",
            )
        )
    ).all()
    now = datetime.now(UTC)

    if payload.action == "invalidate":
        checkin.status = "invalidated"
        checkin.invalidated_by = current_user.id
        checkin.invalidation_reason = (
            payload.reason.strip() if payload.reason else "Invalidado pelo admin do grupo."
        )
        await re_evaluate_checkin_mode_points_after_invalidation(db, challenge, checkin)
        for rp in pending_reports:
            rp.status = "action_taken"
            rp.reviewed_by = current_user.id
            rp.reviewed_at = now
    else:
        checkin.status = "valid"
        checkin.invalidated_by = None
        checkin.invalidation_reason = None
        if challenge.scoring_mode == "checkin" and checkin.points_awarded > 0:
            other_scored = await db.scalar(
                select(func.count(CheckIn.id)).where(
                    CheckIn.challenge_id == challenge.id,
                    CheckIn.user_id == checkin.user_id,
                    CheckIn.study_date == checkin.study_date,
                    CheckIn.status == "valid",
                    CheckIn.points_awarded > 0,
                    CheckIn.id != checkin.id,
                )
            )
            if other_scored:
                checkin.points_awarded = 0
        for rp in pending_reports:
            rp.status = "dismissed"
            rp.reviewed_by = current_user.id
            rp.reviewed_at = now

    await db.commit()
    await db.refresh(checkin)
    return await _load_single_checkin_out(db, checkin, current_user.id, True)
