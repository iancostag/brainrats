import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    display_name: str | None = Field(default=None, max_length=120)
    github_username: str | None = Field(default=None, max_length=100)
    leetcode_username: str | None = Field(default=None, max_length=100)


class IntegrationOut(BaseModel):
    provider: Literal["github", "leetcode"]
    external_username: str
    target_challenge_id: uuid.UUID | None
    last_synced_at: datetime | None


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    bio: str | None
    integrations: list[IntegrationOut] = Field(default_factory=list)


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = Field(default=None, max_length=500)
    github_username: str | None = Field(default=None, max_length=100)
    leetcode_username: str | None = Field(default=None, max_length=100)
    target_challenge_id: uuid.UUID | None = None
