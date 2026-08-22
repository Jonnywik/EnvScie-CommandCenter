from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.auth import UserIdentity


async def write_audit_event(
    session: AsyncSession,
    *,
    actor: UserIdentity | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    metadata: dict | None = None,
    request_id: str | None = None,
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO cfr.audit_log (
                actor_user_id, actor_role, action, resource_type,
                resource_id, request_id, metadata
            ) VALUES (
                :actor_user_id, :actor_role, :action, :resource_type,
                :resource_id, :request_id, CAST(:metadata AS jsonb)
            )
            """
        ),
        {
            "actor_user_id": str(actor.id) if actor else None,
            "actor_role": actor.role if actor else None,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "request_id": request_id,
            "metadata": __import__("json").dumps(metadata or {}),
        },
    )
    await session.commit()


def demo_audit_identity(user: UserIdentity | None) -> tuple[str | None, str | None]:
    if user is None:
        return None, None
    return str(user.id), user.role
