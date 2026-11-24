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
    collective_weekly_goal: int | None = Field(default=None, ge=1, le=5000)
    discord_webhook_url: str | None = Field(default=None, max_length=500)
    category_configs: list[CategoryConfigIn] = Field(default_factory=list)


class ChallengeUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visibility: Literal["private", "public"] | None = None
    end_date: date | None = None
    clear_end_date: bool = False
    rest_days_per_week: int | None = Field(default=None, ge=0, le=7)
    daily_points_cap: int | None = Field(default=None, ge=1, le=2000)
    collective_weekly_goal: int | None = Field(default=None, ge=1, le=5000)
    clear_collective_weekly_goal: bool = False
    discord_webhook_url: str | None = Field(default=None, max_length=500)
    category_configs: list[CategoryConfigIn] | None = None


class ChallengeJoinRequest(BaseModel):
    invite_code: str | None = Field(default=None, max_length=16)
    challenge_id: uuid.UUID | None = None


class ChallengeMemberRoleRequest(BaseModel):
    role: Literal["admin", "member"]


class StudyPresenceRequest(BaseModel):
    category_slug: Literal["leetcode", "project", "books", "esw", "data"] = "project"
    duration_minutes: int = Field(default=25, ge=5, le=180)


class StudyPresenceOut(BaseModel):
    user_id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    category_slug: str
    started_at: datetime
    expires_at: datetime


class NudgeOut(BaseModel):
    id: uuid.UUID
    sender_username: str
    sender_display_name: str
    nudge_date: date
    created_at: datetime


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
    collective_weekly_goal: int | None = None
    has_discord_webhook: bool = False
    is_member: bool
    member_role: Literal["admin", "member"] | None
    members_count: int
    created_at: datetime


class ChallengePreviewOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    visibility: Literal["private", "public"]
    scoring_mode: Literal["checkin", "points"]
    timezone: str
    start_date: date
    end_date: date | None
    rest_days_per_week: int
    daily_points_cap: int
    members_count: int
    is_member: bool


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
    checked_in_today: bool = False


class ChallengeDetailResponse(BaseModel):
    challenge: ChallengeListItem
    category_configs: list[CategoryConfigOut]
    leaderboard: list[LeaderboardEntry]
    user_rest_dates: list[date]
    rest_days_remaining_this_week: int
    user_active_dates_this_week: list[date] = Field(default_factory=list)
    user_points_today: int = 0
    collective_week_checkins: int = 0
    active_studiers: list[StudyPresenceOut] = Field(default_factory=list)
    pending_reports_count: int = 0
    received_nudges_today: list[NudgeOut] = Field(default_factory=list)


class RestDayResponse(BaseModel):
    rest_date: date
    rest_days_used_this_week: int
    rest_days_remaining_this_week: int


class ChallengeSummaryResponse(BaseModel):
    challenge_id: uuid.UUID
    challenge_title: str
    scoring_mode: Literal["checkin", "points"]
    start_date: date
    end_date: date | None
    total_checkins: int
    total_points: int
    participants_count: int
    top_category_slug: str | None
    by_category: dict[str, int]
    podium: list[LeaderboardEntry]
    my_entry: LeaderboardEntry | None
    my_position: int | None
