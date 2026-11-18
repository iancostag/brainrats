from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import integrations as integrations_router
from tests.helpers import create_challenge, create_checkin, dev_login


def test_crosspost_groups_diary_and_propagates_edits(api_client: TestClient) -> None:
    headers = dev_login(api_client, "crosspost_owner")
    primary = create_challenge(api_client, headers, "Crosspost Principal")
    secondary = create_challenge(api_client, headers, "Crosspost Secundário")
    future = create_challenge(
        api_client,
        headers,
        "Crosspost Futuro",
        start_date=(datetime.now(UTC).date() + timedelta(days=5)).isoformat(),
    )
    disabled = create_challenge(
        api_client,
        headers,
        "Crosspost Desabilitado",
        category_configs=[
            {
                "category_slug": "books",
                "is_enabled": False,
                "base_points": 15,
                "daily_cap": 40,
            }
        ],
    )

    created = create_checkin(
        api_client,
        headers,
        primary["id"],
        "Livro distribuído",
        category_slug="books",
        metadata_json={"book_title": "DDIA", "pages_read": 8},
        publish_to_all_challenges=True,
    )
    assert secondary["title"] in created["also_published_in"]
    assert any(
        future["title"] in item and "ainda não começou" in item
        for item in created["skipped_challenges"]
    )
    assert any(
        disabled["title"] in item and "categoria desabilitada" in item
        for item in created["skipped_challenges"]
    )

    diary = api_client.get("/api/v1/diary", headers=headers, params={"q": "Livro distribuído"})
    assert diary.status_code == 200
    assert diary.json()["total_entries"] == 1
    item = diary.json()["items"][0]
    assert len(item["challenges"]) == len(created["also_published_in"]) + 1

    edited = api_client.patch(
        f"/api/v1/checkins/{created['id']}",
        headers=headers,
        json={"title": "Livro distribuído editado", "description": "Notas comuns"},
    )
    assert edited.status_code == 200

    secondary_feed = api_client.get(
        f"/api/v1/challenges/{secondary['id']}/feed", headers=headers
    ).json()
    copy = next(item for item in secondary_feed if item["title"] == "Livro distribuído editado")
    assert copy["description"] == "Notas comuns"


def test_sync_imports_only_today_and_deduplicates_per_challenge(
    api_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = dev_login(
        api_client,
        "sync_integrated",
        github_username="sync-gh",
        leetcode_username="sync-lc",
    )
    challenge = create_challenge(api_client, headers, "Sync Integrado")
    now = datetime.now(UTC)
    yesterday = now - timedelta(days=1)

    async def fake_github(_: str) -> list[dict]:
        return [
            {
                "sha": "today-sha",
                "title": "[repo] Commit de hoje",
                "repo": "team/repo",
                "url": "https://github.com/team/repo/commit/today-sha",
                "created_at": now.isoformat(),
            },
            {
                "sha": "old-sha",
                "title": "[repo] Commit antigo",
                "repo": "team/repo",
                "url": "https://github.com/team/repo/commit/old-sha",
                "created_at": yesterday.isoformat(),
            },
        ]

    async def fake_leetcode(_: str) -> list[dict]:
        return [
            {
                "id": "today-lc",
                "title": "Valid Anagram",
                "titleSlug": "valid-anagram",
                "timestamp": str(int(now.timestamp())),
            },
            {
                "id": "old-lc",
                "title": "Old Problem",
                "titleSlug": "old-problem",
                "timestamp": str(int(yesterday.timestamp())),
            },
        ]

    monkeypatch.setattr(integrations_router, "_fetch_github_push_commits", fake_github)
    monkeypatch.setattr(integrations_router, "_fetch_leetcode_submissions", fake_leetcode)

    first = api_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False, "challenge_id": challenge["id"]},
    )
    second = api_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False, "challenge_id": challenge["id"]},
    )

    assert first.status_code == 200, first.text
    assert first.json()["created_count"] == 2
    assert {item["title"] for item in first.json()["created_checkins"]} == {
        "[repo] Commit de hoje",
        "Valid Anagram",
    }
    assert second.status_code == 200
    assert second.json()["created_count"] == 0
    assert second.json()["skipped_duplicates"] == 2


def test_sync_requires_integration_and_simulation_creates_real_feed_rows(
    api_client: TestClient,
) -> None:
    headers = dev_login(api_client, "sync_without_accounts")
    challenges = api_client.get("/api/v1/challenges", headers=headers).json()
    target = next(item for item in challenges if item["is_member"])

    missing = api_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": False, "challenge_id": target["id"]},
    )
    simulated = api_client.post(
        "/api/v1/integrations/sync",
        headers=headers,
        json={"simulate": True, "challenge_id": target["id"]},
    )

    assert missing.status_code == 400
    assert simulated.status_code == 200
    assert simulated.json()["created_count"] == 2
    assert {item["source"] for item in simulated.json()["created_checkins"]} == {
        "github",
        "leetcode",
    }

    feed = api_client.get(f"/api/v1/challenges/{target['id']}/feed", headers=headers)
    created_ids = {item["id"] for item in simulated.json()["created_checkins"]}
    assert created_ids.issubset({item["id"] for item in feed.json()})
