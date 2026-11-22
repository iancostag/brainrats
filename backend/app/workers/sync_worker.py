import logging
import uuid

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import decrypt_secret
from app.core.seed import ensure_default_categories
from app.models.challenge import Challenge, ChallengeMember
from app.models.user import UserIntegration
from app.services.github_sync import (
    fetch_github_events_commits,
    sync_github_integration_for_user,
)

logger = logging.getLogger(__name__)


async def _resolve_worker_challenge(
    db: AsyncSession, user_id: uuid.UUID, explicit_id: uuid.UUID | None
) -> Challenge | None:
    if explicit_id is not None:
        membership = await db.scalar(
            select(ChallengeMember).where(
                ChallengeMember.challenge_id == explicit_id,
                ChallengeMember.user_id == user_id,
            )
        )
        if membership is not None:
            ch = await db.scalar(select(Challenge).where(Challenge.id == explicit_id))
            if ch is not None:
                return ch

    first_membership = await db.scalar(
        select(ChallengeMember)
        .where(ChallengeMember.user_id == user_id)
        .order_by(ChallengeMember.joined_at.asc())
        .limit(1)
    )
    if first_membership is None:
        return None
    return await db.scalar(select(Challenge).where(Challenge.id == first_membership.challenge_id))


async def sync_github_repositories(ctx: dict) -> dict[str, int]:
    """Periodic job to fetch new commits for users with GitHub integration."""
    logger.info("Running scheduled GitHub repository sync")
    processed_users = 0
    created_checkins = 0

    async with AsyncSessionLocal() as db:
        categories_by_slug = await ensure_default_categories(db)
        project_category = categories_by_slug["project"]
        integrations = (
            await db.scalars(select(UserIntegration).where(UserIntegration.provider == "github"))
        ).all()

        for gh_integration in integrations:
            target = await _resolve_worker_challenge(
                db, gh_integration.user_id, gh_integration.target_challenge_id
            )
            if target is None:
                continue
            processed_users += 1
            try:
                rows, _, _ = await sync_github_integration_for_user(
                    db,
                    user_id=gh_integration.user_id,
                    gh_integration=gh_integration,
                    challenge=target,
                    project_category=project_category,
                    decrypt_fn=decrypt_secret,
                    public_fetcher=fetch_github_events_commits,
                )
                created_checkins += len(rows)
                await db.commit()
            except Exception:
                await db.rollback()
                logger.exception(
                    "Scheduled GitHub sync failed for user_id=%s", gh_integration.user_id
                )

    return {"processed_users": processed_users, "created_checkins": created_checkins}


async def sync_leetcode_submissions(ctx: dict) -> dict[str, int]:
    """Periodic job to fetch recent accepted submissions from LeetCode."""
    logger.info("Running scheduled LeetCode submission sync")
    return {"processed_users": 0, "created_checkins": 0}


class WorkerSettings:
    """ARQ worker configuration for background synchronization tasks."""

    functions = [sync_github_repositories, sync_leetcode_submissions]
    cron_jobs = [cron(sync_github_repositories, minute={0, 15, 30, 45})]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
