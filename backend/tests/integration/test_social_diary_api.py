from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from tests.helpers import create_challenge, create_checkin, dev_login, join_by_code


def test_reactions_toggle_and_comments_are_hydrated_in_feed(api_client: TestClient) -> None:
    admin = dev_login(api_client, "social_admin")
    member = dev_login(api_client, "social_member")
    challenge = create_challenge(api_client, admin, "Interações Sociais")
    join_by_code(api_client, member, challenge["invite_code"])
    checkin = create_checkin(api_client, member, challenge["id"], "Estudo compartilhado")

    added = api_client.post(
        f"/api/v1/checkins/{checkin['id']}/reactions",
        headers=admin,
        json={"reaction_type": "fire"},
    )
    assert added.status_code == 200
    assert added.json()["reactions"]["fire"] == 1
    assert "fire" in added.json()["user_reactions"]

    removed = api_client.post(
        f"/api/v1/checkins/{checkin['id']}/reactions",
        headers=admin,
        json={"reaction_type": "fire"},
    )
    assert removed.status_code == 200
    assert removed.json()["reactions"]["fire"] == 0
    assert "fire" not in removed.json()["user_reactions"]

    comment = api_client.post(
        f"/api/v1/checkins/{checkin['id']}/comments",
        headers=admin,
        json={"content": "  Excelente resumo!  "},
    )
    assert comment.status_code == 200
    assert comment.json()["comments"][0]["content"] == "Excelente resumo!"
    assert comment.json()["comments"][0]["username"] == "social_admin"

    invalid_reaction = api_client.post(
        f"/api/v1/checkins/{checkin['id']}/reactions",
        headers=admin,
        json={"reaction_type": "like"},
    )
    assert invalid_reaction.status_code == 422


def test_report_details_are_visible_only_to_admin(api_client: TestClient) -> None:
    admin = dev_login(api_client, "report_admin")
    author = dev_login(api_client, "report_author")
    reporter = dev_login(api_client, "report_member")
    challenge = create_challenge(api_client, admin, "Moderação Privada")
    join_by_code(api_client, author, challenge["invite_code"])
    join_by_code(api_client, reporter, challenge["invite_code"])
    checkin = create_checkin(api_client, author, challenge["id"], "Atividade suspeita")

    report = api_client.post(
        f"/api/v1/checkins/{checkin['id']}/reports",
        headers=reporter,
        json={"reason": "Possível registro duplicado"},
    )
    assert report.status_code == 200
    assert report.json()["reports_count"] == 1
    assert report.json()["reports"] == []

    admin_feed = api_client.get(f"/api/v1/challenges/{challenge['id']}/feed", headers=admin)
    admin_item = next(item for item in admin_feed.json() if item["id"] == checkin["id"])
    assert admin_item["reports"][0]["reporter_username"] == "report_member"
    assert admin_item["reports"][0]["reason"] == "Possível registro duplicado"

    author_feed = api_client.get(f"/api/v1/challenges/{challenge['id']}/feed", headers=author)
    author_item = next(item for item in author_feed.json() if item["id"] == checkin["id"])
    assert author_item["reports_count"] == 1
    assert author_item["reports"] == []


def test_checkin_mode_invalidation_promotes_replacement_and_restore_keeps_one_point(
    api_client: TestClient,
) -> None:
    admin = dev_login(api_client, "checkin_admin")
    member = dev_login(api_client, "checkin_member")
    challenge = create_challenge(
        api_client,
        admin,
        "Promoção de Check-in",
        scoring_mode="checkin",
        daily_points_cap=1,
    )
    join_by_code(api_client, member, challenge["invite_code"])
    first = create_checkin(api_client, member, challenge["id"], "Primeiro check-in")
    second = create_checkin(api_client, member, challenge["id"], "Segundo check-in")
    assert first["points_awarded"] == 1
    assert second["points_awarded"] == 0

    invalidated = api_client.post(
        f"/api/v1/checkins/{first['id']}/moderate",
        headers=admin,
        json={"action": "invalidate", "reason": "Duplicado"},
    )
    assert invalidated.status_code == 200

    after_invalidation = api_client.get(
        f"/api/v1/challenges/{challenge['id']}/feed", headers=member
    ).json()
    by_id = {item["id"]: item for item in after_invalidation}
    assert by_id[first["id"]]["status"] == "invalidated"
    assert by_id[second["id"]]["points_awarded"] == 1

    restored = api_client.post(
        f"/api/v1/checkins/{first['id']}/moderate",
        headers=admin,
        json={"action": "restore"},
    )
    assert restored.status_code == 200
    assert restored.json()["status"] == "valid"
    assert restored.json()["points_awarded"] == 0

    detail = api_client.get(f"/api/v1/challenges/{challenge['id']}", headers=member).json()
    mine = next(item for item in detail["leaderboard"] if item["username"] == "checkin_member")
    assert mine["total_points"] == 1
    assert mine["checkins_count"] == 2


def test_rest_day_is_idempotent_and_enforces_membership(api_client: TestClient) -> None:
    admin = dev_login(api_client, "rest_admin")
    member = dev_login(api_client, "rest_member")
    outsider = dev_login(api_client, "rest_outsider")
    challenge = create_challenge(api_client, admin, "Descanso Sustentável", rest_days_per_week=1)
    join_by_code(api_client, member, challenge["invite_code"])

    first = api_client.post(f"/api/v1/challenges/{challenge['id']}/rest-days", headers=member)
    repeated = api_client.post(f"/api/v1/challenges/{challenge['id']}/rest-days", headers=member)
    forbidden = api_client.post(f"/api/v1/challenges/{challenge['id']}/rest-days", headers=outsider)

    assert first.status_code == 200
    assert repeated.status_code == 200
    assert first.json() == repeated.json()
    assert first.json()["rest_days_used_this_week"] == 1
    assert first.json()["rest_days_remaining_this_week"] == 0
    assert forbidden.status_code == 403


def test_diary_filters_and_counts_only_valid_max_points_per_study(api_client: TestClient) -> None:
    headers = dev_login(api_client, "diary_owner")
    challenge = create_challenge(api_client, headers, "Diário Pesquisável")
    unique = create_checkin(
        api_client,
        headers,
        challenge["id"],
        "Arquitetura orientada a eventos",
        category_slug="esw",
        description="Filas, consumidores e idempotência",
        metadata_json={"topic": "Eventos", "duration_minutes": 60},
    )
    create_checkin(
        api_client,
        headers,
        challenge["id"],
        "Janela e agregações SQL",
        category_slug="data",
    )

    search = api_client.get("/api/v1/diary", headers=headers, params={"q": "idempotência"})
    category = api_client.get("/api/v1/diary", headers=headers, params={"category_slug": "esw"})
    source = api_client.get("/api/v1/diary", headers=headers, params={"source": "manual"})
    future = (datetime.now(UTC) + timedelta(days=2)).date().isoformat()
    empty = api_client.get("/api/v1/diary", headers=headers, params={"date_from": future})

    assert search.status_code == 200
    assert [item["id"] for item in search.json()["items"]] == [unique["id"]]
    assert category.json()["by_category"] == {"esw": 1}
    assert source.json()["total_entries"] >= 2
    assert empty.json() == {
        "items": [],
        "total_entries": 0,
        "total_points": 0,
        "by_category": {},
    }
