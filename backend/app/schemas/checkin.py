import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

ReactionType = Literal["fire", "rocket", "brain", "clap"]


class CheckInCreateRequest(BaseModel):
    category_slug: Literal["leetcode", "project", "books", "esw", "data"]
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    evidence_url: str | None = Field(default=None, max_length=500)
    metadata_json: dict = Field(default_factory=dict)


class CheckInUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


class ReactionToggleRequest(BaseModel):
    reaction_type: ReactionType


class CommentCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class ReportCreateRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class ModerateCheckInRequest(BaseModel):
    action: Literal["invalidate", "restore"]
    reason: str | None = Field(default=None, max_length=500)


class CommentOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    display_name: str
    content: str
    created_at: datetime


class ReportOut(BaseModel):
    id: uuid.UUID
    reporter_username: str
    reason: str
    status: str
    created_at: datetime


class CheckInOut(BaseModel):
    id: uuid.UUID
    challenge_id: uuid.UUID
    challenge_title: str
    user_id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    category_slug: str
    category_name: str
    title: str
    description: str | None
    study_date: date
    source: Literal["manual", "github", "leetcode"]
    metadata_json: dict
    evidence_url: str | None
    points_awarded: int
    status: Literal["valid", "invalidated"]
    invalidation_reason: str | None
    reactions: dict[str, int]
    user_reactions: list[str]
    comments: list[CommentOut]
    reports_count: int
    reports: list[ReportOut] = Field(default_factory=list)
    created_at: datetime


class DiaryResponse(BaseModel):
    items: list[CheckInOut]
    total_entries: int
    total_points: int
    by_category: dict[str, int]


class SyncRequest(BaseModel):
    simulate: bool = False
    challenge_id: uuid.UUID | None = None


class SyncResponse(BaseModel):
    created_count: int
    skipped_duplicates: int
    details: list[str]
    created_checkins: list[CheckInOut]
