from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, validate_safe_http_url
from app.models.user import PushSubscription, User
from app.services.push import is_push_configured

router = APIRouter(prefix="/push", tags=["push"])


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)
    p256dh: str = Field(min_length=10, max_length=255)
    auth: str = Field(min_length=6, max_length=255)

    @field_validator("endpoint")
    @classmethod
    def _validate_endpoint(cls, value: str) -> str:
        validated = validate_safe_http_url(value)
        assert validated is not None
        return validated


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)


@router.get("/vapid-public-key")
async def get_vapid_public_key() -> dict[str, str | bool]:
    """Return the VAPID public key and whether Web Push delivery is configured."""
    return {
        "enabled": is_push_configured(),
        "public_key": settings.vapid_public_key or "",
    }


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    payload: PushSubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Register or update a browser Web Push subscription for the authenticated user."""
    existing = await db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    if existing is None:
        db.add(
            PushSubscription(
                user_id=current_user.id,
                endpoint=payload.endpoint,
                p256dh=payload.p256dh,
                auth=payload.auth,
            )
        )
    else:
        existing.user_id = current_user.id
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
    await db.commit()
    return {"detail": "Notificações push ativadas neste dispositivo."}


@router.delete("/subscribe", status_code=status.HTTP_200_OK)
async def unsubscribe_push(
    payload: PushUnsubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Remove a browser Web Push subscription for the authenticated user."""
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == payload.endpoint,
        )
    )
    await db.commit()
    return {"detail": "Notificações push desativadas neste dispositivo."}
