import logging
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

ALLOWED_WEBHOOK_HOSTS = {
    "discord.com",
    "discordapp.com",
    "ptb.discord.com",
    "canary.discord.com",
    "api.telegram.org",
}


def validate_outbound_webhook_url(raw_url: str | None) -> str | None:
    """Validate that an outbound webhook points strictly to Discord or Telegram over HTTPS."""
    if raw_url is None:
        return None
    cleaned = raw_url.strip()
    if not cleaned:
        return None
    parsed = urlparse(cleaned)
    host = (parsed.hostname or "").lower()
    if parsed.scheme.lower() != "https" or host not in ALLOWED_WEBHOOK_HOSTS:
        raise ValueError(
            "Webhook inválido: apenas URLs HTTPS do Discord ou da API do Telegram são aceitas."
        )
    if host.endswith("discord.com") or host == "discordapp.com":
        if not parsed.path.startswith("/api/webhooks/"):
            raise ValueError("URL de webhook do Discord deve começar com /api/webhooks/.")
    return cleaned


async def dispatch_challenge_webhook(
    webhook_url: str | None,
    *,
    message: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> bool:
    """Send a best-effort notification to a challenge's configured Discord or Telegram webhook."""
    if not webhook_url:
        return False
    try:
        validated = validate_outbound_webhook_url(webhook_url)
        if not validated:
            return False
        parsed = urlparse(validated)
        host = (parsed.hostname or "").lower()
        payload = {"text": message} if host == "api.telegram.org" else {"content": message}
        async with httpx.AsyncClient(timeout=3.0, transport=transport) as client:
            resp = await client.post(validated, json=payload)
            return 200 <= resp.status_code < 300
    except Exception:
        logger.warning("Falha ao enviar notificação para webhook externo.", exc_info=True)
        return False
