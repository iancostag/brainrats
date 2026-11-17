from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.v1 import integrations as integrations_router
from app.core.database import Base, get_db
from app.core.seed import seed_initial_data
from app.main import create_app


@pytest.fixture
async def mvp_client(tmp_path: Path):
    db_file = tmp_path / "test_mvp.db"
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
    with TestClient(app) as client:
        yield client

    await engine.dispose()


def test_mvp_end_to_end_flow(mvp_client: TestClient) -> None:
    # 1. Login as admin user and member user
    admin_login = mvp_client.post(
        "/api/v1/auth/login",
        json={
            "username": "ian_admin",
            "display_name": "Ian Admin",
            "leetcode_username": "ian_lc",
        },
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    member_login = mvp_client.post(
        "/api/v1/auth/login",
        json={"username": "maria_dev", "display_name": "Maria Dev"},
    )
    assert member_login.status_code == 200
    member_token = member_login.json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 2. Admin creates both a Points challenge and a Check-in challenge
    points_ch_resp = mvp_client.post(
        "/api/v1/challenges",
        headers=admin_headers,
        json={
            "title": "Turma ESW + Dados",
            "visibility": "private",
            "scoring_mode": "points",
            "timezone": "America/Sao_Paulo",
            "rest_days_per_week": 1,
            "daily_points_cap": 100,
        },
    )
    assert points_ch_resp.status_code == 201
    points_ch = points_ch_resp.json()
    assert points_ch["scoring_mode"] == "points"
    assert points_ch["member_role"] == "admin"

    checkin_ch_resp = mvp_client.post(
        "/api/v1/challenges",
        headers=admin_headers,
        json={
            "title": "Desafio Constância Pura",
            "visibility": "public",
            "scoring_mode": "checkin",
            "timezone": "America/Sao_Paulo",
            "rest_days_per_week": 2,
        },
    )
    assert checkin_ch_resp.status_code == 201
    checkin_ch = checkin_ch_resp.json()
    assert checkin_ch["scoring_mode"] == "checkin"

    # 3. Member joins the private challenge using invite_code
    join_resp = mvp_client.post(
        "/api/v1/challenges/join",
        headers=member_headers,
        json={"invite_code": points_ch["invite_code"]},
    )
    assert join_resp.status_code == 200
    assert join_resp.json()["is_member"] is True

    # 4. Member creates LeetCode Hard + Books check-ins in Points challenge
    lc_resp = mvp_client.post(
        f"/api/v1/challenges/{points_ch['id']}/checkins",
        headers=member_headers,
        json={
            "category_slug": "leetcode",
            "title": "Median of Two Sorted Arrays",
            "description": "Busca binária O(log(min(m, n))).",
            "metadata_json": {"difficulty": "Hard", "language": "Python3"},
        },
    )
    assert lc_resp.status_code == 201
    lc_checkin = lc_resp.json()
    assert lc_checkin["points_awarded"] == 35

    books_resp = mvp_client.post(
        f"/api/v1/challenges/{points_ch['id']}/checkins",
        headers=member_headers,
        json={
            "category_slug": "books",
            "title": "Designing Data-Intensive Applications cap 5",
            "metadata_json": {"book_title": "DDIA", "pages_read": 25},
        },
    )
    assert books_resp.status_code == 201
    assert books_resp.json()["points_awarded"] == 25

    # 5. Admin posts 2 check-ins in Check-in mode challenge -> 1st gets 1 pt, 2nd gets 0 pts
    c1 = mvp_client.post(
        f"/api/v1/challenges/{checkin_ch['id']}/checkins",
        headers=admin_headers,
        json={"category_slug": "esw", "title": "Estudei Arquitetura Hexagonal"},
    )
    c2 = mvp_client.post(
        f"/api/v1/challenges/{checkin_ch['id']}/checkins",
        headers=admin_headers,
        json={"category_slug": "data", "title": "Modelagem Star Schema em SQL"},
    )
    assert c1.status_code == 201 and c1.json()["points_awarded"] == 1
    assert c2.status_code == 201 and c2.json()["points_awarded"] == 0

    # 6. Social interactions: react, comment, report, and admin invalidate
    react_resp = mvp_client.post(
        f"/api/v1/checkins/{lc_checkin['id']}/reactions",
        headers=admin_headers,
        json={"reaction_type": "fire"},
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["reactions"]["fire"] == 1

    comment_resp = mvp_client.post(
        f"/api/v1/checkins/{lc_checkin['id']}/comments",
        headers=admin_headers,
        json={"content": "Braba demais!"},
    )
    assert comment_resp.status_code == 200
    assert len(comment_resp.json()["comments"]) == 1

    report_resp = mvp_client.post(
        f"/api/v1/checkins/{lc_checkin['id']}/reports",
        headers=admin_headers,
        json={"reason": "Teste de moderação"},
    )
    assert report_resp.status_code == 200
    assert report_resp.json()["reports_count"] == 1

    # Non-admin cannot moderate
    forbidden_mod = mvp_client.post(
        f"/api/v1/checkins/{lc_checkin['id']}/moderate",
        headers=member_headers,
        json={"action": "invalidate", "reason": "Tentativa inválida"},
    )
    assert forbidden_mod.status_code == 403

    # Admin invalidates -> member's points drop from 60 (35+25) to 25
    mod_resp = mvp_client.post(
        f"/api/v1/checkins/{lc_checkin['id']}/moderate",
        headers=admin_headers,
        json={"action": "invalidate", "reason": "Sem link"},
    )
    assert mod_resp.status_code == 200
    assert mod_resp.json()["status"] == "invalidated"

    detail_resp = mvp_client.get(f"/api/v1/challenges/{points_ch['id']}", headers=admin_headers)
    assert detail_resp.status_code == 200
    leaderboard = detail_resp.json()["leaderboard"]
    maria_entry = next(entry for entry in leaderboard if entry["username"] == "maria_dev")
    assert maria_entry["total_points"] == 25

    # 7. Rest day registration
    rest_resp = mvp_client.post(
        f"/api/v1/challenges/{points_ch['id']}/rest-days",
        headers=admin_headers,
    )
    assert rest_resp.status_code == 200
    assert rest_resp.json()["rest_days_used_this_week"] == 1
    assert rest_resp.json()["rest_days_remaining_this_week"] == 0

    # 8. Diary search
    diary_resp = mvp_client.get("/api/v1/diary?q=Hexagonal", headers=admin_headers)
    assert diary_resp.status_code == 200
    assert diary_resp.json()["total_entries"] == 1
    assert diary_resp.json()["items"][0]["category_slug"] == "esw"

    # 9. Simulated GitHub + LeetCode auto-sync and title/description edit
    sync_resp = mvp_client.post(
        "/api/v1/integrations/sync",
        headers=admin_headers,
        json={"simulate": True, "challenge_id": points_ch["id"]},
    )
    assert sync_resp.status_code == 200
    assert sync_resp.json()["created_count"] == 2
    auto_id = sync_resp.json()["created_checkins"][0]["id"]

    edit_resp = mvp_client.patch(
        f"/api/v1/checkins/{auto_id}",
        headers=admin_headers,
        json={"title": "Implementei auth JWT", "description": "Adicionei notas extras."},
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["title"] == "Implementei auth JWT"


def test_sync_ignores_previous_days_events(
    mvp_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = mvp_client.post(
        "/api/v1/auth/login",
        json={
            "username": "sync_tester",
            "github_username": "sync_tester_gh",
            "leetcode_username": "sync_tester_lc",
        },
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    now = datetime.now(UTC)
    yesterday = now - timedelta(days=1)

    async def fake_gh(_username: str) -> list[dict]:
        return [
            {
                "sha": "sha-today",
                "title": "[repo] Commit de hoje",
                "repo": "sync/repo",
                "url": "https://github.com/sync/repo/commit/sha-today",
                "created_at": now.isoformat(),
            },
            {
                "sha": "sha-yesterday",
                "title": "[repo] Commit antigo",
                "repo": "sync/repo",
                "url": "https://github.com/sync/repo/commit/sha-yesterday",
                "created_at": yesterday.isoformat(),
            },
        ]

    async def fake_lc(_username: str) -> list[dict]:
        return [
            {
                "id": "lc-today",
                "title": "Valid Anagram",
                "titleSlug": "valid-anagram",
                "timestamp": str(int(now.timestamp())),
            },
            {
                "id": "lc-yesterday",
                "title": "Create a DataFrame from List",
                "titleSlug": "create-a-dataframe-from-list",
                "timestamp": str(int(yesterday.timestamp())),
            },
        ]

    monkeypatch.setattr(integrations_router, "_fetch_github_push_commits", fake_gh)
    monkeypatch.setattr(integrations_router, "_fetch_leetcode_submissions", fake_lc)

    sync_resp = mvp_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False},
    )
    assert sync_resp.status_code == 200
    payload = sync_resp.json()
    assert payload["created_count"] == 2
    titles = {item["title"] for item in payload["created_checkins"]}
    assert titles == {"[repo] Commit de hoje", "Valid Anagram"}


def test_password_auth_diary_dates_and_feed_cursor(mvp_client: TestClient) -> None:
    providers = mvp_client.get("/api/v1/auth/providers")
    assert providers.status_code == 200
    assert providers.json()["password_auth_enabled"] is True

    reg = mvp_client.post(
        "/api/v1/auth/register",
        json={
            "username": "secure_dev",
            "password": "my-strong-password",
            "display_name": "Secure Dev",
        },
    )
    assert reg.status_code == 201
    assert reg.json()["user"]["username"] == "secure_dev"

    # Dev passwordless login must reject accounts protected by password
    blocked_dev = mvp_client.post("/api/v1/auth/login", json={"username": "secure_dev"})
    assert blocked_dev.status_code == 401

    wrong_pw = mvp_client.post(
        "/api/v1/auth/password-login",
        json={"username": "secure_dev", "password": "wrong"},
    )
    assert wrong_pw.status_code == 401

    ok_pw = mvp_client.post(
        "/api/v1/auth/password-login",
        json={"username": "secure_dev", "password": "my-strong-password"},
    )
    assert ok_pw.status_code == 200
    headers = {"Authorization": f"Bearer {ok_pw.json()['access_token']}"}

    challenges = mvp_client.get("/api/v1/challenges", headers=headers).json()
    ch_id = challenges[0]["id"]

    # Create 2 check-ins and verify feed cursor `before` + diary date range filter
    c1 = mvp_client.post(
        f"/api/v1/challenges/{ch_id}/checkins",
        headers=headers,
        json={"category_slug": "data", "title": "Query SQL Window Functions"},
    ).json()
    c2 = mvp_client.post(
        f"/api/v1/challenges/{ch_id}/checkins",
        headers=headers,
        json={"category_slug": "esw", "title": "Revisão DDD"},
    ).json()

    page1 = mvp_client.get(
        f"/api/v1/challenges/{ch_id}/feed?limit=1", headers=headers
    ).json()
    assert len(page1) == 1
    assert page1[0]["id"] == c2["id"]

    page2 = mvp_client.get(
        f"/api/v1/challenges/{ch_id}/feed?limit=1&before={page1[0]['created_at']}",
        headers=headers,
    ).json()
    assert len(page2) == 1
    assert page2[0]["id"] == c1["id"]

    future_day = (datetime.now(UTC) + timedelta(days=2)).date().isoformat()
    empty_diary = mvp_client.get(
        f"/api/v1/diary?date_from={future_day}", headers=headers
    ).json()
    assert empty_diary["total_entries"] == 0

    today_day = c1["study_date"]
    filtered_diary = mvp_client.get(
        f"/api/v1/diary?challenge_id={ch_id}&date_from={today_day}&date_to={today_day}",
        headers=headers,
    ).json()
    assert filtered_diary["total_entries"] == 2


def test_sync_allows_same_external_event_across_different_challenges(
    mvp_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    login = mvp_client.post(
        "/api/v1/auth/login",
        json={
            "username": "multi_ch_sync",
            "leetcode_username": "multi_ch_lc",
        },
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    challenges = mvp_client.get("/api/v1/challenges", headers=headers).json()
    ch1_id = challenges[0]["id"]

    ch2_resp = mvp_client.post(
        "/api/v1/challenges",
        headers=headers,
        json={
            "title": "Segundo Desafio LeetCode",
            "description": "Outro desafio ativo",
            "scoring_mode": "checkin",
            "daily_points_cap": 100,
        },
    )
    assert ch2_resp.status_code == 201
    ch2_id = ch2_resp.json()["id"]

    now = datetime.now(UTC)

    async def fake_lc(_username: str) -> list[dict]:
        return [
            {
                "id": "lc-shared-1",
                "title": "Big Countries",
                "titleSlug": "big-countries",
                "timestamp": str(int(now.timestamp())),
            },
        ]

    monkeypatch.setattr(integrations_router, "_fetch_leetcode_submissions", fake_lc)

    # First challenge sync imports the submission
    sync1 = mvp_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False, "challenge_id": ch1_id},
    )
    assert sync1.status_code == 200
    assert sync1.json()["created_count"] == 1

    # Second challenge sync also imports the same submission
    sync2 = mvp_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False, "challenge_id": ch2_id},
    )
    assert sync2.status_code == 200
    assert sync2.json()["created_count"] == 1

    # Re-syncing the second challenge deduplicates within that challenge
    sync2_again = mvp_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False, "challenge_id": ch2_id},
    )
    assert sync2_again.status_code == 200
    assert sync2_again.json()["created_count"] == 0
