from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

ScoringMode = Literal["checkin", "points"]

DEFAULT_CATEGORIES: tuple[dict, ...] = (
    {
        "slug": "leetcode",
        "name": "LeetCode",
        "description": "Resolução de problemas de algoritmos e estruturas de dados.",
        "default_base_points": 10,
        "default_daily_cap": 70,
        "supports_auto_sync": True,
        "metadata_fields": ["difficulty", "language", "problem_slug"],
    },
    {
        "slug": "project",
        "name": "Continuidade de Projeto",
        "description": "Evolução contínua de projetos pessoais ou open-source com commits e PRs.",
        "default_base_points": 15,
        "default_daily_cap": 50,
        "supports_auto_sync": True,
        "metadata_fields": ["repository", "commits_count", "duration_minutes"],
    },
    {
        "slug": "books",
        "name": "Leitura de Livros",
        "description": "Leitura de livros técnicos de programação, arquitetura e computação.",
        "default_base_points": 15,
        "default_daily_cap": 40,
        "supports_auto_sync": False,
        "metadata_fields": ["book_title", "pages_read", "duration_minutes"],
    },
    {
        "slug": "esw",
        "name": "ESW (Engenharia de Software)",
        "description": (
            "System Design, arquitetura, padrões de projeto, testes, docs e cursos técnicos."
        ),
        "default_base_points": 15,
        "default_daily_cap": 50,
        "supports_auto_sync": False,
        "metadata_fields": ["topic", "duration_minutes", "resource_type"],
    },
    {
        "slug": "data",
        "name": "Dados",
        "description": (
            "SQL, modelagem, pipelines/ETL, Python/Pandas, análise/BI e Machine Learning."
        ),
        "default_base_points": 15,
        "default_daily_cap": 50,
        "supports_auto_sync": False,
        "metadata_fields": ["topic", "duration_minutes", "tool"],
    },
)


@dataclass(frozen=True)
class DailyUsage:
    """Existing valid check-in totals for a user on a given study_date."""

    valid_checkins_today: int
    category_points_today: int
    global_points_today: int


def compute_study_date(occurred_at: datetime, challenge_timezone: str) -> date:
    """Convert an instant to the calendar date in the challenge's configured timezone."""
    aware = occurred_at if occurred_at.tzinfo is not None else occurred_at.replace(tzinfo=UTC)
    return aware.astimezone(ZoneInfo(challenge_timezone)).date()


def calculate_checkin_points(
    *,
    scoring_mode: ScoringMode,
    raw_points: int,
    category_daily_cap: int,
    challenge_daily_cap: int,
    usage: DailyUsage,
) -> int:
    """Compute awarded points respecting the challenge mode and anti-farm daily caps."""
    if scoring_mode == "checkin":
        return 1 if usage.valid_checkins_today == 0 else 0

    if raw_points <= 0:
        return 0

    category_remaining = max(0, category_daily_cap - usage.category_points_today)
    global_remaining = max(0, challenge_daily_cap - usage.global_points_today)
    return min(raw_points, category_remaining, global_remaining)


def calculate_streak(
    *,
    active_dates: set[date],
    rest_dates: set[date],
    reference_date: date,
) -> int:
    """Count consecutive active study days up to reference_date, preserving across rest_dates.

    If reference_date has no check-in and is not a rest day yet, the streak still counts from
    yesterday (the user still has until the end of reference_date to keep the streak alive).
    """
    cursor = reference_date
    if cursor not in active_dates and cursor not in rest_dates:
        cursor = reference_date - timedelta(days=1)

    streak = 0
    while True:
        if cursor in active_dates:
            streak += 1
        elif cursor in rest_dates:
            # Rest days bridge the streak without incrementing active study days.
            pass
        else:
            break
        cursor -= timedelta(days=1)
    return streak
