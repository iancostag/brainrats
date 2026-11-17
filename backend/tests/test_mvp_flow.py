from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

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
