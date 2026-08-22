from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

UserRole = Literal["resident", "dispatcher", "responder", "admin"]


class DemoLoginRequest(BaseModel):
    role: UserRole = "dispatcher"
    display_name: str = Field(default="Demo dispatcher", min_length=2, max_length=120)


class UserIdentity(BaseModel):
    id: UUID
    display_name: str
    role: UserRole
    is_active: bool = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserIdentity


class AuditEvent(BaseModel):
    id: int | str
    actor_user_id: UUID | None = None
    actor_role: UserRole | None = None
    action: str
    resource_type: str
    resource_id: str | None = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime
