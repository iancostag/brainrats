from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from tests.helpers import create_challenge, create_checkin, dev_login, join_by_code


def test_private_challenge_requires_membership_for_detail_feed_and_actions(
    api_client: TestClient,
) -> None:
    admin = dev_login(api_client, "private_admin")
    member = dev_login(api_client, "private_member")
    outsider = dev_login(api_client, "private_outsider")
    challenge = create_challenge(api_client, admin, "Grupo Privado de Teste")

    assert (
        api_client.get(f"/api/v1/challenges/{challenge['id']}", headers=outsider).status_code == 403
    )
    assert (
        api_client.get(f"/api/v1/challenges/{challenge['id']}/feed", headers=outsider).status_code
        == 403
    )
    forbidden_post = api_client.post(
        f"/api/v1/challenges/{challenge['id']}/checkins",
        headers=outsider,
        json={"category_slug": "project", "title": "Não deveria entrar"},
    )
    assert forbidden_post.status_code == 403

    joined = join_by_code(api_client, member, challenge["invite_code"])
    assert joined["member_role"] == "member"
    assert (
        api_client.get(f"/api/v1/challenges/{challenge['id']}", headers=member).status_code == 200
    )


def test_challenge_creation_validates_dates_timezone_and_checkin_daily_cap(
    api_client: TestClient,
) -> None:
    headers = dev_login(api_client, "challenge_admin")
    today = datetime.now(UTC).date()

    invalid_timezone = api_client.post(
        "/api/v1/challenges",
        headers=headers,
        json={"title": "Fuso Inválido", "timezone": "Mars/Olympus"},
    )
    invalid_dates = api_client.post(
        "/api/v1/challenges",
        headers=headers,
        json={
            "title": "Datas Inválidas",
            "start_date": today.isoformat(),
            "end_date": (today - timedelta(days=1)).isoformat(),
        },
    )
    checkin_mode = create_challenge(
        api_client,
        headers,
        "Constância Sem Pontos",
        scoring_mode="checkin",
        daily_points_cap=999,
    )

    assert invalid_timezone.status_code == 400
    assert invalid_dates.status_code == 400
    assert checkin_mode["daily_points_cap"] == 1


def test_points_mode_applies_metadata_weights_and_daily_caps(api_client: TestClient) -> None:
    headers = dev_login(api_client, "points_member")
    challenge = create_challenge(
        api_client,
        headers,
        "Pontos com Tetos",
        daily_points_cap=45,
        category_configs=[
            {
                "category_slug": "leetcode",
                "is_enabled": True,
                "base_points": 10,
                "daily_cap": 40,
            }
        ],
    )

    hard = create_checkin(
        api_client,
        headers,
        challenge["id"],
        "Problema difícil",
        category_slug="leetcode",
        metadata_json={"difficulty": "Hard"},
    )
    second = create_checkin(
        api_client,
        headers,
        challenge["id"],
        "Outro problema difícil",
        category_slug="leetcode",
        metadata_json={"difficulty": "Hard"},
    )
    project = create_checkin(
        api_client,
        headers,
        challenge["id"],
        "Projeto depois do teto",
        category_slug="project",
        metadata_json={"duration_minutes": 60},
    )

    assert hard["points_awarded"] == 35
    assert second["points_awarded"] == 5  # category cap: 40
    assert project["points_awarded"] == 5  # global cap: 45

    detail = api_client.get(f"/api/v1/challenges/{challenge['id']}", headers=headers)
    mine = next(
        item for item in detail.json()["leaderboard"] if item["username"] == "points_member"
    )
    assert mine["total_points"] == 45
    assert mine["checkins_count"] == 3
    assert mine["active_days"] == 1


def test_disabled_category_is_rejected(api_client: TestClient) -> None:
    headers = dev_login(api_client, "disabled_category")
    challenge = create_challenge(
        api_client,
        headers,
        "Categoria Desativada",
        category_configs=[
            {
                "category_slug": "books",
                "is_enabled": False,
                "base_points": 15,
                "daily_cap": 40,
            }
        ],
    )

    response = api_client.post(
        f"/api/v1/challenges/{challenge['id']}/checkins",
        headers=headers,
        json={"category_slug": "books", "title": "Livro bloqueado"},
    )

    assert response.status_code == 400
    assert "não está habilitada" in response.json()["detail"]


def test_feed_cursor_and_invalidated_filter_return_real_rows(api_client: TestClient) -> None:
    admin = dev_login(api_client, "feed_admin")
    challenge = create_challenge(api_client, admin, "Feed Paginado")
    first = create_checkin(api_client, admin, challenge["id"], "Primeiro estudo")
    second = create_checkin(api_client, admin, challenge["id"], "Segundo estudo")

    page_one = api_client.get(f"/api/v1/challenges/{challenge['id']}/feed?limit=1", headers=admin)
    assert page_one.status_code == 200
    assert [item["id"] for item in page_one.json()] == [second["id"]]

    page_two = api_client.get(
        f"/api/v1/challenges/{challenge['id']}/feed",
        headers=admin,
        params={"limit": 1, "before": page_one.json()[0]["created_at"]},
    )
    assert page_two.status_code == 200
    assert [item["id"] for item in page_two.json()] == [first["id"]]

    invalidated = api_client.post(
        f"/api/v1/checkins/{second['id']}/moderate",
        headers=admin,
        json={"action": "invalidate", "reason": "Registro inválido"},
    )
    assert invalidated.status_code == 200

    valid_only = api_client.get(
        f"/api/v1/challenges/{challenge['id']}/feed?include_invalidated=false",
        headers=admin,
    )
    assert second["id"] not in {item["id"] for item in valid_only.json()}
    assert first["id"] in {item["id"] for item in valid_only.json()}
