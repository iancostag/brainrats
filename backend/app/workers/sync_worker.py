import logging

from arq.connections import RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)


async def sync_github_repositories(ctx: dict) -> dict[str, int]:
    """Periodic job to fetch new commits from monitored GitHub repositories."""
    logger.info("Running scheduled GitHub repository sync")
    return {"processed_repos": 0, "created_checkins": 0}


async def sync_leetcode_submissions(ctx: dict) -> dict[str, int]:
    """Periodic job to fetch recent accepted submissions from LeetCode."""
    logger.info("Running scheduled LeetCode submission sync")
    return {"processed_users": 0, "created_checkins": 0}


class WorkerSettings:
    """ARQ worker configuration for background synchronization tasks."""

    functions = [sync_github_repositories, sync_leetcode_submissions]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
