from datetime import UTC, datetime

from fastapi import APIRouter

from app.api.v1 import auth, challenges, checkins, diary, integrations
from app.core.config import settings
from app.schemas.common import CategoryTemplate, HealthResponse
from app.services.scoring import DEFAULT_CATEGORIES

api_router = APIRouter()


@api_router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Return service health metadata."""
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        timestamp=datetime.now(UTC),
    )


@api_router.get("/categories", response_model=list[CategoryTemplate], tags=["categories"])
async def list_default_categories() -> list[CategoryTemplate]:
    """Return the 5 standard study categories and their default scoring metadata."""
    return [CategoryTemplate(**item) for item in DEFAULT_CATEGORIES]


api_router.include_router(auth.router)
api_router.include_router(challenges.router)
api_router.include_router(checkins.router)
api_router.include_router(diary.router)
api_router.include_router(integrations.router)
