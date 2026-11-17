from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session per request."""
    async with AsyncSessionLocal() as session:
        yield session
