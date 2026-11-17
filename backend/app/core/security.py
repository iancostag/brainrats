import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7

bearer_scheme = HTTPBearer(auto_error=False)


def _fernet() -> Fernet:
    raw = (settings.token_encryption_key or settings.jwt_secret_key).encode("utf-8")
    digest = hashlib.sha256(raw).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    """Encrypt sensitive tokens (e.g. GitHub OAuth access token) at rest."""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str | None:
    """Decrypt a stored token; return None if key changed or token is invalid."""
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


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


def create_access_token(user_id: uuid.UUID) -> str:
    """Create a signed JWT access token for the given user ID."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def create_oauth_state() -> str:
    """Create a short-lived signed state token for GitHub OAuth CSRF protection."""
    now = datetime.now(UTC)
    payload = {
        "purpose": "github_oauth_state",
        "nonce": secrets.token_hex(8),
        "iat": now,
        "exp": now + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def verify_oauth_state(state: str) -> None:
    """Validate the GitHub OAuth state token."""
    try:
        payload = jwt.decode(state, settings.jwt_secret_key, algorithms=[ALGORITHM])
        if payload.get("purpose") != "github_oauth_state":
            raise ValueError("Invalid state purpose")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estado OAuth inválido ou expirado. Tente entrar novamente.",
        ) from exc


def decode_access_token(token: str) -> uuid.UUID:
    """Decode and validate a JWT access token, returning the user UUID."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise ValueError("Missing subject")
        return uuid.UUID(sub)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        ) from exc


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

    user_id = decode_access_token(credentials.credentials)
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )
    return user
