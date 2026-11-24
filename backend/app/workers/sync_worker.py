import logging
import uuid
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import decrypt_secret
from app.core.seed import ensure_default_categories
from app.models.challenge import Challenge, ChallengeMember, RestDay
from app.models.checkin import CheckIn
from app.models.user import User, UserIntegration
from app.services.badges import evaluate_user_badges
from app.services.github_sync import (
    fetch_github_events_commits,
    sync_github_integration_for_user,
)
from app.services.leetcode_sync import (
    fetch_leetcode_problem_difficulty,
    fetch_leetcode_recent_submissions,
    sync_leetcode_integration_for_user,
)
from app.services.push import is_push_configured, send_push_to_user
from app.services.scoring import compute_study_date

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
                for row in rows:
                    await evaluate_user_badges(
                        db,
                        user_id=gh_integration.user_id,
                        challenge=target,
                        new_checkin=row,
                        category_slug="project",
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
    """Periodic job to fetch recent accepted submissions from LeetCode with real difficulty."""
    logger.info("Running scheduled LeetCode submission sync")
    processed_users = 0
    created_checkins = 0

    async with AsyncSessionLocal() as db:
        categories_by_slug = await ensure_default_categories(db)
        leetcode_category = categories_by_slug["leetcode"]
        integrations = (
            await db.scalars(select(UserIntegration).where(UserIntegration.provider == "leetcode"))
        ).all()

        for lc_integration in integrations:
            target = await _resolve_worker_challenge(
                db, lc_integration.user_id, lc_integration.target_challenge_id
            )
            if target is None:
                continue
            processed_users += 1
            try:
                rows, _, _ = await sync_leetcode_integration_for_user(
                    db,
                    user_id=lc_integration.user_id,
                    lc_integration=lc_integration,
                    challenge=target,
                    leetcode_category=leetcode_category,
                    submissions_fetcher=fetch_leetcode_recent_submissions,
                    difficulty_fetcher=fetch_leetcode_problem_difficulty,
                )
                for row in rows:
                    await evaluate_user_badges(
                        db,
                        user_id=lc_integration.user_id,
                        challenge=target,
                        new_checkin=row,
                        category_slug="leetcode",
                    )
                created_checkins += len(rows)
                await db.commit()
            except Exception:
                await db.rollback()
                logger.exception(
                    "Scheduled LeetCode sync failed for user_id=%s", lc_integration.user_id
                )

    return {"processed_users": processed_users, "created_checkins": created_checkins}


async def send_streak_reminders(ctx: dict) -> dict[str, int]:
    """Send evening Web Push reminders to users who enabled them and haven't studied today."""
    if not is_push_configured():
        return {"notified_users": 0}

    notified = 0
    now = datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        users = (
            await db.scalars(select(User).where(User.notify_streak_reminder.is_(True)))
        ).all()
        for user in users:
            target = await _resolve_worker_challenge(db, user.id, user.last_challenge_id)
            if target is None:
                continue
            local_hour = now.astimezone(ZoneInfo(target.timezone)).hour
            if local_hour != 20:
                continue
            today = compute_study_date(now, target.timezone)
            studied_today = await db.scalar(
                select(CheckIn.id)
                .where(
                    CheckIn.challenge_id == target.id,
                    CheckIn.user_id == user.id,
                    CheckIn.study_date == today,
                    CheckIn.status == "valid",
                )
                .limit(1)
            )
            rested_today = await db.scalar(
                select(RestDay.id)
                .where(
                    RestDay.challenge_id == target.id,
                    RestDay.user_id == user.id,
                    RestDay.rest_date == today,
                )
                .limit(1)
            )
            if studied_today is None and rested_today is None:
                sent = await send_push_to_user(
                    db,
                    user_id=user.id,
                    title="Salve sua ofensiva no BrainRats!",
                    body=(
                        f"Ainda dá tempo de registrar um estudo ou ativar descanso em "
                        f"{target.title}."
                    ),
                    url="/?tab=home",
                )
                if sent > 0:
                    notified += 1
        await db.commit()
    return {"notified_users": notified}


class WorkerSettings:
    """ARQ worker configuration for background synchronization and reminder tasks."""

    functions = [sync_github_repositories, sync_leetcode_submissions, send_streak_reminders]
    cron_jobs = [
        cron(sync_github_repositories, minute={0, 15, 30, 45}),
        cron(sync_leetcode_submissions, minute={5, 20, 35, 50}),
        cron(send_streak_reminders, minute={0}),
    ]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
