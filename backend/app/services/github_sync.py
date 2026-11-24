import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import is_valid_github_username
from app.models.challenge import Category, Challenge
from app.models.checkin import CheckIn
from app.models.user import MonitoredRepository, UserIntegration
from app.services.checkins import publish_checkin
from app.services.scoring import compute_study_date

logger = logging.getLogger(__name__)

ZERO_SHA = "0" * 40
MAX_COMMITS_PER_SYNC = 30


class GitHubSyncError(Exception):
    """Raised when the GitHub API returns an actionable error."""


def parse_github_timestamp(raw: str | None) -> datetime | None:
    """Parse an ISO-8601 timestamp returned by the GitHub API."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _github_headers(access_token: str | None = None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "BrainRats/1.0",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def _raise_for_github_status(resp: httpx.Response, *, context: str) -> None:
    if resp.status_code == 200:
        return
    if resp.status_code == 401:
        raise GitHubSyncError(
            "GitHub: token OAuth expirado ou inválido. Reconecte sua conta via GitHub OAuth."
        )
    if resp.status_code in (403, 429):
        raise GitHubSyncError(
            "GitHub: limite de requisições (rate limit) atingido. "
            "Conecte via GitHub OAuth ou tente novamente em alguns minutos."
        )
    if resp.status_code == 404:
        raise GitHubSyncError(f"GitHub: {context} não encontrado.")
    raise GitHubSyncError(f"GitHub: erro HTTP {resp.status_code} ao consultar {context}.")


def _is_commit_by_user(item: dict, github_username: str) -> bool:
    target_login = github_username.strip().lower()
    author_login = ((item.get("author") or {}).get("login") or "").strip().lower()
    committer_login = ((item.get("committer") or {}).get("login") or "").strip().lower()
    if author_login or committer_login:
        return target_login in (author_login, committer_login)
    # When GitHub cannot map a local git email to an account, keep commits from the user's push.
    return True


def _build_commit_entry(
    *,
    repo_name: str,
    sha: str,
    message: str,
    created_at: str | None,
    html_url: str | None = None,
) -> dict | None:
    first_line = (message or "").splitlines()[0].strip() if message else ""
    if not sha or not first_line:
        return None
    return {
        "sha": sha,
        "title": f"[{repo_name}] {first_line}"[:190],
        "repo": repo_name,
        "url": html_url or f"https://github.com/{repo_name}/commit/{sha}",
        "created_at": created_at,
    }


def _commit_from_github_item(
    repo_name: str, item: dict, fallback_created_at: str | None = None
) -> dict | None:
    sha = str(item.get("sha") or "")
    commit_obj = item.get("commit") or {}
    message = str(commit_obj.get("message") or "")
    created_at = (
        (commit_obj.get("author") or {}).get("date")
        or (commit_obj.get("committer") or {}).get("date")
        or fallback_created_at
    )
    return _build_commit_entry(
        repo_name=repo_name,
        sha=sha,
        message=message,
        created_at=created_at,
        html_url=item.get("html_url"),
    )


async def _resolve_push_event_commits(
    client: httpx.AsyncClient,
    *,
    repo_name: str,
    github_username: str,
    payload: dict,
    event_created_at: str | None,
    headers: dict[str, str],
) -> list[dict]:
    """Resolve commits from a GitHub PushEvent, handling payloads without `commits`."""
    legacy_commits = payload.get("commits") or []
    if legacy_commits:
        resolved: list[dict] = []
        for commit in legacy_commits:
            entry = _build_commit_entry(
                repo_name=repo_name,
                sha=str(commit.get("sha") or ""),
                message=str(commit.get("message") or ""),
                created_at=event_created_at,
            )
            if entry is not None:
                resolved.append(entry)
        return resolved

    head = str(payload.get("head") or "")
    before = str(payload.get("before") or "")
    if not head:
        return []

    if before and before != ZERO_SHA and before != head:
        compare_resp = await client.get(
            f"https://api.github.com/repos/{repo_name}/compare/{before}...{head}",
            headers=headers,
        )
        if compare_resp.status_code == 200:
            resolved = []
            for item in compare_resp.json().get("commits") or []:
                if not _is_commit_by_user(item, github_username):
                    continue
                entry = _commit_from_github_item(
                    repo_name, item, fallback_created_at=event_created_at
                )
                if entry is not None:
                    resolved.append(entry)
            return resolved
        if compare_resp.status_code in (401, 403, 429):
            _raise_for_github_status(compare_resp, context=f"repositório '{repo_name}'")

    commit_resp = await client.get(
        f"https://api.github.com/repos/{repo_name}/commits/{head}",
        headers=headers,
    )
    if commit_resp.status_code == 200:
        item = commit_resp.json()
        if not _is_commit_by_user(item, github_username):
            return []
        entry = _commit_from_github_item(repo_name, item, fallback_created_at=event_created_at)
        return [entry] if entry is not None else []
    if commit_resp.status_code in (401, 403, 429):
        _raise_for_github_status(commit_resp, context=f"repositório '{repo_name}'")
    return []


async def fetch_github_events_commits(
    github_username: str,
    *,
    access_token: str | None = None,
    repo_filter: set[str] | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> list[dict]:
    """Fetch recent commits from GitHub PushEvents (resolving head/compare when needed)."""
    username = github_username.strip()
    if not username or not is_valid_github_username(username):
        return []

    headers = _github_headers(access_token)
    events_url = (
        f"https://api.github.com/users/{username}/events"
        if access_token
        else f"https://api.github.com/users/{username}/events/public"
    )
    cutoff = datetime.now(UTC) - timedelta(days=2)
    commits: list[dict] = []
    seen_shas: set[str] = set()

    async with httpx.AsyncClient(timeout=8.0, transport=transport) as client:
        resp = await client.get(events_url, params={"per_page": 30}, headers=headers)
        _raise_for_github_status(resp, context=f"usuário '{username}'")

        for event in resp.json():
            if event.get("type") != "PushEvent":
                continue
            repo_name = str((event.get("repo") or {}).get("name") or "")
            if not repo_name:
                continue
            if repo_filter is not None and repo_name.lower() not in repo_filter:
                continue

            payload = event.get("payload") or {}
            event_created_at = event.get("created_at")
            event_dt = parse_github_timestamp(event_created_at)

            # Avoid extra /compare or /commits requests for events older than 48h.
            if not payload.get("commits") and event_dt is not None and event_dt < cutoff:
                continue

            resolved = await _resolve_push_event_commits(
                client,
                repo_name=repo_name,
                github_username=username,
                payload=payload,
                event_created_at=event_created_at,
                headers=headers,
            )
            for entry in resolved:
                if entry["sha"] in seen_shas:
                    continue
                seen_shas.add(entry["sha"])
                commits.append(entry)
                if len(commits) >= MAX_COMMITS_PER_SYNC:
                    return commits

    return commits


async def fetch_repo_commits_with_token(
    full_name: str,
    author: str,
    access_token: str,
    since_iso: str,
    *,
    branch: str | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> list[dict]:
    """Fetch commits for a specific repository using an OAuth access token."""
    params: dict[str, str | int] = {
        "author": author,
        "since": since_iso,
        "per_page": MAX_COMMITS_PER_SYNC,
    }
    if branch:
        params["sha"] = branch

    async with httpx.AsyncClient(timeout=8.0, transport=transport) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{full_name}/commits",
            params=params,
            headers=_github_headers(access_token),
        )
        if resp.status_code == 404:
            return []
        _raise_for_github_status(resp, context=f"repositório '{full_name}'")

        commits: list[dict] = []
        for item in resp.json():
            entry = _commit_from_github_item(full_name, item)
            if entry is not None:
                commits.append(entry)
        return commits


def _dedupe_commits(commits: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for item in commits:
        sha = item.get("sha")
        if not sha or sha in seen:
            continue
        seen.add(sha)
        unique.append(item)
    return unique


async def sync_github_integration_for_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    gh_integration: UserIntegration,
    challenge: Challenge,
    project_category: Category,
    decrypt_fn: Callable[[str], str | None],
    public_fetcher: Callable[[str], Awaitable[list[dict]]],
) -> tuple[list[CheckIn], int, str]:
    """Sync today's GitHub commits for one user into the target challenge."""
    today_in_tz = compute_study_date(datetime.now(UTC), challenge.timezone)
    oauth_token = (
        decrypt_fn(gh_integration.access_token_encrypted)
        if gh_integration.access_token_encrypted
        else None
    )
    monitored_repos = (
        await db.scalars(
            select(MonitoredRepository).where(
                MonitoredRepository.user_id == user_id,
                MonitoredRepository.is_active.is_(True),
            )
        )
    ).all()

    if oauth_token and monitored_repos:
        start_of_today = datetime.combine(
            today_in_tz, time.min, tzinfo=ZoneInfo(challenge.timezone)
        )
        since_iso = start_of_today.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        commits: list[dict] = []
        for repo in monitored_repos:
            repo_commits = await fetch_repo_commits_with_token(
                repo.full_name,
                gh_integration.external_username,
                oauth_token,
                since_iso,
                branch=repo.default_branch,
            )
            commits.extend(repo_commits)

        # Also check recent PushEvents on monitored repos to catch non-default branches.
        monitored_names = {repo.full_name.lower() for repo in monitored_repos}
        event_commits = await fetch_github_events_commits(
            gh_integration.external_username,
            access_token=oauth_token,
            repo_filter=monitored_names,
        )
        commits = _dedupe_commits([*commits, *event_commits])
    elif oauth_token:
        commits = await fetch_github_events_commits(
            gh_integration.external_username,
            access_token=oauth_token,
        )
    else:
        commits = await public_fetcher(gh_integration.external_username)

    created_rows: list[CheckIn] = []
    skipped_duplicates = 0
    skipped_old = 0
    today_matches = 0

    for item in commits:
        occurred_at = parse_github_timestamp(item.get("created_at"))
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
        row = await publish_checkin(
            db,
            challenge=challenge,
            user_id=user_id,
            category=project_category,
            title=item["title"],
            description=None,
            source="github",
            external_event_id=item["sha"],
            metadata_json={"repository": item["repo"], "commits_count": 1},
            evidence_url=item["url"],
            occurred_at=occurred_at,
        )
        if row is None:
            skipped_duplicates += 1
        else:
            created_rows.append(row)

    gh_integration.last_synced_at = datetime.now(UTC)
    gh_name = gh_integration.external_username
    token_warning = ""
    if gh_integration.access_token_encrypted and oauth_token is None:
        token_warning = " (token OAuth inválido — reconecte via GitHub OAuth)"
    detail = (
        f"GitHub ({gh_name}): {today_matches} commit(s) de hoje "
        f"({skipped_old} de dias anteriores ignorado(s)){token_warning}."
    )
    return created_rows, skipped_duplicates, detail
