from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


CommunicationChannel = Literal["VHF", "HF", "SMS", "phone", "field_runner"]
CommunicationDirection = Literal["inbound", "outbound", "broadcast"]
CommunicationPriority = Literal["routine", "priority", "urgent", "distress"]
CommunicationStatus = Literal["received", "acknowledged", "sent", "failed"]


class CommunicationEvent(BaseModel):
    id: str
    occurred_at: datetime
    direction: CommunicationDirection
    channel: CommunicationChannel
    from_unit: str
    to_unit: str
    message: str
    priority: CommunicationPriority
    status: CommunicationStatus
    acknowledged_at: datetime | None = None
    linked_incident_id: str | None = None
    operator: str


class AudioDispatchItem(BaseModel):
    id: str
    started_at: datetime
    duration_seconds: int = Field(ge=1, le=300)
    channel: CommunicationChannel
    from_unit: str
    to_unit: str
    transcript: str
    priority: CommunicationPriority
    status: Literal["playing", "queued", "played"]
    linked_incident_id: str | None = None
    waveform: list[int] = Field(min_length=8, max_length=64)


class CommunicationSnapshot(BaseModel):
    generated_at: datetime
    source: Literal["demo-seed", "database"]
    events: list[CommunicationEvent]
    audio_feed: list[AudioDispatchItem]
    channel_health: dict[str, Literal["clear", "busy", "degraded"]]
    unread_count: int = Field(ge=0)


class CommunicationEventCreate(BaseModel):
    channel: CommunicationChannel
    to_unit: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=2, max_length=500)
    priority: CommunicationPriority = "priority"
    linked_incident_id: str | None = Field(default=None, max_length=120)
    simulate_audio: bool = True


class RecommendationRequest(BaseModel):
    incident_id: str = Field(min_length=2, max_length=120)
    severity: Literal["critical", "high", "warning", "medium", "low"]
    emergency_type: str = Field(min_length=2, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    required_specialties: list[str] = Field(default_factory=list, max_length=8)
    max_results: int = Field(default=5, ge=1, le=10)


class RecommendationFactor(BaseModel):
    factor: str
    points: int
    detail: str


class DispatchRecommendation(BaseModel):
    rank: int
    group_id: str
    group_name: str
    eligibility: Literal["recommended", "eligible", "constrained", "ineligible"]
    score: int = Field(ge=0, le=100)
    distance_meters: int = Field(ge=0)
    estimated_response_minutes: int | None = Field(default=None, ge=0)
    specialty_match: list[str]
    missing_specialties: list[str]
    freshness_minutes: int = Field(ge=0)
    factors: list[RecommendationFactor]
    reasons: list[str]
    constraints: list[str]


class RecommendationResponse(BaseModel):
    generated_at: datetime
    source: Literal["demo-engine", "postgis-engine"]
    engine_version: str
    incident: dict[str, str | float | list[str]]
    recommended_group_id: str | None
    recommendations: list[DispatchRecommendation]
    safety_notes: list[str]
