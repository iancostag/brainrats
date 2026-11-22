import logging
import secrets
import uuid
from datetime import UTC, date, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decrypt_secret, get_current_user
from app.core.seed import ensure_default_categories
from app.models.challenge import Challenge, ChallengeMember
from app.models.checkin import CheckIn
from app.models.user import MonitoredRepository, User, UserIntegration
from app.schemas.auth import GitHubRepoItem, MonitoredReposUpdateRequest
from app.schemas.checkin import SyncRequest, SyncResponse
from app.services.checkins import hydrate_checkins, publish_checkin
from app.services.github_sync import (
    GitHubSyncError,
    fetch_github_events_commits,
    fetch_repo_commits_with_token,
    parse_github_timestamp,
    sync_github_integration_for_user,
)
from app.services.scoring import compute_study_date

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["integrations"])

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"
LEETCODE_RECENT_AC_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
  }
}
"""


async def _resolve_target_challenge(
    db: AsyncSession, user_id: uuid.UUID, explicit_id: uuid.UUID | None
) -> Challenge:
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
    if first_membership is not None:
        ch = await db.scalar(
            select(Challenge).where(Challenge.id == first_membership.challenge_id)
        )
        if ch is not None:
            return ch

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Entre em pelo menos um desafio antes de sincronizar suas integrações.",
    )


def _parse_github_timestamp(raw: str | None) -> datetime | None:
    return parse_github_timestamp(raw)


def _parse_leetcode_timestamp(raw: str | int | None) -> datetime | None:
    if raw is None or raw == "":
        return None
    try:
        return datetime.fromtimestamp(int(raw), tz=UTC)
    except (TypeError, ValueError):
        return None


def _is_within_today_and_challenge(
    occurred_at: datetime | None, challenge: Challenge, today: date
) -> bool:
    if occurred_at is None:
        return False
    event_date = compute_study_date(occurred_at, challenge.timezone)
    if event_date != today:
        return False
    if event_date < challenge.start_date:
        return False
    if challenge.end_date is not None and event_date > challenge.end_date:
        return False
    return True


async def _fetch_github_push_commits(github_username: str) -> list[dict]:
    return await fetch_github_events_commits(github_username)


async def _fetch_repo_commits_with_token(
    full_name: str,
    author: str,
    access_token: str,
    since_iso: str,
) -> list[dict]:
    return await fetch_repo_commits_with_token(full_name, author, access_token, since_iso)


async def _fetch_leetcode_submissions(leetcode_username: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=6.0) as client:
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


@router.get("/github/repos", response_model=list[GitHubRepoItem])
async def list_github_repositories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GitHubRepoItem]:
    """List the user's GitHub repositories (including private) using OAuth token."""
    gh_integration = await db.scalar(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.provider == "github",
        )
    )
    if gh_integration is None or not gh_integration.access_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conecte sua conta via GitHub OAuth para listar seus repositórios.",
        )

    token = decrypt_secret(gh_integration.access_token_encrypted)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token do GitHub inválido. Entre novamente com GitHub OAuth.",
        )

    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            params={"sort": "updated", "per_page": 30, "affiliation": "owner,collaborator"},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível carregar os repositórios do GitHub.",
        )

    monitored = (
        await db.scalars(
            select(MonitoredRepository).where(
                MonitoredRepository.user_id == current_user.id,
                MonitoredRepository.is_active.is_(True),
            )
        )
    ).all()
    monitored_ids = {m.github_repo_id for m in monitored}

    return [
        GitHubRepoItem(
            github_repo_id=int(repo["id"]),
            full_name=str(repo["full_name"]),
            default_branch=str(repo.get("default_branch") or "main"),
            private=bool(repo.get("private", False)),
            is_monitored=int(repo["id"]) in monitored_ids,
        )
        for repo in resp.json()
    ]


@router.put("/github/repos", response_model=list[GitHubRepoItem])
async def update_monitored_repositories(
    payload: MonitoredReposUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GitHubRepoItem]:
    """Save which GitHub repositories should be monitored for automatic project check-ins."""
    existing_rows = (
        await db.scalars(
            select(MonitoredRepository).where(MonitoredRepository.user_id == current_user.id)
        )
    ).all()
    by_repo_id = {row.github_repo_id: row for row in existing_rows}
    selected_ids = {r.github_repo_id for r in payload.repos}

    for row in existing_rows:
        row.is_active = row.github_repo_id in selected_ids
        if payload.target_challenge_id is not None:
            row.target_challenge_id = payload.target_challenge_id

    for sel in payload.repos:
        if sel.github_repo_id in by_repo_id:
            existing = by_repo_id[sel.github_repo_id]
            existing.full_name = sel.full_name
            existing.default_branch = sel.default_branch
            existing.is_active = True
            if payload.target_challenge_id is not None:
                existing.target_challenge_id = payload.target_challenge_id
        else:
            db.add(
                MonitoredRepository(
                    user_id=current_user.id,
                    target_challenge_id=payload.target_challenge_id,
                    github_repo_id=sel.github_repo_id,
                    full_name=sel.full_name,
                    default_branch=sel.default_branch,
                    is_active=True,
                )
            )

    await db.commit()
    return [
        GitHubRepoItem(
            github_repo_id=sel.github_repo_id,
            full_name=sel.full_name,
            default_branch=sel.default_branch,
            private=False,
            is_monitored=True,
        )
        for sel in payload.repos
    ]


@router.post("/sync", response_model=SyncResponse)
async def sync_integrations(
    payload: SyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResponse:
    """Sync recent GitHub commits and LeetCode accepted submissions, or simulate for testing."""
    categories_by_slug = await ensure_default_categories(db)
    integrations = (
        await db.scalars(select(UserIntegration).where(UserIntegration.user_id == current_user.id))
    ).all()
    by_provider = {item.provider: item for item in integrations}

    created_rows: list[CheckIn] = []
    skipped = 0
    details: list[str] = []

    if payload.simulate:
        target = await _resolve_target_challenge(db, current_user.id, payload.challenge_id)
        suffix = secrets.token_hex(3)
        gh_checkin = await publish_checkin(
            db,
            challenge=target,
            user_id=current_user.id,
            category=categories_by_slug["project"],
            title=f"[brainrats] feat: sync automático #{suffix}",
            description="Check-in publicado automaticamente (simulação GitHub). Edite livremente!",
            source="github",
            external_event_id=f"sim-gh-{suffix}",
            metadata_json={"repository": f"{current_user.username}/brainrats", "commits_count": 1},
            evidence_url=f"https://github.com/{current_user.username}/brainrats",
        )
        lc_checkin = await publish_checkin(
            db,
            challenge=target,
            user_id=current_user.id,
            category=categories_by_slug["leetcode"],
            title=f"Two Sum (Simulação #{suffix})",
            description="Submissão Accepted sincronizada automaticamente. Edite se quiser.",
            source="leetcode",
            external_event_id=f"sim-lc-{suffix}",
            metadata_json={
                "difficulty": "Medium",
                "language": "Python3",
                "problem_slug": "two-sum",
            },
            evidence_url="https://leetcode.com/problems/two-sum/",
        )
        for row in (gh_checkin, lc_checkin):
            if row is not None:
                created_rows.append(row)
        details.append("Simulação concluída: 1 commit GitHub e 1 LeetCode Accepted publicados.")
    else:
        gh_integration = by_provider.get("github")
        lc_integration = by_provider.get("leetcode")
        if gh_integration is None and lc_integration is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Configure seu usuário do GitHub ou LeetCode antes de sincronizar.",
            )

        if gh_integration is not None:
            target = await _resolve_target_challenge(
                db, current_user.id, payload.challenge_id or gh_integration.target_challenge_id
            )
            try:
                gh_rows, gh_skipped, gh_detail = await sync_github_integration_for_user(
                    db,
                    user_id=current_user.id,
                    gh_integration=gh_integration,
                    challenge=target,
                    project_category=categories_by_slug["project"],
                    decrypt_fn=decrypt_secret,
                    public_fetcher=_fetch_github_push_commits,
                )
                created_rows.extend(gh_rows)
                skipped += gh_skipped
                details.append(gh_detail)
            except GitHubSyncError as exc:
                details.append(str(exc))
            except Exception:
                logger.exception(
                    "Erro inesperado ao sincronizar GitHub para user_id=%s", current_user.id
                )
                details.append("GitHub: não foi possível consultar commits no momento.")

        if lc_integration is not None:
            target = await _resolve_target_challenge(
                db, current_user.id, payload.challenge_id or lc_integration.target_challenge_id
            )
            today_in_tz = compute_study_date(datetime.now(UTC), target.timezone)
            try:
                submissions = await _fetch_leetcode_submissions(lc_integration.external_username)
                skipped_old = 0
                today_matches = 0
                for sub in submissions:
                    occurred_at = _parse_leetcode_timestamp(sub.get("timestamp"))
                    if not _is_within_today_and_challenge(occurred_at, target, today_in_tz):
                        skipped_old += 1
                        continue
                    today_matches += 1
                    sub_id = str(sub.get("id") or sub.get("timestamp") or "")
                    title = str(sub.get("title") or "Problema LeetCode")
                    slug = str(sub.get("titleSlug") or "")
                    if not sub_id:
                        continue
                    row = await publish_checkin(
                        db,
                        challenge=target,
                        user_id=current_user.id,
                        category=categories_by_slug["leetcode"],
                        title=title,
                        description=None,
                        source="leetcode",
                        external_event_id=sub_id,
                        metadata_json={"difficulty": "Medium", "problem_slug": slug},
                        evidence_url=f"https://leetcode.com/problems/{slug}/" if slug else None,
                        occurred_at=occurred_at,
                    )
                    if row is None:
                        skipped += 1
                    else:
                        created_rows.append(row)
                lc_integration.last_synced_at = datetime.now(UTC)
                lc_name = lc_integration.external_username
                details.append(
                    f"LeetCode ({lc_name}): {today_matches} submissão(ões) de hoje "
                    f"({skipped_old} de dias anteriores ignorada(s))."
                )
            except Exception:
                details.append("LeetCode: não foi possível consultar submissões no momento.")

    await db.commit()
    for row in created_rows:
        await db.refresh(row)

    admin_ids = set(
        (
            await db.scalars(
                select(ChallengeMember.challenge_id).where(
                    ChallengeMember.user_id == current_user.id,
                    ChallengeMember.role == "admin",
                )
            )
        ).all()
    )
    hydrated = await hydrate_checkins(db, created_rows, current_user.id, admin_ids)
    return SyncResponse(
        created_count=len(hydrated),
        skipped_duplicates=skipped,
        details=details,
        created_checkins=hydrated,
    )
