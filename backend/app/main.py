from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.core.seed import seed_initial_data
from app.models import *  # noqa: F401, F403


async def _sqlite_needs_checkin_uq_migration(conn) -> bool:
    indexes = (await conn.execute(text("PRAGMA index_list(checkins)"))).fetchall()
    for idx in indexes:
        if not idx[2]:  # not unique
            continue
        cols = (await conn.execute(text(f"PRAGMA index_info('{idx[1]}')"))).fetchall()
        col_names = {row[2] for row in cols}
        if col_names == {"user_id", "source", "external_event_id"}:
            return True
    return False


async def _ensure_sqlite_migrations() -> None:
    """Add new nullable columns and update constraints on existing local SQLite DB files."""
    if not settings.database_url.startswith("sqlite"):
        return
    async with engine.begin() as conn:
        cols = (await conn.execute(text("PRAGMA table_info(users)"))).fetchall()
        col_names = {row[1] for row in cols}
        if "password_hash" not in col_names:
            await conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
        if "last_challenge_id" not in col_names:
            await conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN last_challenge_id CHAR(32) "
                    "REFERENCES challenges(id) ON DELETE SET NULL"
                )
            )

        if await _sqlite_needs_checkin_uq_migration(conn):
            await conn.execute(text("PRAGMA foreign_keys=OFF"))
            await conn.execute(text("DROP INDEX IF EXISTS ix_checkins_challenge_feed"))
            await conn.execute(text("DROP INDEX IF EXISTS ix_checkins_daily_points"))
            await conn.execute(text("ALTER TABLE checkins RENAME TO checkins_old"))
            await conn.run_sync(
                lambda sync_conn: Base.metadata.tables["checkins"].create(sync_conn)
            )
            await conn.execute(text("INSERT INTO checkins SELECT * FROM checkins_old"))
            await conn.execute(text("DROP TABLE checkins_old"))
            await conn.execute(text("PRAGMA foreign_keys=ON"))


async def _ensure_postgres_migrations() -> None:
    """Update existing PostgreSQL schema columns and constraints idempotently."""
    if not settings.resolved_database_url.startswith("postgresql"):
        return
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_challenge_id UUID "
                "REFERENCES challenges(id) ON DELETE SET NULL"
            )
        )
        cols = (
            await conn.execute(
                text(
                    "SELECT kcu.column_name "
                    "FROM information_schema.table_constraints tc "
                    "JOIN information_schema.key_column_usage kcu "
                    "ON tc.constraint_name = kcu.constraint_name "
                    "AND tc.table_schema = kcu.table_schema "
                    "WHERE tc.table_name = 'checkins' "
                    "AND tc.constraint_name = 'uq_checkins_external_event'"
                )
            )
        ).fetchall()
        col_names = {row[0] for row in cols}
        if col_names and "challenge_id" not in col_names:
            await conn.execute(
                text("ALTER TABLE checkins DROP CONSTRAINT IF EXISTS uq_checkins_external_event")
            )
            await conn.execute(
                text(
                    "ALTER TABLE checkins ADD CONSTRAINT uq_checkins_external_event "
                    "UNIQUE (challenge_id, user_id, source, external_event_id)"
                )
            )


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Create schema tables if missing and ensure initial categories and challenges exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_sqlite_migrations()
    await _ensure_postgres_migrations()
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="API do BrainRats — desafios e diário de estudos de programação.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
