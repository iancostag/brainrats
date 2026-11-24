from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DEV_JWT_SECRET = "brainrats-dev-secret-key-at-least-32-bytes"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "BrainRats API"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./brainrats.db"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = DEFAULT_DEV_JWT_SECRET
    github_client_id: str = ""
    github_client_secret: str = ""
    github_webhook_secret: str = ""
    token_encryption_key: str = ""
    frontend_url: str = "http://localhost:3000"
    allow_dev_login: bool = True
    rate_limit_enabled: bool = True

    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@brainrats.dev"

    upload_dir: str = "./uploads"
    max_upload_bytes: int = 5 * 1024 * 1024

    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def resolved_database_url(self) -> str:
        """Normalize Postgres connection URLs to use the asyncpg driver."""
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_upload_dir(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[2] / path
        return path

    def validate_production_settings(self) -> None:
        """Fail fast at startup when production settings are insecure."""
        if self.environment != "production":
            return
        errors: list[str] = []
        if self.jwt_secret_key == DEFAULT_DEV_JWT_SECRET or len(self.jwt_secret_key) < 32:
            errors.append(
                "JWT_SECRET_KEY deve ser definido com pelo menos 32 caracteres em produção."
            )
        if not self.token_encryption_key or self.token_encryption_key == self.jwt_secret_key:
            errors.append(
                "TOKEN_ENCRYPTION_KEY deve ser definido e distinto de JWT_SECRET_KEY em produção."
            )
        if self.allow_dev_login:
            errors.append("ALLOW_DEV_LOGIN deve ser false em produção.")
        if errors:
            raise RuntimeError("Configuração insegura em produção: " + " ".join(errors))


settings = Settings()
