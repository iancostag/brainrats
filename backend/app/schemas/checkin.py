import json
import math
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.security import validate_safe_http_url

ReactionType = Literal["fire", "rocket", "brain", "clap"]
MAX_METADATA_BYTES = 4096


def _validate_metadata(value: dict) -> dict:
    try:
        serialized = json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError) as exc:
        raise ValueError("Metadados inválidos.") from exc
    if len(serialized.encode("utf-8")) > MAX_METADATA_BYTES:
        raise ValueError("Metadados excedem o limite máximo de 4 KB.")
    for key in ("pages_read", "duration_minutes", "commits_count"):
        raw = value.get(key)
        if raw is None:
            continue
        if isinstance(raw, bool) or not isinstance(raw, int | float) or not math.isfinite(raw):
            raise ValueError(f"Campo '{key}' deve ser um número válido.")
        if raw < 0:
            raise ValueError(f"Campo '{key}' não pode ser negativo.")
        if key == "pages_read" and raw > 5000:
            raise ValueError("Páginas lidas excedem o limite máximo permitido.")
        if key == "duration_minutes" and raw > 1440:
            raise ValueError("Duração excede 24 horas por registro.")
    return value


class CheckInCreateRequest(BaseModel):
    category_slug: Literal["leetcode", "project", "books", "esw", "data"]
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    evidence_url: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    metadata_json: dict = Field(default_factory=dict)
    # Publica também nos outros desafios do usuário onde a categoria está habilitada.
    publish_to_all_challenges: bool = False

    @field_validator("evidence_url")
    @classmethod
    def _validate_evidence_url(cls, value: str | None) -> str | None:
        return validate_safe_http_url(value, allow_local_upload=False)

    @field_validator("image_url")
    @classmethod
    def _validate_image_url(cls, value: str | None) -> str | None:
        return validate_safe_http_url(value, allow_local_upload=True)

    @field_validator("metadata_json")
    @classmethod
    def _validate_metadata_json(cls, value: dict) -> dict:
        return _validate_metadata(value)


class CheckInUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    evidence_url: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("evidence_url")
    @classmethod
    def _validate_evidence_url(cls, value: str | None) -> str | None:
        return validate_safe_http_url(value, allow_local_upload=False)

    @field_validator("image_url")
    @classmethod
    def _validate_image_url(cls, value: str | None) -> str | None:
        return validate_safe_http_url(value, allow_local_upload=True)


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
    image_url: str | None = None
    points_awarded: int
    status: Literal["valid", "invalidated"]
    invalidation_reason: str | None
    reactions: dict[str, int]
    user_reactions: list[str]
    comments: list[CommentOut]
    reports_count: int
    reports: list[ReportOut] = Field(default_factory=list)
    created_at: datetime


class CheckInCreatedOut(CheckInOut):
    """Check-in criado no desafio atual, com o resultado da publicação nos demais."""

    also_published_in: list[str] = Field(default_factory=list)
    skipped_challenges: list[str] = Field(default_factory=list)
    newly_unlocked_badges: list[str] = Field(default_factory=list)


class DiaryChallengeEntry(BaseModel):
    """Pontuação de um mesmo estudo em um desafio específico."""

    checkin_id: uuid.UUID
    challenge_id: uuid.UUID
    challenge_title: str
    points_awarded: int
    status: Literal["valid", "invalidated"]


class DiaryItem(CheckInOut):
    """Item do diário: um estudo único, com a pontuação em cada desafio onde foi publicado."""

    challenges: list[DiaryChallengeEntry] = Field(default_factory=list)


class DiaryResponse(BaseModel):
    items: list[DiaryItem]
    total_entries: int
    total_points: int
    by_category: dict[str, int]
    has_more: bool = False
    next_cursor: datetime | None = None


class DiaryHeatmapDay(BaseModel):
    study_date: date
    count: int
    top_category: str | None = None


class DiaryHeatmapResponse(BaseModel):
    days: list[DiaryHeatmapDay]
    total_active_days: int
    current_global_streak: int
    longest_global_streak: int


class BookShelfItem(BaseModel):
    book_title: str
    total_pages: int
    sessions_count: int
    last_read_date: date


class ReviewSuggestionOut(BaseModel):
    checkin_id: uuid.UUID
    title: str
    category_slug: str
    category_name: str
    study_date: date
    days_ago: int
    interval_label: str
    evidence_url: str | None = None


class ReviewActionRequest(BaseModel):
    action: Literal["reviewed", "dismissed"] = "reviewed"


class WeeklyRecapResponse(BaseModel):
    start_date: date
    end_date: date
    total_studies: int
    by_category: dict[str, int]
    markdown: str


class SyncRequest(BaseModel):
    simulate: bool = False
    challenge_id: uuid.UUID | None = None


class SyncResponse(BaseModel):
    created_count: int
    skipped_duplicates: int
    details: list[str]
    created_checkins: list[CheckInOut]
