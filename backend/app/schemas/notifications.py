from datetime import datetime
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


NotificationChannel = Literal["sms", "push", "in_app"]
NotificationStatus = Literal["queued", "sending", "delivered", "failed", "acknowledged"]


class AssignmentNotification(BaseModel):
    id: UUID | str
    group_id: UUID | str
    target_type: str
    target_id: str
    channel: NotificationChannel
    channels: list[NotificationChannel] = Field(default_factory=list)
    status: NotificationStatus
    message: str
    recipient_label: str
    recipient_address: str | None = None
    created_at: datetime
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    acknowledged_at: datetime | None = None
    attempts: int = 0
    last_error: str | None = None
    assignment_note: str | None = None
    actor_user_id: str | None = None


class NotificationSnapshot(BaseModel):
    generated_at: datetime
    source: Literal["demo-seed", "database"]
    notifications: list[AssignmentNotification]
    pending_count: int
    failed_count: int


class NotificationAcknowledgement(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class NotificationEvent(BaseModel):
    event: str
    notification: AssignmentNotification
