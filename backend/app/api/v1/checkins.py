import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.challenge import Category, Challenge, ChallengeCategoryConfig, ChallengeMember
from app.models.checkin import CheckIn
from app.models.social import CheckInComment, CheckInReaction, CheckInReport
from app.models.user import User
from app.schemas.checkin import (
    CheckInCreatedOut,
    CheckInCreateRequest,
    CheckInOut,
    CheckInUpdateRequest,
    CommentCreateRequest,
    ModerateCheckInRequest,
    ReactionToggleRequest,
    ReportCreateRequest,
)
from app.services.badges import evaluate_user_badges
from app.services.checkins import (
    hydrate_checkins,
    publish_checkin,
    re_evaluate_checkin_mode_points_after_invalidation,
)
from app.services.outbound_webhooks import dispatch_challenge_webhook
from app.services.push import send_push_to_user
from app.services.scoring import compute_study_date

# Prefixo do id compartilhado pelas cópias de um check-in manual publicado em vários desafios.
MANUAL_CROSSPOST_PREFIX = "manual-"

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


async def _crosspost_targets(
    db: AsyncSession, primary: Challenge, user_id: uuid.UUID, category: Category
) -> tuple[list[Challenge], list[str]]:
    """Other challenges of the user that can receive the same check-in, plus the skipped ones."""
    others = list(
        (
            await db.scalars(
                select(Challenge)
                .join(ChallengeMember, ChallengeMember.challenge_id == Challenge.id)
                .where(ChallengeMember.user_id == user_id, Challenge.id != primary.id)
                .order_by(Challenge.created_at)
            )
        ).all()
    )
    if not others:
        return [], []

    enabled_ids = set(
        (
            await db.scalars(
                select(ChallengeCategoryConfig.challenge_id).where(
                    ChallengeCategoryConfig.category_id == category.id,
                    ChallengeCategoryConfig.is_enabled.is_(True),
                    ChallengeCategoryConfig.challenge_id.in_([c.id for c in others]),
                )
            )
        ).all()
    )
    now = datetime.now(UTC)
    targets: list[Challenge] = []
    skipped: list[str] = []
    for other in others:
        today = compute_study_date(now, other.timezone)
        if other.id not in enabled_ids:
            skipped.append(f"{other.title} (categoria desabilitada)")
        elif today < other.start_date:
            skipped.append(f"{other.title} (ainda não começou)")
        elif other.end_date is not None and today > other.end_date:
            skipped.append(f"{other.title} (encerrado)")
        else:
            targets.append(other)
    return targets, skipped


@router.post(
    "/challenges/{challenge_id}/checkins",
    response_model=CheckInCreatedOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkin(
    challenge_id: uuid.UUID,
    payload: CheckInCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInCreatedOut:
    """Register a manual study check-in, optionally copying it to the user's other challenges."""
    challenge, membership = await _require_membership(db, challenge_id, current_user.id)
    category = await db.scalar(select(Category).where(Category.slug == payload.category_slug))
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoria '{payload.category_slug}' não encontrada.",
        )

    others: list[Challenge] = []
    skipped: list[str] = []
    if payload.publish_to_all_challenges:
        others, skipped = await _crosspost_targets(db, challenge, current_user.id, category)
    shared_id = f"{MANUAL_CROSSPOST_PREFIX}{uuid.uuid4().hex}" if others else None

    created: list[CheckIn] = []
    for target in [challenge, *others]:
        checkin = await publish_checkin(
            db,
            challenge=target,
            user_id=current_user.id,
            category=category,
            title=payload.title,
            description=payload.description,
            source="manual",
            metadata_json=payload.metadata_json,
            evidence_url=payload.evidence_url,
            image_url=payload.image_url,
            external_event_id=shared_id,
        )
        assert checkin is not None
        created.append(checkin)

    primary = created[0]
    unlocked_badges = await evaluate_user_badges(
        db,
        user_id=current_user.id,
        challenge=challenge,
        new_checkin=primary,
        category_slug=category.slug,
    )

    await db.commit()
    await db.refresh(primary)

    if challenge.discord_webhook_url:
        pts_text = (
            "+1 check-in"
            if challenge.scoring_mode == "checkin"
            else f"+{primary.points_awarded} pts"
        )
        await dispatch_challenge_webhook(
            challenge.discord_webhook_url,
            message=(
                f"**{current_user.display_name}** (@{current_user.username}) publicou em "
                f"**{challenge.title}**: [{category.name}] {primary.title} ({pts_text})"
            ),
        )

    out = await _load_single_checkin_out(db, primary, current_user.id, membership.role == "admin")
    return CheckInCreatedOut(
        **out.model_dump(),
        also_published_in=[c.title for c in others],
        skipped_challenges=skipped,
        newly_unlocked_badges=unlocked_badges,
    )


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


@router.get("/challenges/{challenge_id}/reports", response_model=list[CheckInOut])
async def list_challenge_reports(
    challenge_id: uuid.UUID,
    status_filter: Literal["pending", "all"] = Query(default="pending"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CheckInOut]:
    """Dedicated moderation queue listing reported check-ins for challenge admins."""
    challenge, membership = await _require_membership(db, challenge_id, current_user.id)
    if membership.role != "admin" and challenge.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas admins do desafio podem acessar a fila de denúncias.",
        )

    subq = select(CheckInReport.checkin_id).distinct()
    if status_filter == "pending":
        subq = subq.where(CheckInReport.status == "pending")

    checkins = list(
        (
            await db.scalars(
                select(CheckIn)
                .where(CheckIn.challenge_id == challenge.id, CheckIn.id.in_(subq))
                .order_by(CheckIn.created_at.desc())
                .limit(100)
            )
        ).all()
    )
    return await hydrate_checkins(db, checkins, current_user.id, {challenge.id})


@router.patch("/checkins/{checkin_id}", response_model=CheckInOut)
async def update_checkin(
    checkin_id: uuid.UUID,
    payload: CheckInUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Allow the author to edit title, free description, and evidence links."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    if checkin.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode editar seus próprios check-ins.",
        )

    copies = [checkin]
    if (
        checkin.source == "manual"
        and checkin.external_event_id
        and checkin.external_event_id.startswith(MANUAL_CROSSPOST_PREFIX)
    ):
        copies = list(
            (
                await db.scalars(
                    select(CheckIn).where(
                        CheckIn.user_id == current_user.id,
                        CheckIn.source == "manual",
                        CheckIn.external_event_id == checkin.external_event_id,
                    )
                )
            ).all()
        )

    for copy in copies:
        if payload.title is not None:
            copy.title = payload.title.strip()
        if payload.description is not None:
            copy.description = payload.description.strip() or None
        if payload.evidence_url is not None:
            copy.evidence_url = payload.evidence_url
        if payload.image_url is not None:
            copy.image_url = payload.image_url
        copy.search_vector = f"{copy.title} {copy.description or ''}".strip()

    await db.commit()
    await db.refresh(checkin)

    _, membership = await _get_challenge_and_membership(db, checkin.challenge_id, current_user.id)
    is_admin = membership is not None and membership.role == "admin"
    return await _load_single_checkin_out(db, checkin, current_user.id, is_admin)


@router.delete("/checkins/{checkin_id}", status_code=status.HTTP_200_OK)
async def delete_checkin(
    checkin_id: uuid.UUID,
    delete_copies: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Delete the author's check-in and promote another daily check-in in checkin mode if needed."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    if checkin.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode excluir seus próprios check-ins.",
        )

    targets = [checkin]
    if (
        delete_copies
        and checkin.source == "manual"
        and checkin.external_event_id
        and checkin.external_event_id.startswith(MANUAL_CROSSPOST_PREFIX)
    ):
        targets = list(
            (
                await db.scalars(
                    select(CheckIn).where(
                        CheckIn.user_id == current_user.id,
                        CheckIn.source == "manual",
                        CheckIn.external_event_id == checkin.external_event_id,
                    )
                )
            ).all()
        )

    challenge_ids = {item.challenge_id for item in targets}
    challenges_by_id = {
        ch.id: ch
        for ch in (await db.scalars(select(Challenge).where(Challenge.id.in_(challenge_ids)))).all()
    }
    for item in targets:
        ch = challenges_by_id.get(item.challenge_id)
        if ch is not None and item.status == "valid":
            await re_evaluate_checkin_mode_points_after_invalidation(db, ch, item)
        await db.delete(item)

    await db.commit()
    return {"deleted_count": len(targets)}


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
    if checkin.user_id != current_user.id:
        author = await db.scalar(select(User).where(User.id == checkin.user_id))
        if author is not None and author.notify_social:
            await send_push_to_user(
                db,
                user_id=author.id,
                title=f"Novo comentário em {challenge.title}",
                body=f"{current_user.display_name}: {payload.content.strip()[:120]}",
                url="/?tab=home",
            )
    await db.commit()
    is_admin = membership.role == "admin" or challenge.created_by == current_user.id
    return await _load_single_checkin_out(db, checkin, current_user.id, is_admin)


@router.delete("/comments/{comment_id}", response_model=CheckInOut)
async def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Allow the comment author or challenge admin to delete a comment."""
    comment = await db.scalar(select(CheckInComment).where(CheckInComment.id == comment_id))
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comentário não encontrado."
        )
    checkin = await _get_checkin_or_404(db, comment.checkin_id)
    challenge, membership = await _require_membership(db, checkin.challenge_id, current_user.id)
    is_admin = membership.role == "admin" or challenge.created_by == current_user.id
    if comment.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode excluir seus próprios comentários.",
        )
    await db.delete(comment)
    await db.commit()
    return await _load_single_checkin_out(db, checkin, current_user.id, is_admin)


@router.post("/checkins/{checkin_id}/reports", response_model=CheckInOut)
async def report_checkin(
    checkin_id: uuid.UUID,
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CheckInOut:
    """Report a suspicious check-in for review by the challenge admin (once per reporter)."""
    checkin = await _get_checkin_or_404(db, checkin_id)
    challenge, membership = await _require_membership(db, checkin.challenge_id, current_user.id)

    duplicate = await db.scalar(
        select(CheckInReport.id).where(
            CheckInReport.checkin_id == checkin.id,
            CheckInReport.reporter_id == current_user.id,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você já denunciou este check-in.",
        )

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
