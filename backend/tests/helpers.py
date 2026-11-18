from typing import Any

from fastapi.testclient import TestClient


def dev_login(client: TestClient, username: str, **extra: Any) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "display_name": username.replace("_", " ").title(), **extra},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_challenge(
    client: TestClient,
    headers: dict[str, str],
    title: str,
    **overrides: Any,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": title,
        "visibility": "private",
        "scoring_mode": "points",
        "timezone": "America/Sao_Paulo",
        "rest_days_per_week": 1,
        "daily_points_cap": 100,
    }
    payload.update(overrides)
    response = client.post("/api/v1/challenges", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def join_by_code(client: TestClient, headers: dict[str, str], invite_code: str) -> dict[str, Any]:
    response = client.post(
        "/api/v1/challenges/join",
        headers=headers,
        json={"invite_code": invite_code},
    )
    assert response.status_code == 200, response.text
    return response.json()


def create_checkin(
    client: TestClient,
    headers: dict[str, str],
    challenge_id: str,
    title: str,
    **payload_overrides: Any,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "category_slug": "project",
        "title": title,
        "metadata_json": {},
    }
    payload.update(payload_overrides)
    response = client.post(
        f"/api/v1/challenges/{challenge_id}/checkins",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 201, response.text
    return response.json()
