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


async def _ensure_sqlite_migrations() -> None:
    """Add new nullable columns to existing local SQLite DB files without losing data."""
    if not settings.database_url.startswith("sqlite"):
        return
    async with engine.begin() as conn:
        cols = (await conn.execute(text("PRAGMA table_info(users)"))).fetchall()
        col_names = {row[1] for row in cols}
        if "password_hash" not in col_names:
            await conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Create schema tables if missing and ensure initial categories and challenges exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_sqlite_migrations()
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
