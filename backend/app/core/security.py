import base64
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import jwt
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7
GITHUB_USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,38}$")
LOCAL_UPLOAD_PATH_RE = re.compile(r"^/api/v1/uploads/[a-f0-9]{32}\.(?:png|jpg|webp)$")
BADGE_AVATAR_PATH_RE = re.compile(r"^/badges/[a-z0-9_]+\.png$")

bearer_scheme = HTTPBearer(auto_error=False)


def _fernet_hkdf() -> Fernet:
    raw = (settings.token_encryption_key or settings.jwt_secret_key).encode("utf-8")
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"brainrats-fernet-hkdf-v1",
        info=b"token-encryption",
    )
    derived = hkdf.derive(raw)
    return Fernet(base64.urlsafe_b64encode(derived))


def _fernet_legacy() -> Fernet:
    raw = (settings.token_encryption_key or settings.jwt_secret_key).encode("utf-8")
    digest = hashlib.sha256(raw).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    """Encrypt sensitive tokens (e.g. GitHub OAuth access token) at rest using HKDF + Fernet."""
    return _fernet_hkdf().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str | None:
    """Decrypt a stored token (supporting legacy SHA-256 Fernet tokens seamlessly)."""
    for fernet in (_fernet_hkdf(), _fernet_legacy()):
        try:
            return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except (InvalidToken, ValueError):
            continue
    return None


def hash_opaque_code(raw_code: str) -> str:
    """Hash a high-entropy one-time code with SHA-256 for storage."""
    return hashlib.sha256(raw_code.encode("utf-8")).hexdigest()


def is_valid_github_username(username: str) -> bool:
    """Return True when username matches GitHub's official login rules."""
    return bool(GITHUB_USERNAME_RE.match(username.strip()))


def validate_safe_http_url(
    url: str | None,
    *,
    allow_local_upload: bool = False,
    allow_badge_avatar: bool = False,
) -> str | None:
    """Validate that a URL uses http/https (or safe local paths) to prevent XSS."""
    if url is None:
        return None
    cleaned = url.strip()
    if not cleaned:
        return None
    if allow_local_upload and LOCAL_UPLOAD_PATH_RE.match(cleaned):
        return cleaned
    if allow_badge_avatar and BADGE_AVATAR_PATH_RE.match(cleaned):
        return cleaned
    parsed = urlparse(cleaned)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL inválida: informe um link http:// ou https:// válido.")
    return cleaned


def hash_password(password: str) -> str:
    """Hash a password with scrypt and a random 16-byte salt."""
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(derived).decode()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Verify a plaintext password against a stored scrypt hash."""
    if not stored_hash or not stored_hash.startswith("scrypt$"):
        return False
    try:
        _, salt_b64, hash_b64 = stored_hash.split("$", 2)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
        return hmac.compare_digest(derived, expected)
    except Exception:
        return False


def create_access_token(user_id: uuid.UUID, token_version: int = 0) -> str:
    """Create a signed JWT access token bound to the user's current token_version."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "tv": token_version,
        "jti": secrets.token_hex(8),
        "iat": now,
        "exp": now + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def create_oauth_state(
    *,
    link_user_id: uuid.UUID | None = None,
    redirect_tab: str | None = None,
) -> str:
    """Create a short-lived signed state token for GitHub OAuth CSRF protection."""
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "purpose": "github_oauth_state",
        "nonce": secrets.token_hex(8),
        "iat": now,
        "exp": now + timedelta(minutes=10),
    }
    if link_user_id is not None:
        payload["link_user_id"] = str(link_user_id)
    if redirect_tab:
        payload["redirect_tab"] = redirect_tab
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def verify_oauth_state(state: str) -> dict:
    """Validate the GitHub OAuth state token and return its claims."""
    try:
        payload = jwt.decode(state, settings.jwt_secret_key, algorithms=[ALGORITHM])
        if payload.get("purpose") != "github_oauth_state":
            raise ValueError("Invalid state purpose")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado OAuth inválido ou expirado. Tente entrar novamente.",
        ) from exc


def decode_access_token_claims(token: str) -> tuple[uuid.UUID, int]:
    """Decode and validate a JWT access token, returning (user_id, token_version)."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Missing subject")
        tv = int(payload.get("tv", 0))
        return uuid.UUID(sub), tv
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        ) from exc


def decode_access_token(token: str) -> uuid.UUID:
    """Decode and validate a JWT access token, returning the user UUID."""
    user_id, _ = decode_access_token_claims(token)
    return user_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency returning the authenticated user from a Bearer JWT."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
        )

    user_id, token_version = decode_access_token_claims(credentials.credentials)
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )
    if (user.token_version or 0) != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        )
    return user
