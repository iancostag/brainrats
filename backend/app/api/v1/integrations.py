import secrets
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.seed import ensure_default_categories
from app.models.challenge import Challenge, ChallengeMember
from app.models.checkin import CheckIn
from app.models.user import User, UserIntegration
from app.schemas.checkin import SyncRequest, SyncResponse
from app.services.checkins import hydrate_checkins, publish_checkin

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


async def _fetch_github_push_commits(github_username: str) -> list[dict]:
    commits: list[dict] = []
    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.get(
            f"https://api.github.com/users/{github_username}/events/public",
            headers={"Accept": "application/vnd.github+json"},
        )
        if resp.status_code != 200:
            return commits
        for event in resp.json():
            if event.get("type") != "PushEvent":
                continue
            repo_name = (event.get("repo") or {}).get("name", "github-repo")
            payload = event.get("payload") or {}
            created_at = event.get("created_at")
            for commit in payload.get("commits", []):
                sha = commit.get("sha")
                message = (commit.get("message") or "").splitlines()[0].strip()
                if sha and message:
                    commits.append(
                        {
                            "sha": sha,
                            "title": f"[{repo_name}] {message}"[:190],
                            "repo": repo_name,
                            "url": f"https://github.com/{repo_name}/commit/{sha}",
                            "created_at": created_at,
                        }
                    )
            if len(commits) >= 5:
                break
    return commits[:5]


async def _fetch_leetcode_submissions(leetcode_username: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.post(
            LEETCODE_GRAPHQL_URL,
            json={
                "query": LEETCODE_RECENT_AC_QUERY,
                "variables": {"username": leetcode_username, "limit": 5},
            },
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            return []
        data = resp.json().get("data") or {}
        return data.get("recentAcSubmissionList") or []


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
                commits = await _fetch_github_push_commits(gh_integration.external_username)
                for item in commits:
                    row = await publish_checkin(
                        db,
                        challenge=target,
                        user_id=current_user.id,
                        category=categories_by_slug["project"],
                        title=item["title"],
                        description=None,
                        source="github",
                        external_event_id=item["sha"],
                        metadata_json={"repository": item["repo"], "commits_count": 1},
                        evidence_url=item["url"],
                    )
                    if row is None:
                        skipped += 1
                    else:
                        created_rows.append(row)
                gh_integration.last_synced_at = datetime.now(UTC)
                gh_name = gh_integration.external_username
                details.append(f"GitHub ({gh_name}): {len(commits)} commits analisados.")
            except Exception:
                details.append("GitHub: não foi possível consultar eventos públicos no momento.")

        if lc_integration is not None:
            target = await _resolve_target_challenge(
                db, current_user.id, payload.challenge_id or lc_integration.target_challenge_id
            )
            try:
                submissions = await _fetch_leetcode_submissions(lc_integration.external_username)
                for sub in submissions:
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
                    )
                    if row is None:
                        skipped += 1
                    else:
                        created_rows.append(row)
                lc_integration.last_synced_at = datetime.now(UTC)
                lc_name = lc_integration.external_username
                details.append(
                    f"LeetCode ({lc_name}): {len(submissions)} submissões analisadas."
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
