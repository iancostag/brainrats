from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import encrypt_secret
from app.core.seed import seed_initial_data
from app.main import create_app
from app.models.user import MonitoredRepository, User, UserIntegration
from app.services import github_sync


def _make_commit_item(
    sha: str,
    message: str,
    *,
    author_login: str | None,
    committer_login: str | None = None,
    date_iso: str,
    repo: str = "ian/brainrats",
) -> dict:
    return {
        "sha": sha,
        "html_url": f"https://github.com/{repo}/commit/{sha}",
        "author": {"login": author_login} if author_login else None,
        "committer": {"login": committer_login} if committer_login else None,
        "commit": {
            "message": message,
            "author": {"date": date_iso},
            "committer": {"date": date_iso},
        },
    }


async def test_fetch_events_resolves_compare_without_payload_commits() -> None:
    now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/users/iancostag/events/public":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "1",
                        "type": "PushEvent",
                        "repo": {"name": "org/app"},
                        "created_at": now_iso,
                        "payload": {
                            "ref": "refs/heads/dev",
                            "before": "aaa111",
                            "head": "bbb222",
                        },
                    }
                ],
            )
        if path == "/repos/org/app/compare/aaa111...bbb222":
            return httpx.Response(
                200,
                json={
                    "commits": [
                        _make_commit_item(
                            "sha-ian",
                            "feat: add github sync\n\nextra details",
                            author_login="iancostag",
                            committer_login="iancostag",
                            date_iso=now_iso,
                            repo="org/app",
                        ),
                        _make_commit_item(
                            "sha-teammate",
                            "chore: teammate commit",
                            author_login="teammate",
                            committer_login="teammate",
                            date_iso=now_iso,
                            repo="org/app",
                        ),
                        _make_commit_item(
                            "sha-unlinked",
                            "fix: local git email commit",
                            author_login=None,
                            committer_login=None,
                            date_iso=now_iso,
                            repo="org/app",
                        ),
                    ]
                },
            )
        return httpx.Response(404)

    commits = await github_sync.fetch_github_events_commits(
        "iancostag",
        transport=httpx.MockTransport(handler),
    )

    assert [c["sha"] for c in commits] == ["sha-ian", "sha-unlinked"]
    assert commits[0]["title"] == "[org/app] feat: add github sync"
    assert commits[0]["url"] == "https://github.com/org/app/commit/sha-ian"


async def test_fetch_events_falls_back_to_head_commit_for_new_branch_or_404_compare() -> None:
    now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/users/iancostag/events/public":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "1",
                        "type": "PushEvent",
                        "repo": {"name": "iancostag/new-repo"},
                        "created_at": now_iso,
                        "payload": {
                            "ref": "refs/heads/feat-x",
                            "before": github_sync.ZERO_SHA,
                            "head": "head-new-branch",
                        },
                    },
                    {
                        "id": "2",
                        "type": "PushEvent",
                        "repo": {"name": "iancostag/rebased"},
                        "created_at": now_iso,
                        "payload": {
                            "ref": "refs/heads/main",
                            "before": "old-force-pushed",
                            "head": "head-rebased",
                        },
                    },
                ],
            )
        if path == "/repos/iancostag/rebased/compare/old-force-pushed...head-rebased":
            return httpx.Response(404)
        if path == "/repos/iancostag/new-repo/commits/head-new-branch":
            return httpx.Response(
                200,
                json=_make_commit_item(
                    "head-new-branch",
                    "init: first commit on branch",
                    author_login="iancostag",
                    date_iso=now_iso,
                    repo="iancostag/new-repo",
                ),
            )
        if path == "/repos/iancostag/rebased/commits/head-rebased":
            return httpx.Response(
                200,
                json=_make_commit_item(
                    "head-rebased",
                    "fix: rebased commit",
                    author_login="iancostag",
                    date_iso=now_iso,
                    repo="iancostag/rebased",
                ),
            )
        return httpx.Response(404)

    commits = await github_sync.fetch_github_events_commits(
        "iancostag",
        transport=httpx.MockTransport(handler),
    )

    assert [c["sha"] for c in commits] == ["head-new-branch", "head-rebased"]


@pytest.mark.parametrize(
    ("status_code", "expected_fragment"),
    [
        (401, "token OAuth expirado ou inválido"),
        (403, "rate limit"),
        (404, "não encontrado"),
    ],
)
async def test_fetch_events_raises_actionable_errors(
    status_code: int, expected_fragment: str
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code)

    with pytest.raises(github_sync.GitHubSyncError, match=expected_fragment):
        await github_sync.fetch_github_events_commits(
            "unknown_user",
            transport=httpx.MockTransport(handler),
        )


async def test_oauth_monitored_repos_combines_default_branch_and_push_events(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_file = tmp_path / "test_oauth_sync.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with session_factory() as session:
        await seed_initial_data(session)

    app = create_app()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    captured_since: list[str] = []

    async def fake_repo_commits(
        full_name: str,
        author: str,
        access_token: str,
        since_iso: str,
        *,
        branch: str | None = None,
    ) -> list[dict]:
        assert full_name == "ian/private-app"
        assert author == "iancostag"
        assert access_token == "gho_secret_token"
        assert branch == "main"
        captured_since.append(since_iso)
        return [
            {
                "sha": "sha-main-1",
                "title": "[ian/private-app] feat: main branch commit",
                "repo": "ian/private-app",
                "url": "https://github.com/ian/private-app/commit/sha-main-1",
                "created_at": now_iso,
            }
        ]

    async def fake_events_commits(
        github_username: str,
        *,
        access_token: str | None = None,
        repo_filter: set[str] | None = None,
    ) -> list[dict]:
        assert github_username == "iancostag"
        assert access_token == "gho_secret_token"
        assert repo_filter == {"ian/private-app"}
        return [
            {
                "sha": "sha-main-1",  # duplicate across /commits and /events
                "title": "[ian/private-app] feat: main branch commit",
                "repo": "ian/private-app",
                "url": "https://github.com/ian/private-app/commit/sha-main-1",
                "created_at": now_iso,
            },
            {
                "sha": "sha-dev-2",
                "title": "[ian/private-app] feat: dev branch commit",
                "repo": "ian/private-app",
                "url": "https://github.com/ian/private-app/commit/sha-dev-2",
                "created_at": now_iso,
            },
        ]

    monkeypatch.setattr(github_sync, "fetch_repo_commits_with_token", fake_repo_commits)
    monkeypatch.setattr(github_sync, "fetch_github_events_commits", fake_events_commits)

    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"username": "ian_oauth", "github_username": "iancostag"},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        async with session_factory() as session:
            user = await session.scalar(select(User).where(User.username == "ian_oauth"))
            assert user is not None
            gh_int = await session.scalar(
                select(UserIntegration).where(
                    UserIntegration.user_id == user.id,
                    UserIntegration.provider == "github",
                )
            )
            assert gh_int is not None
            gh_int.access_token_encrypted = encrypt_secret("gho_secret_token")
            session.add(
                MonitoredRepository(
                    user_id=user.id,
                    github_repo_id=12345,
                    full_name="ian/private-app",
                    default_branch="main",
                    is_active=True,
                )
            )
            await session.commit()

        resp = client.post("/api/v1/integrations/sync", headers=headers, json={"simulate": False})
        assert resp.status_code == 200
        data = resp.json()
        assert data["created_count"] == 2
        assert data["skipped_duplicates"] == 0
        assert {c["title"] for c in data["created_checkins"]} == {
            "[ian/private-app] feat: main branch commit",
            "[ian/private-app] feat: dev branch commit",
        }
        assert len(captured_since) == 1

    await engine.dispose()


@pytest.mark.asyncio
async def test_oauth_sync_without_monitored_repos_queries_recent_pushed_repos(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_file = tmp_path / "test_oauth_recent_repos.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with session_factory() as session:
        await seed_initial_data(session)

    app = create_app()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    now_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")

    async def fake_events_commits(*_args, **_kwargs) -> list[dict]:
        return []

    async def fake_recent_repos(_token: str, **_kwargs) -> list[tuple[str, str]]:
        return [("iancostag/brainrats", "main")]

    async def fake_repo_commits(
        full_name: str, _author: str, _token: str, _since_iso: str, *, branch: str | None = None
    ) -> list[dict]:
        assert full_name == "iancostag/brainrats"
        assert branch == "main"
        return [
            {
                "sha": "sha-recent-1",
                "title": "[iancostag/brainrats] feat: realtime commit",
                "repo": "iancostag/brainrats",
                "url": "https://github.com/iancostag/brainrats/commit/sha-recent-1",
                "created_at": now_iso,
            }
        ]

    monkeypatch.setattr(github_sync, "fetch_github_events_commits", fake_events_commits)
    monkeypatch.setattr(github_sync, "fetch_recent_pushed_repos", fake_recent_repos)
    monkeypatch.setattr(github_sync, "fetch_repo_commits_with_token", fake_repo_commits)

    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"username": "ian_recent", "github_username": "iancostag"},
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        async with session_factory() as session:
            user = await session.scalar(select(User).where(User.username == "ian_recent"))
            assert user is not None
            gh_int = await session.scalar(
                select(UserIntegration).where(
                    UserIntegration.user_id == user.id,
                    UserIntegration.provider == "github",
                )
            )
            assert gh_int is not None
            gh_int.access_token_encrypted = encrypt_secret("gho_secret_token")
            await session.commit()

        resp = client.post("/api/v1/integrations/sync", headers=headers, json={"simulate": False})
        assert resp.status_code == 200
        data = resp.json()
        assert data["created_count"] == 1
        assert data["created_checkins"][0]["title"] == "[iancostag/brainrats] feat: realtime commit"

    await engine.dispose()
