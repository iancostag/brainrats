import hashlib
import hmac
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.seed import ensure_default_categories
from app.models.challenge import Challenge, ChallengeMember
from app.models.user import MonitoredRepository, UserIntegration
from app.services.badges import evaluate_user_badges
from app.services.checkins import publish_checkin
from app.services.github_sync import parse_github_timestamp
from app.services.scoring import compute_study_date

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

BOT_SUFFIX = "[bot]"


def _verify_github_signature(secret: str, body: bytes, signature_header: str | None) -> bool:
    if not secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def _is_trivial_commit(commit: dict) -> bool:
    message = str(commit.get("message") or "").strip()
    if not message:
        return True
    first_line = message.splitlines()[0].strip().lower()
    if first_line.startswith("merge pull request") or first_line.startswith("merge branch"):
        return True
    author = commit.get("author") or {}
    author_name = str(author.get("name") or "").lower()
    author_user = str(author.get("username") or "").lower()
    if author_name.endswith(BOT_SUFFIX) or author_user.endswith(BOT_SUFFIX):
        return True
    return False


@router.post("/github", status_code=status.HTTP_200_OK)
async def receive_github_webhook(
    request: Request,
    x_github_event: str | None = Header(default=None),
    x_hub_signature_256: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int | str]:
    """Receive signed GitHub push webhooks and publish real-time check-ins for monitored repos."""
    if not settings.github_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook do GitHub não configurado neste servidor.",
        )

    raw_body = await request.body()
    if not _verify_github_signature(settings.github_webhook_secret, raw_body, x_hub_signature_256):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura HMAC do webhook inválida.",
        )

    if x_github_event == "ping":
        return {"status": "pong", "created": 0}
    if x_github_event != "push":
        return {"status": "ignored", "created": 0}

    payload = json.loads(raw_body.decode("utf-8"))
    repo_obj = payload.get("repository") or {}
    repo_id = repo_obj.get("id")
    repo_full_name = str(repo_obj.get("full_name") or "")
    sender_login = str((payload.get("sender") or {}).get("login") or "").strip().lower()
    commits = payload.get("commits") or []
    if not repo_full_name or not commits:
        return {"status": "no_commits", "created": 0}

    monitored_rows = (
        await db.scalars(
            select(MonitoredRepository).where(
                MonitoredRepository.is_active.is_(True),
                (MonitoredRepository.github_repo_id == repo_id)
                if repo_id is not None
                else (MonitoredRepository.full_name == repo_full_name),
            )
        )
    ).all()
    if not monitored_rows:
        return {"status": "no_subscribers", "created": 0}

    categories = await ensure_default_categories(db)
    project_category = categories["project"]
    created_count = 0

    for monitored in monitored_rows:
        integration = await db.scalar(
            select(UserIntegration).where(
                UserIntegration.user_id == monitored.user_id,
                UserIntegration.provider == "github",
            )
        )
        if integration is None:
            continue
        gh_user_lower = integration.external_username.strip().lower()
        target_id = monitored.target_challenge_id or integration.target_challenge_id
        if target_id is None:
            membership = await db.scalar(
                select(ChallengeMember)
                .where(ChallengeMember.user_id == monitored.user_id)
                .order_by(ChallengeMember.joined_at.asc())
                .limit(1)
            )
            target_id = membership.challenge_id if membership else None
        if target_id is None:
            continue

        challenge = await db.scalar(select(Challenge).where(Challenge.id == target_id))
        if challenge is None:
            continue
        today_in_tz = compute_study_date(datetime.now(UTC), challenge.timezone)

        for commit in commits:
            if _is_trivial_commit(commit):
                continue
            author_user = str((commit.get("author") or {}).get("username") or "").strip().lower()
            if author_user and author_user != gh_user_lower and sender_login != gh_user_lower:
                continue
            sha = str(commit.get("id") or "")
            first_line = str(commit.get("message") or "").splitlines()[0].strip()
            if not sha or not first_line:
                continue
            occurred_at = parse_github_timestamp(commit.get("timestamp")) or datetime.now(UTC)
            study_date = compute_study_date(occurred_at, challenge.timezone)
            if (
                study_date != today_in_tz
                or study_date < challenge.start_date
                or (challenge.end_date is not None and study_date > challenge.end_date)
            ):
                continue
            row = await publish_checkin(
                db,
                challenge=challenge,
                user_id=monitored.user_id,
                category=project_category,
                title=f"[{repo_full_name}] {first_line}"[:190],
                description=None,
                source="github",
                external_event_id=sha,
                metadata_json={"repository": repo_full_name, "commits_count": 1},
                evidence_url=commit.get("url")
                or f"https://github.com/{repo_full_name}/commit/{sha}",
                occurred_at=occurred_at,
            )
            if row is not None:
                created_count += 1
                await evaluate_user_badges(
                    db,
                    user_id=monitored.user_id,
                    challenge=challenge,
                    new_checkin=row,
                    category_slug="project",
                )

    await db.commit()
    return {"status": "ok", "created": created_count}
