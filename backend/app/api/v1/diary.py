import uuid
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.challenge import Category, ChallengeMember
from app.models.checkin import CheckIn
from app.models.user import User
from app.schemas.checkin import DiaryChallengeEntry, DiaryItem, DiaryResponse
from app.services.checkins import hydrate_checkins

router = APIRouter(prefix="/diary", tags=["diary"])


@router.get("", response_model=DiaryResponse)
async def search_diary(
    q: str | None = Query(default=None, max_length=120),
    category_slug: str | None = Query(default=None),
    challenge_id: uuid.UUID | None = Query(default=None),
    source: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DiaryResponse:
    """Return the authenticated user's searchable study diary across challenges."""
    query = (
        select(CheckIn)
        .where(CheckIn.user_id == current_user.id)
        .order_by(CheckIn.created_at.desc())
    )

    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(CheckIn.title.ilike(pattern), CheckIn.description.ilike(pattern))
        )

    if category_slug:
        cat_id = await db.scalar(select(Category.id).where(Category.slug == category_slug))
        if cat_id is None:
            return DiaryResponse(items=[], total_entries=0, total_points=0, by_category={})
        query = query.where(CheckIn.category_id == cat_id)

    if challenge_id is not None:
        query = query.where(CheckIn.challenge_id == challenge_id)

    if source:
        query = query.where(CheckIn.source == source)

    if date_from is not None:
        query = query.where(CheckIn.study_date >= date_from)

    if date_to is not None:
        query = query.where(CheckIn.study_date <= date_to)

    checkins = list((await db.scalars(query.limit(200))).all())

    admin_memberships = (
        await db.scalars(
            select(ChallengeMember.challenge_id).where(
                ChallengeMember.user_id == current_user.id,
                ChallengeMember.role == "admin",
            )
        )
    ).all()
    hydrated = await hydrate_checkins(db, checkins, current_user.id, set(admin_memberships))

    # O mesmo estudo em N desafios (sync ou publicação manual em todos) vira um item só.
    external_ids = {c.id: c.external_event_id for c in checkins}
    grouped: dict[tuple[str, str], DiaryItem] = {}
    items: list[DiaryItem] = []
    for checkin in hydrated:
        entry = DiaryChallengeEntry(
            checkin_id=checkin.id,
            challenge_id=checkin.challenge_id,
            challenge_title=checkin.challenge_title,
            points_awarded=checkin.points_awarded,
            status=checkin.status,
        )
        external_id = external_ids.get(checkin.id)
        key = (checkin.source, external_id) if external_id else None
        if key is not None and key in grouped:
            grouped[key].challenges.append(entry)
            continue
        diary_item = DiaryItem(**checkin.model_dump(), challenges=[entry])
        if key is not None:
            grouped[key] = diary_item
        items.append(diary_item)

    by_category: dict[str, int] = defaultdict(int)
    total_points = 0
    for item in items:
        by_category[item.category_slug] += 1
        # Cada estudo conta uma vez: vale a maior pontuação válida entre os desafios.
        total_points += max(
            (e.points_awarded for e in item.challenges if e.status == "valid"), default=0
        )

    return DiaryResponse(
        items=items,
        total_entries=len(items),
        total_points=total_points,
        by_category=dict(by_category),
    )
