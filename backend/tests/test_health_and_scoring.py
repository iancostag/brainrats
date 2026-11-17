from datetime import UTC, date, datetime

from fastapi.testclient import TestClient

from app.main import app
from app.services.scoring import (
    DailyUsage,
    calculate_checkin_points,
    calculate_streak,
    compute_study_date,
)

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["app"] == "BrainRats API"


def test_default_categories_endpoint() -> None:
    response = client.get("/api/v1/categories")
    assert response.status_code == 200
    slugs = {item["slug"] for item in response.json()}
    assert slugs == {"leetcode", "project", "books", "esw", "data"}


def test_compute_study_date_uses_challenge_timezone() -> None:
    utc_time = datetime(2026, 11, 17, 2, 30, tzinfo=UTC)
    assert compute_study_date(utc_time, "America/Sao_Paulo") == date(2026, 11, 16)
    assert compute_study_date(utc_time, "UTC") == date(2026, 11, 17)


def test_checkin_mode_awards_single_point_per_day() -> None:
    first = calculate_checkin_points(
        scoring_mode="checkin",
        raw_points=35,
        category_daily_cap=70,
        challenge_daily_cap=100,
        usage=DailyUsage(valid_checkins_today=0, category_points_today=0, global_points_today=0),
    )
    second = calculate_checkin_points(
        scoring_mode="checkin",
        raw_points=35,
        category_daily_cap=70,
        challenge_daily_cap=100,
        usage=DailyUsage(valid_checkins_today=1, category_points_today=1, global_points_today=1),
    )
    assert first == 1
    assert second == 0


def test_points_mode_respects_category_and_global_caps() -> None:
    capped_by_category = calculate_checkin_points(
        scoring_mode="points",
        raw_points=35,
        category_daily_cap=50,
        challenge_daily_cap=100,
        usage=DailyUsage(valid_checkins_today=1, category_points_today=40, global_points_today=40),
    )
    capped_by_global = calculate_checkin_points(
        scoring_mode="points",
        raw_points=35,
        category_daily_cap=70,
        challenge_daily_cap=100,
        usage=DailyUsage(valid_checkins_today=3, category_points_today=0, global_points_today=85),
    )
    assert capped_by_category == 10
    assert capped_by_global == 15


def test_calculate_streak_preserves_across_rest_days() -> None:
    active = {date(2026, 11, 14), date(2026, 11, 16), date(2026, 11, 17)}
    rest = {date(2026, 11, 15)}
    streak = calculate_streak(
        active_dates=active,
        rest_dates=rest,
        reference_date=date(2026, 11, 17),
    )
    assert streak == 3
