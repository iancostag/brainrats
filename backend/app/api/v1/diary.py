import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.challenge import Category, ChallengeMember
from app.models.checkin import CheckIn
from app.models.user import User
from app.schemas.checkin import DiaryResponse
from app.services.checkins import hydrate_checkins

router = APIRouter(prefix="/diary", tags=["diary"])


@router.get("", response_model=DiaryResponse)
async def search_diary(
    q: str | None = Query(default=None, max_length=120),
    category_slug: str | None = Query(default=None),
    challenge_id: uuid.UUID | None = Query(default=None),
    source: str | None = Query(default=None),
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

    checkins = list((await db.scalars(query.limit(200))).all())

    admin_memberships = (
        await db.scalars(
            select(ChallengeMember.challenge_id).where(
                ChallengeMember.user_id == current_user.id,
                ChallengeMember.role == "admin",
            )
        )
    ).all()
    items = await hydrate_checkins(db, checkins, current_user.id, set(admin_memberships))

    by_category: dict[str, int] = defaultdict(int)
    total_points = 0
    for item in items:
        by_category[item.category_slug] += 1
        if item.status == "valid":
            total_points += item.points_awarded

    return DiaryResponse(
        items=items,
        total_entries=len(items),
        total_points=total_points,
        by_category=dict(by_category),
    )
