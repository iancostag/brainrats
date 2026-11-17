import uuid
from datetime import UTC, datetime, timedelta

import jwt
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


def create_access_token(user_id: uuid.UUID) -> str:
    """Create a signed JWT access token for the given user ID."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


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
