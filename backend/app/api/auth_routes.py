from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.schemas.auth import AuditEvent, DemoLoginRequest, TokenResponse, UserIdentity
from app.services.auth import DEMO_USER_IDS, get_current_user, issue_access_token
from app.services.demo_data import demo_audit_log, record_demo_audit

router = APIRouter(prefix="/v1/auth", tags=["auth"])
settings = get_settings()


@router.post("/demo-login", response_model=TokenResponse)
async def demo_login(payload: DemoLoginRequest) -> TokenResponse:
    if not settings.demo_mode:
        raise HTTPException(status_code=404, detail="demo login is disabled")
    user = UserIdentity(
        id=DEMO_USER_IDS[payload.role],
        display_name=payload.display_name,
        role=payload.role,
        is_active=True,
    )
    token, expires_in = issue_access_token(user)
    record_demo_audit(
        actor_user_id=str(user.id),
        actor_role=user.role,
        action="auth.demo_login",
        resource_type="user",
        resource_id=str(user.id),
        metadata={"display_name": user.display_name},
    )
    return TokenResponse(access_token=token, expires_in=expires_in, user=user)


@router.get("/me", response_model=UserIdentity)
async def current_user(user: UserIdentity | None = Depends(get_current_user)) -> UserIdentity:
    if user is not None:
        return user
    return UserIdentity(
        id=DEMO_USER_IDS["dispatcher"],
        display_name="Demo dispatcher",
        role="dispatcher",
        is_active=True,
    )


@router.get("/audit", response_model=list[AuditEvent])
async def audit_events(
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession | None = Depends(get_db),
    user: UserIdentity | None = Depends(get_current_user),
) -> list[dict]:
    if user is not None and user.role not in {"dispatcher", "admin"}:
        raise HTTPException(status_code=403, detail="insufficient role")
    if settings.demo_mode:
        return demo_audit_log(limit)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (
        await session.execute(
            text(
                """
                SELECT id, actor_user_id, actor_role, action, resource_type,
                       resource_id, metadata, created_at
                FROM cfr.audit_log
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
    ).mappings().all()
    return [dict(row) for row in rows]
