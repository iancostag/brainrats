import logging
import re
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.rate_limit import rate_limit
from app.core.security import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads", tags=["uploads"])

SAFE_FILENAME_RE = re.compile(r"^[a-f0-9]{32}\.(?:png|jpg|webp)$")
MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
}


def _detect_image_ext(data: bytes) -> str | None:
    """Validate image type by magic bytes (never trust client Content-Type alone)."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


async def _upload_to_supabase_storage(filename: str, data: bytes, media_type: str) -> str:
    """Upload validated image bytes to a public Supabase Storage bucket and return its URL."""
    base_url = settings.supabase_url.strip().rstrip("/")
    api_key = settings.supabase_service_role_key.strip()
    bucket = (settings.supabase_storage_bucket or "evidence").strip().strip("/")
    upload_url = f"{base_url}/storage/v1/object/{bucket}/{filename}"

    headers = {
        "apikey": api_key,
        "Content-Type": media_type,
        "x-upsert": "false",
        "cache-control": "max-age=86400",
    }
    # Legacy service_role JWTs expect Authorization: Bearer; opaque sb_secret_ keys use apikey
    # so the Supabase API gateway translates them into an internal service_role JWT.
    if not api_key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(upload_url, content=data, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("Falha de rede ao enviar evidência para Supabase Storage: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível enviar a imagem para o armazenamento. Tente novamente.",
        ) from exc

    if response.status_code not in (200, 201):
        logger.warning(
            "Supabase Storage recusou upload (status=%s): %s",
            response.status_code,
            response.text[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível enviar a imagem para o armazenamento. Tente novamente.",
        )

    return f"{base_url}/storage/v1/object/public/{bucket}/{filename}"


@router.post(
    "/evidence",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("uploads_evidence", max_requests=30, window_seconds=300))],
)
async def upload_evidence_image(
    file: Annotated[UploadFile, File(...)],
    _: User = Depends(get_current_user),
) -> dict[str, str]:
    """Upload a PNG, JPEG, or WebP evidence image (up to 5 MB) validated by magic bytes."""
    data = await file.read(settings.max_upload_bytes + 1)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Imagem excede o limite máximo de 5 MB.",
        )

    ext = _detect_image_ext(data)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato não suportado. Envie uma imagem PNG, JPEG ou WebP.",
        )

    filename = f"{uuid.uuid4().hex}{ext}"
    if settings.supabase_storage_enabled:
        media_type = MEDIA_TYPES[ext]
        public_url = await _upload_to_supabase_storage(filename, data, media_type)
        return {"image_url": public_url}

    upload_dir = settings.resolved_upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / filename).write_bytes(data)
    return {"image_url": f"/api/v1/uploads/{filename}"}


@router.get("/{filename}")
async def serve_uploaded_image(filename: str) -> FileResponse:
    """Serve an uploaded evidence image with strict path validation and safe headers."""
    if not SAFE_FILENAME_RE.match(filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagem não encontrada.")
    path = (settings.resolved_upload_dir / filename).resolve()
    root = settings.resolved_upload_dir.resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagem não encontrada.")
    ext = path.suffix.lower()
    return FileResponse(
        path,
        media_type=MEDIA_TYPES.get(ext, "application/octet-stream"),
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
        },
    )
