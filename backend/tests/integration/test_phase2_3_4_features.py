from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import integrations as integrations_router
from tests.helpers import create_challenge, create_checkin, dev_login


def test_challenge_detail_reports_accurate_user_points_today_beyond_feed_page(
    api_client: TestClient,
) -> None:
    owner_headers = dev_login(api_client, "owner_week")
    other_headers = dev_login(api_client, "spammer_week")
    ch = create_challenge(api_client, owner_headers, "Grupo Ativo", visibility="public")
    api_client.post(
        "/api/v1/challenges/join", headers=other_headers, json={"challenge_id": ch["id"]}
    )

    create_checkin(
        api_client,
        owner_headers,
        ch["id"],
        "Meu Hard LeetCode",
        category_slug="leetcode",
        metadata_json={"difficulty": "Hard"},
    )
    # Flood 32 check-ins from another user so owner's check-in falls off the first 30 feed page.
    for idx in range(32):
        create_checkin(api_client, other_headers, ch["id"], f"Entrega colega #{idx}")

    detail = api_client.get(f"/api/v1/challenges/{ch['id']}", headers=owner_headers).json()
    assert detail["user_points_today"] == 35
    assert len(detail["user_active_dates_this_week"]) == 1
    assert detail["collective_week_checkins"] == 33


def test_leetcode_sync_fetches_and_caches_real_difficulty(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = dev_login(api_client, "lc_hard_user", leetcode_username="lc_pro")
    ch = create_challenge(api_client, headers, "LeetCode Real", scoring_mode="points")
    now_ts = str(int(datetime.now(UTC).timestamp()))
    diff_calls: list[str] = []

    async def fake_subs(_: str) -> list[dict]:
        return [
            {
                "id": "sub-hard-1",
                "title": "Median of Two Sorted Arrays",
                "titleSlug": "median-of-two-sorted-arrays",
                "timestamp": now_ts,
                "lang": "python3",
            }
        ]

    async def fake_diff(slug: str) -> str:
        diff_calls.append(slug)
        return "Hard"

    monkeypatch.setattr(integrations_router, "_fetch_leetcode_submissions", fake_subs)
    monkeypatch.setattr(integrations_router, "_fetch_leetcode_problem_difficulty", fake_diff)

    sync = api_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False, "challenge_id": ch["id"]},
    )
    assert sync.status_code == 200, sync.text
    created = sync.json()["created_checkins"][0]
    assert created["metadata_json"]["difficulty"] == "Hard"
    assert created["points_awarded"] == 35
    assert diff_calls == ["median-of-two-sorted-arrays"]


def test_delete_checkin_promotes_point_in_checkin_mode_and_deletes_comment(
    api_client: TestClient,
) -> None:
    headers = dev_login(api_client, "deleter")
    ch = create_challenge(api_client, headers, "Modo Checkin Delete", scoring_mode="checkin")
    first = create_checkin(api_client, headers, ch["id"], "Primeiro estudo")
    second = create_checkin(api_client, headers, ch["id"], "Segundo estudo")
    assert first["points_awarded"] == 1
    assert second["points_awarded"] == 0

    commented = api_client.post(
        f"/api/v1/checkins/{second['id']}/comments",
        headers=headers,
        json={"content": "Comentário removível"},
    ).json()
    comment_id = commented["comments"][0]["id"]
    del_comment = api_client.delete(f"/api/v1/comments/{comment_id}", headers=headers)
    assert del_comment.status_code == 200
    assert del_comment.json()["comments"] == []

    deleted = api_client.delete(f"/api/v1/checkins/{first['id']}", headers=headers)
    assert deleted.status_code == 200
    feed = api_client.get(f"/api/v1/challenges/{ch['id']}/feed", headers=headers).json()
    assert len(feed) == 1
    assert feed[0]["id"] == second["id"]
    assert feed[0]["points_awarded"] == 1


def test_challenge_management_moderation_presence_nudge_and_summary(
    api_client: TestClient,
) -> None:
    admin_headers = dev_login(api_client, "ch_admin_full")
    member_headers = dev_login(api_client, "ch_member_full")
    member_me = api_client.get("/api/v1/auth/me", headers=member_headers).json()

    ch = create_challenge(api_client, admin_headers, "Gestão Completa", visibility="private")
    preview = api_client.get(
        f"/api/v1/challenges/preview/{ch['invite_code']}", headers=member_headers
    )
    assert preview.status_code == 200
    assert preview.json()["title"] == "Gestão Completa"

    api_client.post(
        "/api/v1/challenges/join",
        headers=member_headers,
        json={"invite_code": ch["invite_code"]},
    )

    updated = api_client.patch(
        f"/api/v1/challenges/{ch['id']}",
        headers=admin_headers,
        json={"title": "Gestão Atualizada", "collective_weekly_goal": 20},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Gestão Atualizada"
    assert updated.json()["collective_weekly_goal"] == 20

    regen = api_client.post(
        f"/api/v1/challenges/{ch['id']}/invite-code/regenerate", headers=admin_headers
    )
    assert regen.status_code == 200
    assert regen.json()["invite_code"] != ch["invite_code"]

    # Presence + nudge
    pres = api_client.post(
        f"/api/v1/challenges/{ch['id']}/presence",
        headers=admin_headers,
        json={"category_slug": "esw", "duration_minutes": 25},
    )
    assert pres.status_code == 200
    nudge = api_client.post(
        f"/api/v1/challenges/{ch['id']}/nudge/{member_me['id']}", headers=admin_headers
    )
    assert nudge.status_code == 201
    dup_nudge = api_client.post(
        f"/api/v1/challenges/{ch['id']}/nudge/{member_me['id']}", headers=admin_headers
    )
    assert dup_nudge.status_code == 409

    # Report queue
    ci = create_checkin(api_client, member_headers, ch["id"], "Estudo membro")
    api_client.post(
        f"/api/v1/checkins/{ci['id']}/reports",
        headers=admin_headers,
        json={"reason": "Verificar evidência"},
    )
    queue = api_client.get(f"/api/v1/challenges/{ch['id']}/reports", headers=admin_headers)
    assert queue.status_code == 200
    assert len(queue.json()) == 1

    # Summary & leave
    summary = api_client.get(f"/api/v1/challenges/{ch['id']}/summary", headers=admin_headers)
    assert summary.status_code == 200
    assert summary.json()["total_checkins"] == 1

    leave = api_client.delete(f"/api/v1/challenges/{ch['id']}/leave", headers=member_headers)
    assert leave.status_code == 200


def test_diary_heatmap_books_recap_export_badges_and_public_profile_svg(
    api_client: TestClient,
) -> None:
    headers = dev_login(api_client, "poly_dev", display_name="Poly <Dev>")
    ch = create_challenge(api_client, headers, "Jornada Completa")
    create_checkin(
        api_client,
        headers,
        ch["id"],
        "DDIA Cap 1",
        category_slug="books",
        metadata_json={"book_title": "Designing Data-Intensive Applications", "pages_read": 120},
    )
    create_checkin(
        api_client,
        headers,
        ch["id"],
        "Merge K Lists",
        category_slug="leetcode",
        metadata_json={"difficulty": "Hard"},
    )

    badges = api_client.get("/api/v1/auth/me/badges", headers=headers).json()
    badge_keys = {b["badge_key"] for b in badges}
    assert {"first_checkin", "bookworm_100p", "first_hard_lc"}.issubset(badge_keys)

    heatmap = api_client.get("/api/v1/diary/heatmap", headers=headers).json()
    assert heatmap["total_active_days"] == 1
    assert heatmap["current_global_streak"] == 1

    books = api_client.get("/api/v1/diary/books", headers=headers).json()
    assert books[0]["book_title"] == "Designing Data-Intensive Applications"
    assert books[0]["total_pages"] == 120

    recap = api_client.get("/api/v1/diary/weekly-recap", headers=headers).json()
    assert recap["total_studies"] == 2
    assert "Dev Log Semanal" in recap["markdown"]

    exported = api_client.get("/api/v1/diary/export?format=markdown", headers=headers)
    assert exported.status_code == 200
    assert "DDIA Cap 1" in exported.text

    # Public profile opt-in (404 before enabling, 200 after)
    assert api_client.get("/api/v1/public/users/poly_dev").status_code == 404
    api_client.patch("/api/v1/auth/me", headers=headers, json={"is_public_profile": True})
    pub = api_client.get("/api/v1/public/users/poly_dev")
    assert pub.status_code == 200
    assert pub.json()["total_studies"] == 2

    svg = api_client.get("/api/v1/public/users/poly_dev/badge.svg")
    assert svg.status_code == 200
    assert "image/svg+xml" in svg.headers["content-type"]
    assert "<script" not in svg.text
