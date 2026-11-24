import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Category, Challenge
from app.models.checkin import CheckIn
from app.models.extras import LeetCodeProblemCache
from app.models.user import UserIntegration
from app.services.checkins import publish_checkin
from app.services.scoring import compute_study_date

logger = logging.getLogger(__name__)

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
LEETCODE_RECENT_AC_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
    lang
  }
}
"""
LEETCODE_QUESTION_DIFFICULTY_QUERY = """
query questionDifficulty($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    difficulty
  }
}
"""


def parse_leetcode_timestamp(raw: str | int | None) -> datetime | None:
    """Parse a Unix timestamp string/int returned by LeetCode GraphQL."""
    if raw is None or raw == "":
        return None
    try:
        return datetime.fromtimestamp(int(raw), tz=UTC)
    except (TypeError, ValueError):
        return None


async def fetch_leetcode_recent_submissions(
    leetcode_username: str, *, transport: httpx.AsyncBaseTransport | None = None
) -> list[dict]:
    """Fetch recent Accepted submissions from LeetCode's public GraphQL API."""
    async with httpx.AsyncClient(timeout=6.0, transport=transport) as client:
        resp = await client.post(
            LEETCODE_GRAPHQL_URL,
            json={
                "query": LEETCODE_RECENT_AC_QUERY,
                "variables": {"username": leetcode_username, "limit": 15},
            },
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            return []
        data = resp.json().get("data") or {}
        return data.get("recentAcSubmissionList") or []


async def fetch_leetcode_problem_difficulty(
    title_slug: str, *, transport: httpx.AsyncBaseTransport | None = None
) -> str | None:
    """Fetch a problem's difficulty ('Easy', 'Medium', 'Hard') from LeetCode GraphQL."""
    if not title_slug:
        return None
    try:
        async with httpx.AsyncClient(timeout=4.0, transport=transport) as client:
            resp = await client.post(
                LEETCODE_GRAPHQL_URL,
                json={
                    "query": LEETCODE_QUESTION_DIFFICULTY_QUERY,
                    "variables": {"titleSlug": title_slug},
                },
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                return None
            question = (resp.json().get("data") or {}).get("question") or {}
            diff = str(question.get("difficulty") or "").capitalize()
            return diff if diff in ("Easy", "Medium", "Hard") else None
    except Exception:
        return None


async def resolve_problem_difficulty(
    db: AsyncSession,
    title_slug: str,
    *,
    explicit_difficulty: str | None = None,
    difficulty_fetcher: Callable[[str], Awaitable[str | None]] | None = None,
) -> str:
    """Resolve real problem difficulty using submission payload, DB cache, or LeetCode API."""
    if explicit_difficulty and explicit_difficulty.capitalize() in ("Easy", "Medium", "Hard"):
        return explicit_difficulty.capitalize()
    if not title_slug:
        return "Medium"

    cached = await db.scalar(
        select(LeetCodeProblemCache).where(LeetCodeProblemCache.title_slug == title_slug)
    )
    if cached is not None:
        return cached.difficulty

    fetched: str | None = None
    if difficulty_fetcher is not None:
        fetched = await difficulty_fetcher(title_slug)
    if fetched in ("Easy", "Medium", "Hard"):
        db.add(LeetCodeProblemCache(title_slug=title_slug, difficulty=fetched))
        await db.flush()
        return fetched
    return "Medium"


async def sync_leetcode_integration_for_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    lc_integration: UserIntegration,
    challenge: Challenge,
    leetcode_category: Category,
    submissions_fetcher: Callable[[str], Awaitable[list[dict]]],
    difficulty_fetcher: Callable[[str], Awaitable[str | None]] | None = None,
) -> tuple[list[CheckIn], int, str]:
    """Sync today's Accepted LeetCode submissions for one user into the target challenge."""
    today_in_tz = compute_study_date(datetime.now(UTC), challenge.timezone)
    submissions = await submissions_fetcher(lc_integration.external_username)

    created_rows: list[CheckIn] = []
    skipped_duplicates = 0
    skipped_old = 0
    today_matches = 0

    for sub in submissions:
        occurred_at = parse_leetcode_timestamp(sub.get("timestamp"))
        if occurred_at is None:
            skipped_old += 1
            continue
        event_date = compute_study_date(occurred_at, challenge.timezone)
        if (
            event_date != today_in_tz
            or event_date < challenge.start_date
            or (challenge.end_date is not None and event_date > challenge.end_date)
        ):
            skipped_old += 1
            continue

        today_matches += 1
        sub_id = str(sub.get("id") or sub.get("timestamp") or "")
        title = str(sub.get("title") or "Problema LeetCode")
        slug = str(sub.get("titleSlug") or "")
        if not sub_id:
            continue

        difficulty = await resolve_problem_difficulty(
            db,
            slug,
            explicit_difficulty=sub.get("difficulty"),
            difficulty_fetcher=difficulty_fetcher,
        )
        metadata: dict[str, str] = {"difficulty": difficulty, "problem_slug": slug}
        lang = str(sub.get("lang") or "").strip()
        if lang:
            metadata["language"] = lang

        row = await publish_checkin(
            db,
            challenge=challenge,
            user_id=user_id,
            category=leetcode_category,
            title=title,
            description=None,
            source="leetcode",
            external_event_id=sub_id,
            metadata_json=metadata,
            evidence_url=f"https://leetcode.com/problems/{slug}/" if slug else None,
            occurred_at=occurred_at,
        )
        if row is None:
            skipped_duplicates += 1
        else:
            created_rows.append(row)

    lc_integration.last_synced_at = datetime.now(UTC)
    lc_name = lc_integration.external_username
    detail = (
        f"LeetCode ({lc_name}): {today_matches} submissão(ões) de hoje "
        f"({skipped_old} de dias anteriores ignorada(s))."
    )
    return created_rows, skipped_duplicates, detail
