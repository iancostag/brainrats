import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AuthProvidersResponse(BaseModel):
    github_oauth_enabled: bool
    password_auth_enabled: bool = True
    dev_login_enabled: bool


class LoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    display_name: str | None = Field(default=None, max_length=120)
    github_username: str | None = Field(default=None, max_length=100)
    leetcode_username: str | None = Field(default=None, max_length=100)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    github_username: str | None = Field(default=None, max_length=100)
    leetcode_username: str | None = Field(default=None, max_length=100)


class PasswordLoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class IntegrationOut(BaseModel):
    provider: Literal["github", "leetcode"]
    external_username: str
    target_challenge_id: uuid.UUID | None
    last_synced_at: datetime | None
    has_oauth_token: bool = False


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    email: str | None = None
    avatar_url: str | None
    bio: str | None
    last_challenge_id: uuid.UUID | None = None
    has_github_oauth: bool = False
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
    last_challenge_id: uuid.UUID | None = None


class GitHubOAuthLinkRequest(BaseModel):
    redirect_tab: Literal["integrations", "settings"] = "integrations"


class GitHubOAuthLinkResponse(BaseModel):
    url: str


class GitHubRepoItem(BaseModel):
    github_repo_id: int
    full_name: str
    default_branch: str
    private: bool
    is_monitored: bool = False


class MonitoredRepoSelection(BaseModel):
    github_repo_id: int
    full_name: str
    default_branch: str = "main"


class MonitoredReposUpdateRequest(BaseModel):
    target_challenge_id: uuid.UUID | None = None
    repos: list[MonitoredRepoSelection] = Field(default_factory=list)
