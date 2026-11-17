from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "BrainRats API"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./brainrats.db"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "brainrats-dev-secret-key-at-least-32-bytes"
    github_client_id: str = ""
    github_client_secret: str = ""
    token_encryption_key: str = ""
    frontend_url: str = "http://localhost:3000"
    allow_dev_login: bool = True

    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
