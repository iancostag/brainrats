from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.v1 import auth as auth_router
from app.api.v1 import integrations as integrations_router
from app.core.database import Base, get_db
from app.core.seed import seed_initial_data
from app.main import create_app


@asynccontextmanager
async def _disabled_lifespan(_: FastAPI) -> AsyncIterator[None]:
    """The fixture creates and seeds its own database; global startup must not run."""
    yield


@pytest.fixture
async def api_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[TestClient]:
    """HTTP client backed by a fresh SQLite database with no external network calls."""
    db_file = tmp_path / "brainrats-test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(Base.metadata.create_all)
    async with session_factory() as session:
        await seed_initial_data(session)

    async def no_github_profile(_: str) -> tuple[None, None]:
        return None, None

    async def no_github_events(_: str) -> list[dict[str, Any]]:
        return []

    async def no_leetcode_events(_: str) -> list[dict[str, Any]]:
        return []

    # Tests must never depend on GitHub/LeetCode availability.
    monkeypatch.setattr(auth_router, "_fetch_github_profile", no_github_profile)
    monkeypatch.setattr(integrations_router, "_fetch_github_push_commits", no_github_events)
    monkeypatch.setattr(integrations_router, "_fetch_leetcode_submissions", no_leetcode_events)

    app = create_app()
    app.router.lifespan_context = _disabled_lifespan

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            await session.execute(text("PRAGMA foreign_keys=ON"))
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.fixture
def mvp_client(api_client: TestClient) -> TestClient:
    """Compatibility alias for the original end-to-end regression suite."""
    return api_client
