"""Contracts for emergency response-group readiness and assignment."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


GroupAvailability = Literal["available", "limited", "assigned", "standby", "offline"]
GroupStatus = Literal["ready", "en_route", "deployed", "returning", "standby", "offline"]
DispatchLifecycleStatus = Literal["pending_confirmation", "confirmed", "acknowledged", "escalated", "cancelled", "closed"]
DispatchLifecycleAction = Literal["confirm", "acknowledge", "escalate", "cancel", "close"]


class ResponseGroupRosterRole(BaseModel):
    role: str
    count: int = Field(ge=1)
    readiness: Literal["ready", "limited", "unconfirmed"] = "unconfirmed"


class ResponseGroup(BaseModel):
    id: str
    name: str
    agency: str
    group_type: str
    specialties: list[str]
    status: GroupStatus
    availability: GroupAvailability
    readiness_score: int = Field(ge=0, le=100)
    personnel_ready: int = Field(ge=0)
    personnel_total: int = Field(ge=0)
    lead: str
    contact_channel: str
    call_sign: str
    location: dict[str, float]
    location_label: str
    location_source: Literal["gps", "radio", "manual", "last_known"]
    last_location_at: datetime
    location_accuracy_meters: float | None = Field(default=None, ge=0)
    vehicle_or_asset: str
    current_assignment: str | None = None
    assignment_target: str | None = None
    estimated_response_minutes: int | None = Field(default=None, ge=0)
    equipment: list[str]
    roster: list[ResponseGroupRosterRole] = Field(default_factory=list)
    constraints: list[str]
    last_check_in_at: datetime
    notes: str | None = None


class ResponseGroupSnapshot(BaseModel):
    generated_at: datetime
    source: Literal["demo-seed", "postgis"]
    groups: list[ResponseGroup]
    specialties: list[str]
    availability_counts: dict[str, int]
    stale_location_count: int = Field(ge=0)


class ResponseGroupAssignmentRequest(BaseModel):
    group_id: str = Field(min_length=2, max_length=120)
    target_type: Literal["sos_request", "task", "barangay", "evacuation_center"]
    target_id: str = Field(min_length=2, max_length=120)
    assignment_note: str | None = Field(default=None, max_length=500)


class ResponseGroupAssignmentResult(BaseModel):
    status: Literal["pending_confirmation", "confirmed", "acknowledged", "escalated", "cancelled", "closed"]
    group: ResponseGroup
    target_type: str
    target_id: str
    assignment_id: str
    assigned_at: datetime
    confirmation_required: bool = True
    decision_limit: str = "A proposal does not dispatch a unit, confirm receipt, clear a route, or establish field safety."


class DispatchLifecycleTransitionRequest(BaseModel):
    action: DispatchLifecycleAction
    note: str | None = Field(default=None, max_length=500)
    operator_confirmed: bool = False


class DispatchLifecycleEvent(BaseModel):
    id: str
    assignment_id: str
    event_type: str
    from_status: DispatchLifecycleStatus | None = None
    to_status: DispatchLifecycleStatus
    note: str | None = None
    actor_user_id: str | None = None
    actor_role: str | None = None
    occurred_at: datetime


class DispatchLifecycleAssignment(BaseModel):
    assignment_id: str
    group_id: str
    target_type: str
    target_id: str
    assignment_note: str | None = None
    status: DispatchLifecycleStatus
    created_at: datetime
    confirmed_at: datetime | None = None
    acknowledged_at: datetime | None = None
    escalated_at: datetime | None = None
    cancelled_at: datetime | None = None
    closed_at: datetime | None = None
    events: list[DispatchLifecycleEvent] = Field(default_factory=list)
    confirmation_required: bool = True
    decision_limit: str = "A lifecycle status records human decisions and reported acknowledgement only; it does not prove notification delivery, route clearance, or field safety."


class DispatchLifecycleSnapshot(BaseModel):
    generated_at: datetime
    source: Literal["demo-seed", "database"]
    assignments: list[DispatchLifecycleAssignment]
