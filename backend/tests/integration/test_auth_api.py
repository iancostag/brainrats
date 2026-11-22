from fastapi.testclient import TestClient

from tests.helpers import dev_login


def test_health_and_categories_are_available(api_client: TestClient) -> None:
    health = api_client.get("/api/v1/health")
    categories = api_client.get("/api/v1/categories")

    assert health.status_code == 200
    health_body = health.json()
    assert health_body["status"] == "ok"
    assert health_body["app"] == "BrainRats API"
    assert health_body["environment"] == "development"
    # The health payload must expose a parseable UTC timestamp, not a fixed fixture value.
    assert health_body["timestamp"].endswith("Z")
    assert categories.status_code == 200
    assert {item["slug"] for item in categories.json()} == {
        "leetcode",
        "project",
        "books",
        "esw",
        "data",
    }


def test_protected_routes_reject_missing_and_invalid_tokens(api_client: TestClient) -> None:
    missing = api_client.get("/api/v1/auth/me")
    invalid = api_client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"})

    assert missing.status_code == 401
    assert missing.json()["detail"] == "Autenticação necessária."
    assert invalid.status_code == 401
    assert invalid.json()["detail"] == "Token inválido ou expirado."


def test_password_registration_login_profile_and_duplicate_constraints(
    api_client: TestClient,
) -> None:
    registered = api_client.post(
        "/api/v1/auth/register",
        json={
            "username": "  Ada.Lovelace  ",
            "password": "analytical-engine",
            "display_name": "Ada Lovelace",
            "email": " ADA@example.com ",
        },
    )
    assert registered.status_code == 201, registered.text
    assert registered.json()["user"]["username"] == "ada.lovelace"
    assert registered.json()["user"]["email"] == "ada@example.com"

    duplicate_username = api_client.post(
        "/api/v1/auth/register",
        json={"username": "ADA.LOVELACE", "password": "another-password"},
    )
    duplicate_email = api_client.post(
        "/api/v1/auth/register",
        json={
            "username": "different_user",
            "password": "another-password",
            "email": "ada@example.com",
        },
    )
    assert duplicate_username.status_code == 409
    assert duplicate_email.status_code == 409

    wrong = api_client.post(
        "/api/v1/auth/password-login",
        json={"username": "ada.lovelace", "password": "wrong-password"},
    )
    assert wrong.status_code == 401

    login = api_client.post(
        "/api/v1/auth/password-login",
        json={"username": "ADA.LOVELACE", "password": "analytical-engine"},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    updated = api_client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={
            "display_name": "Ada Byron",
            "bio": "  Matemática e programadora.  ",
            "github_username": "ada-github",
            "leetcode_username": "ada-leetcode",
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["display_name"] == "Ada Byron"
    assert body["bio"] == "Matemática e programadora."
    assert {(item["provider"], item["external_username"]) for item in body["integrations"]} == {
        ("github", "ada-github"),
        ("leetcode", "ada-leetcode"),
    }

    me = api_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json() == body


def test_password_account_cannot_use_passwordless_dev_login(api_client: TestClient) -> None:
    created = api_client.post(
        "/api/v1/auth/register",
        json={"username": "secure_person", "password": "long-enough-password"},
    )
    assert created.status_code == 201

    response = api_client.post("/api/v1/auth/login", json={"username": "secure_person"})

    assert response.status_code == 401
    assert "possui senha" in response.json()["detail"]


def test_auth_payload_validation_rejects_short_credentials(api_client: TestClient) -> None:
    short_username = api_client.post(
        "/api/v1/auth/register", json={"username": "x", "password": "long-enough"}
    )
    short_password = api_client.post(
        "/api/v1/auth/register", json={"username": "valid_name", "password": "123"}
    )

    assert short_username.status_code == 422
    assert short_password.status_code == 422


def test_dev_login_creates_default_membership_without_network(api_client: TestClient) -> None:
    headers = dev_login(api_client, "network_free", github_username="does-not-call-github")

    challenges = api_client.get("/api/v1/challenges", headers=headers)

    assert challenges.status_code == 200
    assert any(item["is_member"] for item in challenges.json())


def test_last_challenge_id_persists_across_me_and_enforces_private_membership(
    api_client: TestClient,
) -> None:
    owner_headers = dev_login(api_client, "challenge_owner")
    member_headers = dev_login(api_client, "challenge_member")

    private_ch = api_client.post(
        "/api/v1/challenges",
        headers=owner_headers,
        json={"title": "Privado Owner", "visibility": "private", "scoring_mode": "checkin"},
    )
    assert private_ch.status_code == 201
    private_id = private_ch.json()["id"]

    owner_me = api_client.get("/api/v1/auth/me", headers=owner_headers)
    assert owner_me.status_code == 200
    assert owner_me.json()["last_challenge_id"] == private_id

    forbidden = api_client.patch(
        "/api/v1/auth/me",
        headers=member_headers,
        json={"last_challenge_id": private_id},
    )
    assert forbidden.status_code == 403

    public_list = api_client.get("/api/v1/challenges", headers=member_headers).json()
    second_id = public_list[1]["id"]
    updated = api_client.patch(
        "/api/v1/auth/me",
        headers=member_headers,
        json={"last_challenge_id": second_id},
    )
    assert updated.status_code == 200
    assert updated.json()["last_challenge_id"] == second_id

    member_me = api_client.get("/api/v1/auth/me", headers=member_headers)
    assert member_me.status_code == 200
    assert member_me.json()["last_challenge_id"] == second_id
