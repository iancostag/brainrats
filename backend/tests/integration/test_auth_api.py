from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
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


def test_github_oauth_link_attaches_to_existing_account_and_disconnects(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = dev_login(api_client, "different_local_name", leetcode_username="lc_user")
    monkeypatch.setattr(settings, "github_client_id", "gh-client-id")
    monkeypatch.setattr(settings, "github_client_secret", "gh-client-secret")

    link_resp = api_client.post(
        "/api/v1/auth/github/link",
        headers=headers,
        json={"redirect_tab": "settings"},
    )
    assert link_resp.status_code == 200
    auth_url = urlparse(link_resp.json()["url"])
    state = parse_qs(auth_url.query)["state"][0]

    def gh_handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "github.com" and request.url.path == "/login/oauth/access_token":
            return httpx.Response(200, json={"access_token": "gho_linked_token"})
        if request.url.host == "api.github.com" and request.url.path == "/user":
            return httpx.Response(
                200,
                json={"id": 987654, "login": "OctoDev", "name": "Octo Dev", "email": "octo@ex.com"},
            )
        return httpx.Response(404)

    real_async_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda *args, **kwargs: real_async_client(
            *args, transport=httpx.MockTransport(gh_handler), **kwargs
        ),
    )

    callback_resp = api_client.get(
        f"/api/v1/auth/github/callback?code=abc&state={state}",
        follow_redirects=False,
    )
    assert callback_resp.status_code == 307
    location = callback_resp.headers["location"]
    assert "tab=settings" in location
    assert "oauth_linked=1" in location

    me_after = api_client.get("/api/v1/auth/me", headers=headers).json()
    assert me_after["username"] == "different_local_name"
    assert me_after["has_github_oauth"] is True
    assert {i["provider"]: i["external_username"] for i in me_after["integrations"]} == {
        "github": "OctoDev",
        "leetcode": "lc_user",
    }

    # Another user cannot steal the already-linked GitHub ID.
    other_headers = dev_login(api_client, "second_account")
    other_link = api_client.post("/api/v1/auth/github/link", headers=other_headers).json()["url"]
    other_state = parse_qs(urlparse(other_link).query)["state"][0]
    conflict_resp = api_client.get(
        f"/api/v1/auth/github/callback?code=abc&state={other_state}",
        follow_redirects=False,
    )
    assert conflict_resp.status_code == 307
    assert "oauth_error=github_already_linked" in conflict_resp.headers["location"]

    # Clearing leetcode via PATCH "" and disconnecting GitHub via DELETE both remove cleanly.
    cleared_lc = api_client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"leetcode_username": ""},
    )
    assert cleared_lc.status_code == 200
    assert [i["provider"] for i in cleared_lc.json()["integrations"]] == ["github"]

    disconnected_gh = api_client.delete("/api/v1/auth/me/integrations/github", headers=headers)
    assert disconnected_gh.status_code == 200
    assert disconnected_gh.json()["has_github_oauth"] is False
    assert disconnected_gh.json()["integrations"] == []
