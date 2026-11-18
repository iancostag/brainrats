from datetime import UTC, date, datetime
from types import SimpleNamespace
from uuid import uuid4
from zoneinfo import ZoneInfoNotFoundError

import pytest
from fastapi import HTTPException

from app.core.security import (
    create_access_token,
    create_oauth_state,
    decode_access_token,
    decrypt_secret,
    encrypt_secret,
    hash_password,
    verify_oauth_state,
    verify_password,
)
from app.services.checkins import compute_raw_points
from app.services.scoring import (
    DailyUsage,
    calculate_checkin_points,
    calculate_streak,
    compute_study_date,
)


def usage(*, checkins: int = 0, category: int = 0, global_: int = 0) -> DailyUsage:
    return DailyUsage(
        valid_checkins_today=checkins,
        category_points_today=category,
        global_points_today=global_,
    )


@pytest.mark.parametrize(
    ("instant", "timezone", "expected"),
    [
        (datetime(2026, 11, 17, 2, 30, tzinfo=UTC), "America/Sao_Paulo", date(2026, 11, 16)),
        (datetime(2026, 11, 17, 2, 30, tzinfo=UTC), "UTC", date(2026, 11, 17)),
        (datetime(2026, 11, 17, 16, 30, tzinfo=UTC), "Asia/Tokyo", date(2026, 11, 18)),
        # Naive datetimes are explicitly interpreted as UTC by the service.
        (datetime(2026, 11, 17, 2, 30), "America/Sao_Paulo", date(2026, 11, 16)),
    ],
)
def test_compute_study_date_uses_challenge_timezone(
    instant: datetime, timezone: str, expected: date
) -> None:
    assert compute_study_date(instant, timezone) == expected


def test_compute_study_date_rejects_unknown_timezone() -> None:
    with pytest.raises(ZoneInfoNotFoundError):
        compute_study_date(datetime.now(UTC), "Mars/Olympus_Mons")


@pytest.mark.parametrize(
    ("mode", "raw", "cat_cap", "global_cap", "current", "expected"),
    [
        ("checkin", 35, 70, 100, usage(), 1),
        ("checkin", 35, 70, 100, usage(checkins=1, category=1, global_=1), 0),
        ("points", 35, 50, 100, usage(checkins=1, category=40, global_=40), 10),
        ("points", 35, 70, 100, usage(checkins=3, global_=85), 15),
        ("points", 35, 50, 100, usage(category=50), 0),
        ("points", 35, 70, 100, usage(global_=100), 0),
        ("points", 0, 70, 100, usage(), 0),
        ("points", -5, 70, 100, usage(), 0),
    ],
)
def test_calculate_checkin_points_enforces_mode_and_caps(
    mode: str,
    raw: int,
    cat_cap: int,
    global_cap: int,
    current: DailyUsage,
    expected: int,
) -> None:
    assert (
        calculate_checkin_points(
            scoring_mode=mode,  # type: ignore[arg-type]
            raw_points=raw,
            category_daily_cap=cat_cap,
            challenge_daily_cap=global_cap,
            usage=current,
        )
        == expected
    )


@pytest.mark.parametrize(
    ("slug", "base", "weights", "metadata", "expected"),
    [
        ("leetcode", 10, {}, {"difficulty": "easy"}, 10),
        ("leetcode", 10, {}, {"difficulty": "Medium"}, 20),
        ("leetcode", 10, {}, {"difficulty": "hard"}, 35),
        ("leetcode", 10, {"Hard": 42}, {"difficulty": "Hard"}, 42),
        ("leetcode", 10, {}, {"difficulty": "unknown"}, 10),
        ("books", 15, {"per_page": 2}, {"pages_read": 12}, 24),
        ("books", 15, {"per_page": 1}, {"pages_read": 3}, 15),
        ("books", 15, {}, {"pages_read": -1}, 15),
        ("project", 15, {}, {"duration_minutes": 29}, 15),
        ("project", 15, {}, {"duration_minutes": 60}, 30),
        ("esw", 20, {}, {}, 20),
    ],
)
def test_compute_raw_points_uses_category_metadata(
    slug: str, base: int, weights: dict[str, int], metadata: dict[str, object], expected: int
) -> None:
    config = SimpleNamespace(base_points=base, weights_json=weights)
    assert compute_raw_points(slug, config, metadata) == expected


@pytest.mark.parametrize(
    ("active", "rest", "reference", "expected"),
    [
        (set(), set(), date(2026, 11, 17), 0),
        ({date(2026, 11, 16)}, set(), date(2026, 11, 17), 1),
        ({date(2026, 11, 17)}, set(), date(2026, 11, 17), 1),
        (
            {date(2026, 11, 14), date(2026, 11, 16), date(2026, 11, 17)},
            {date(2026, 11, 15)},
            date(2026, 11, 17),
            3,
        ),
        (
            {date(2026, 11, 13), date(2026, 11, 16)},
            {date(2026, 11, 14), date(2026, 11, 15)},
            date(2026, 11, 17),
            2,
        ),
        ({date(2026, 11, 15)}, set(), date(2026, 11, 17), 0),
        (set(), {date(2026, 11, 16)}, date(2026, 11, 17), 0),
    ],
)
def test_calculate_streak_handles_today_gaps_and_rest_bridges(
    active: set[date], rest: set[date], reference: date, expected: int
) -> None:
    assert (
        calculate_streak(active_dates=active, rest_dates=rest, reference_date=reference) == expected
    )


def test_password_hash_round_trip_and_random_salt() -> None:
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")

    assert first != second
    assert verify_password("correct horse battery staple", first)
    assert not verify_password("wrong", first)
    assert not verify_password("password", None)
    assert not verify_password("password", "malformed")
    assert not verify_password("password", "scrypt$bad$hash")


def test_secret_encryption_round_trip_and_tamper_detection() -> None:
    ciphertext = encrypt_secret("github-access-token")

    assert ciphertext != "github-access-token"
    assert decrypt_secret(ciphertext) == "github-access-token"
    assert decrypt_secret(ciphertext[:-2] + "xx") is None


def test_access_token_round_trip_and_tamper_detection() -> None:
    user_id = uuid4()
    token = create_access_token(user_id)

    assert decode_access_token(token) == user_id
    with pytest.raises(HTTPException) as exc:
        decode_access_token(token + "tampered")
    assert exc.value.status_code == 401


def test_oauth_state_has_required_purpose() -> None:
    verify_oauth_state(create_oauth_state())
    with pytest.raises(HTTPException) as exc:
        verify_oauth_state(create_access_token(uuid4()))
    assert exc.value.status_code == 400
