"""Initial BrainRats schema including security, social, and innovation tables.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-24
"""

from collections.abc import Sequence

from alembic import op
from app.core.database import Base
from app.models import *  # noqa: F401, F403

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_checkins_fts_pt "
            "ON checkins USING GIN (to_tsvector('portuguese', coalesce(title, '') || ' ' "
            "|| coalesce(description, '')))"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_checkins_fts_pt")
    Base.metadata.drop_all(bind=bind)
