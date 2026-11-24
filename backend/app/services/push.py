import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import PushSubscription

logger = logging.getLogger(__name__)


def is_push_configured() -> bool:
    """Return True when VAPID keys are configured for real Web Push delivery."""
    return bool(settings.vapid_public_key and settings.vapid_private_key)


async def send_push_to_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str,
    url: str = "/",
) -> int:
    """Deliver a Web Push notification to all subscriptions of a user (no-op if unconfigured)."""
    if not is_push_configured():
        return 0

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning("pywebpush não instalado; pulando envio Web Push.")
        return 0

    subscriptions = (
        await db.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id))
    ).all()
    if not subscriptions:
        return 0

    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
            )
            sent += 1
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                await db.delete(sub)
            else:
                logger.warning("Erro ao enviar Web Push para subscription %s: %s", sub.id, exc)
        except Exception:
            logger.warning("Erro inesperado ao enviar Web Push.", exc_info=True)
    return sent
