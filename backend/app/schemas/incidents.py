from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


IncidentStatus = Literal["open", "monitoring", "escalated", "stabilized", "closed", "reopened"]
IncidentAction = Literal["monitor", "escalate", "stabilize", "close", "reopen"]


class IncidentEvent(BaseModel):
    id: str
    incident_id: str
    action: str
    from_status: IncidentStatus | None = None
    to_status: IncidentStatus
    note: str | None = None
    actor_user_id: str | None = None
    actor_role: str | None = None
    occurred_at: datetime


class IncidentRecord(BaseModel):
    id: str
    status: IncidentStatus
    severity: str
    emergency_type: str
    barangay: str
    summary: str
    linked_sos_ids: list[str] = Field(default_factory=list)
    follow_up_owner: str | None = None
    follow_up_due_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    events: list[IncidentEvent] = Field(default_factory=list)
    decision_limit: str = "An incident record organizes reported evidence and human decisions. It does not verify field conditions, authorize dispatch, or establish safety."


class IncidentSnapshot(BaseModel):
    generated_at: datetime
    source: Literal["demo-seed", "database"]
    incidents: list[IncidentRecord]


class IncidentFromSosRequest(BaseModel):
    summary: str | None = Field(default=None, max_length=500)
    follow_up_owner: str | None = Field(default=None, max_length=120)
    follow_up_due_at: datetime | None = None


class IncidentTransitionRequest(BaseModel):
    action: IncidentAction
    note: str = Field(min_length=5, max_length=1000)
    follow_up_owner: str | None = Field(default=None, max_length=120)
    follow_up_due_at: datetime | None = None
