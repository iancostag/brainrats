import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import DEFAULT_DEV_JWT_SECRET, Settings, settings
from tests.helpers import create_challenge, create_checkin, dev_login


def test_evidence_url_blocks_javascript_and_data_schemes(api_client: TestClient) -> None:
    headers = dev_login(api_client, "xss_tester")
    ch = create_challenge(api_client, headers, "Segurança XSS")

    for bad_url in (
        "javascript:alert(1)",
        "JAVASCRIPT:fetch('https://evil.test')",
        "data:text/html,<script>alert(1)</script>",
    ):
        resp = api_client.post(
            f"/api/v1/challenges/{ch['id']}/checkins",
            headers=headers,
            json={
                "category_slug": "project",
                "title": "Tentativa XSS",
                "evidence_url": bad_url,
            },
        )
        assert resp.status_code == 422, f"Expected 422 for {bad_url}, got {resp.status_code}"

    good = api_client.post(
        f"/api/v1/challenges/{ch['id']}/checkins",
        headers=headers,
        json={
            "category_slug": "project",
            "title": "Link válido",
            "evidence_url": "https://github.com/octocat/hello-world",
        },
    )
    assert good.status_code == 201


def test_github_oauth_prevents_username_takeover_and_uses_one_time_exchange_code(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Existing password-protected user owns username "alice" without GitHub linked.
    reg = api_client.post(
        "/api/v1/auth/register",
        json={"username": "alice", "password": "strong-password-123"},
    )
    assert reg.status_code == 201
    victim_id = reg.json()["user"]["id"]

    monkeypatch.setattr(settings, "github_client_id", "gh-id")
    monkeypatch.setattr(settings, "github_client_secret", "gh-secret")

    login_redirect = api_client.get("/api/v1/auth/github/login", follow_redirects=False)
    assert login_redirect.status_code == 307
    auth_qs = parse_qs(urlparse(login_redirect.headers["location"]).query)
    assert auth_qs["scope"][0] == "read:user user:email"
    state = auth_qs["state"][0]

    def gh_handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "github.com" and request.url.path == "/login/oauth/access_token":
            return httpx.Response(200, json={"access_token": "gho_attacker_token"})
        if request.url.host == "api.github.com" and request.url.path == "/user":
            return httpx.Response(
                200,
                json={"id": 424242, "login": "alice", "name": "GitHub Alice", "email": None},
            )
        if request.url.host == "api.github.com" and request.url.path == "/user/emails":
            return httpx.Response(200, json=[])
        return httpx.Response(404)

    real_async_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda *args, **kwargs: real_async_client(
            *args, transport=httpx.MockTransport(gh_handler), **kwargs
        ),
    )

    callback = api_client.get(
        f"/api/v1/auth/github/callback?code=ghcode&state={state}",
        follow_redirects=False,
    )
    assert callback.status_code == 307
    location = callback.headers["location"]
    assert "token=" not in location
    oauth_code = parse_qs(urlparse(location).query)["oauth_code"][0]

    exchanged = api_client.post("/api/v1/auth/oauth/exchange", json={"code": oauth_code})
    assert exchanged.status_code == 200, exchanged.text
    oauth_user = exchanged.json()["user"]
    assert oauth_user["id"] != victim_id
    assert oauth_user["username"] != "alice"

    # Reusing the single-use code must fail.
    reused = api_client.post("/api/v1/auth/oauth/exchange", json={"code": oauth_code})
    assert reused.status_code == 400


def test_simulate_sync_blocked_in_production(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = dev_login(api_client, "prod_sim_tester")
    ch = create_challenge(api_client, headers, "Desafio Prod")

    monkeypatch.setattr(settings, "environment", "production")
    resp = api_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": True, "challenge_id": ch["id"]},
    )
    assert resp.status_code == 403


def test_manual_checkin_rejects_future_or_ended_challenge(api_client: TestClient) -> None:
    headers = dev_login(api_client, "date_bounds_user")
    tomorrow = (datetime.now(UTC).date() + timedelta(days=2)).isoformat()
    future_ch = create_challenge(api_client, headers, "Futuro", start_date=tomorrow)

    resp = api_client.post(
        f"/api/v1/challenges/{future_ch['id']}/checkins",
        headers=headers,
        json={"category_slug": "esw", "title": "Tentativa antes do início"},
    )
    assert resp.status_code == 400
    assert "só começa" in resp.json()["detail"]


def test_change_password_and_logout_all_revoke_previous_tokens(api_client: TestClient) -> None:
    reg = api_client.post(
        "/api/v1/auth/register",
        json={"username": "rotator", "password": "old-password-1"},
    )
    assert reg.status_code == 201
    old_token = reg.json()["access_token"]
    old_headers = {"Authorization": f"Bearer {old_token}"}

    changed = api_client.post(
        "/api/v1/auth/change-password",
        headers=old_headers,
        json={"current_password": "old-password-1", "new_password": "new-password-2"},
    )
    assert changed.status_code == 200
    new_headers = {"Authorization": f"Bearer {changed.json()['access_token']}"}

    assert api_client.get("/api/v1/auth/me", headers=old_headers).status_code == 401
    assert api_client.get("/api/v1/auth/me", headers=new_headers).status_code == 200

    logout_all = api_client.post("/api/v1/auth/logout-all", headers=new_headers)
    assert logout_all.status_code == 200
    assert api_client.get("/api/v1/auth/me", headers=new_headers).status_code == 401


def test_evidence_upload_validates_magic_bytes_and_blocks_path_traversal(
    api_client: TestClient,
) -> None:
    headers = dev_login(api_client, "uploader")
    bad = api_client.post(
        "/api/v1/uploads/evidence",
        headers=headers,
        files={"file": ("evil.png", b"<script>alert(1)</script>", "image/png")},
    )
    assert bad.status_code == 400

    minimal_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    ok = api_client.post(
        "/api/v1/uploads/evidence",
        headers=headers,
        files={"file": ("print.png", minimal_png, "image/png")},
    )
    assert ok.status_code == 201, ok.text
    image_url = ok.json()["image_url"]
    served = api_client.get(image_url)
    assert served.status_code == 200
    assert served.headers["content-type"].startswith("image/png")
    assert served.headers["x-content-type-options"] == "nosniff"

    traversal = api_client.get("/api/v1/uploads/..%2F..%2Fetc%2Fpasswd")
    assert traversal.status_code == 404


def test_github_webhook_validates_hmac_signature(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "github_webhook_secret", "super-secret-hook")
    body = json.dumps({"zen": "Keep it logically awesome."}).encode("utf-8")

    bad = api_client.post(
        "/api/v1/webhooks/github",
        content=body,
        headers={"X-GitHub-Event": "ping", "X-Hub-Signature-256": "sha256=wrong"},
    )
    assert bad.status_code == 401

    sig = "sha256=" + hmac.new(b"super-secret-hook", body, hashlib.sha256).hexdigest()
    good = api_client.post(
        "/api/v1/webhooks/github",
        content=body,
        headers={"X-GitHub-Event": "ping", "X-Hub-Signature-256": sig},
    )
    assert good.status_code == 200
    assert good.json()["status"] == "pong"


def test_production_settings_fail_fast_validation() -> None:
    insecure = Settings(
        environment="production",
        jwt_secret_key=DEFAULT_DEV_JWT_SECRET,
        token_encryption_key="",
        allow_dev_login=True,
    )
    with pytest.raises(RuntimeError, match="Configuração insegura em produção"):
        insecure.validate_production_settings()


def test_duplicate_report_from_same_user_returns_409(api_client: TestClient) -> None:
    admin_headers = dev_login(api_client, "rep_admin")
    member_headers = dev_login(api_client, "rep_member")
    ch = create_challenge(api_client, admin_headers, "Moderação Única", visibility="public")
    api_client.post(
        "/api/v1/challenges/join",
        headers=member_headers,
        json={"challenge_id": ch["id"]},
    )
    ci = create_checkin(api_client, admin_headers, ch["id"], "Estudo reportado")

    first = api_client.post(
        f"/api/v1/checkins/{ci['id']}/reports",
        headers=member_headers,
        json={"reason": "Commit suspeito"},
    )
    second = api_client.post(
        f"/api/v1/checkins/{ci['id']}/reports",
        headers=member_headers,
        json={"reason": "Repetido"},
    )
    assert first.status_code == 200
    assert second.status_code == 409
