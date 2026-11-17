import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class CategoryConfigIn(BaseModel):
    category_slug: str
    is_enabled: bool = True
    base_points: int = Field(default=15, ge=1, le=500)
    daily_cap: int = Field(default=50, ge=1, le=1000)


class CategoryConfigOut(BaseModel):
    category_id: uuid.UUID
    slug: str
    name: str
    is_enabled: bool
    base_points: int
    daily_cap: int
    weights_json: dict


class ChallengeCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visibility: Literal["private", "public"] = "private"
    scoring_mode: Literal["checkin", "points"] = "points"
    timezone: str = Field(default="America/Sao_Paulo", max_length=64)
    start_date: date | None = None
    end_date: date | None = None
    rest_days_per_week: int = Field(default=1, ge=0, le=7)
    daily_points_cap: int = Field(default=100, ge=1, le=2000)
    category_configs: list[CategoryConfigIn] = Field(default_factory=list)


class ChallengeJoinRequest(BaseModel):
    invite_code: str | None = Field(default=None, max_length=16)
    challenge_id: uuid.UUID | None = None


class ChallengeListItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str | None
    visibility: Literal["private", "public"]
    invite_code: str
    scoring_mode: Literal["checkin", "points"]
    timezone: str
    start_date: date
    end_date: date | None
    rest_days_per_week: int
    daily_points_cap: int
    is_member: bool
    member_role: Literal["admin", "member"] | None
    members_count: int
    created_at: datetime


class LeaderboardEntry(BaseModel):
    user_id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    role: Literal["admin", "member"]
    total_points: int
    active_days: int
    checkins_count: int
    current_streak: int
    rest_days_used_this_week: int


class ChallengeDetailResponse(BaseModel):
    challenge: ChallengeListItem
    category_configs: list[CategoryConfigOut]
    leaderboard: list[LeaderboardEntry]
    user_rest_dates: list[date]
    rest_days_remaining_this_week: int


class RestDayResponse(BaseModel):
    rest_date: date
    rest_days_used_this_week: int
    rest_days_remaining_this_week: int
