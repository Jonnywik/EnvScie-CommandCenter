import base64
import hashlib
import hmac
import json
import time
from collections.abc import Callable
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.schemas.auth import UserIdentity, UserRole

settings = get_settings()
bearer = HTTPBearer(auto_error=False)

DEMO_USER_IDS = {
    "resident": UUID("10000000-0000-4000-8000-000000000001"),
    "dispatcher": UUID("10000000-0000-4000-8000-000000000002"),
    "responder": UUID("10000000-0000-4000-8000-000000000003"),
    "admin": UUID("10000000-0000-4000-8000-000000000004"),
}


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _secret() -> bytes:
    if settings.auth_secret in {"dev-only-change-me", "change-me"} and not settings.demo_mode:
        raise HTTPException(status_code=503, detail="AUTH_SECRET is not configured")
    return settings.auth_secret.encode("utf-8")


def issue_access_token(user: UserIdentity) -> tuple[str, int]:
    expires_at = int(time.time()) + settings.access_token_ttl_seconds
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user.id),
        "name": user.display_name,
        "role": user.role,
        "active": user.is_active,
        "iat": int(time.time()),
        "exp": expires_at,
    }
    encoded_header = _b64(json.dumps(header, separators=(",", ":")).encode())
    encoded_payload = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    signature = _b64(hmac.new(_secret(), signing_input, hashlib.sha256).digest())
    return f"{encoded_header}.{encoded_payload}.{signature}", settings.access_token_ttl_seconds


def decode_access_token(token: str) -> UserIdentity:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token")
    encoded_header, encoded_payload, encoded_signature = parts
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    expected = _b64(hmac.new(_secret(), signing_input, hashlib.sha256).digest())
    if not hmac.compare_digest(expected, encoded_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token")
    try:
        payload: dict[str, Any] = json.loads(_unb64(encoded_payload))
        if int(payload["exp"]) < int(time.time()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="bearer token expired")
        role = payload["role"]
        if role not in {"resident", "dispatcher", "responder", "admin"}:
            raise ValueError("invalid role")
        return UserIdentity(
            id=UUID(payload["sub"]),
            display_name=str(payload["name"]),
            role=role,
            is_active=bool(payload.get("active", True)),
        )
    except HTTPException:
        raise
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer token") from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UserIdentity | None:
    if credentials is None:
        if settings.demo_mode:
            return None
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="bearer token required")
    return decode_access_token(credentials.credentials)


def require_roles(*roles: UserRole) -> Callable:
    async def dependency(user: UserIdentity | None = Depends(get_current_user)) -> UserIdentity:
        if user is None:
            if settings.demo_mode and "dispatcher" in roles:
                return UserIdentity(
                    id=DEMO_USER_IDS["dispatcher"],
                    display_name="Demo dispatcher",
                    role="dispatcher",
                    is_active=True,
                )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
        if not user.is_active or user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient role")
        return user

    return dependency
