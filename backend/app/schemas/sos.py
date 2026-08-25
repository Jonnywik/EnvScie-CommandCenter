from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SosChannel(StrEnum):
    internet = "internet"
    sms = "sms"
    mesh = "mesh"
    manual = "manual"


class AlertSeverity(StrEnum):
    info = "info"
    advisory = "advisory"
    watch = "watch"
    warning = "warning"
    critical = "critical"


class SosCreate(BaseModel):
    device_public_id: str | None = Field(default=None, max_length=128)
    client_nonce: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    emergency_type: str = Field(min_length=1, max_length=32)
    message: str | None = Field(default=None, max_length=240)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: float | None = Field(default=None, ge=0)
    client_occurred_at: datetime
    channel: SosChannel = SosChannel.internet


class MobileDeviceRegistration(BaseModel):
    """Minimal device correlation record; it intentionally carries no resident profile or location."""

    device_public_id: str = Field(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
    platform: str = Field(pattern=r"^(android|ios|unknown)$")


class CoordinatorEmergencyCreate(BaseModel):
    """A manually reported emergency recorded by a Command Center coordinator."""

    emergency_type: str = Field(min_length=2, max_length=32)
    severity: AlertSeverity = AlertSeverity.critical
    summary: str = Field(min_length=5, max_length=500)
    barangay: str = Field(min_length=2, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: float | None = Field(default=30, ge=0, le=5000)
    reporter_name: str | None = Field(default=None, max_length=120)
    reporter_contact: str | None = Field(default=None, max_length=40)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SmsSosRequest(BaseModel):
    sender_phone: str = Field(min_length=8, max_length=20)
    message: str = Field(min_length=1, max_length=320)
    gateway_received_at: datetime | None = None


class DecodedSmsSos(BaseModel):
    version: int
    device_public_id: str
    nonce: str = Field(min_length=4, max_length=16)
    emergency_type: str = Field(min_length=1, max_length=8)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: int | None = Field(default=None, ge=0, le=9999)
    client_epoch: int = Field(gt=0)
    crc_hex: str = Field(pattern=r"^[0-9A-Fa-f]{8}$")

    @field_validator("device_public_id", "emergency_type", "nonce")
    @classmethod
    def no_delimiters(cls, value: str) -> str:
        if any(c in value for c in ";|,\n\r"):
            raise ValueError("payload field contains a delimiter")
        return value


class SosResponse(BaseModel):
    id: UUID
    status: str
    received_at: datetime
    channel: SosChannel


class SosResidentStatus(BaseModel):
    """Privacy-bounded SOS lifecycle feedback for the originating mobile device."""

    id: UUID
    status: str
    received_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    last_status_at: datetime
    resident_message: str
    decision_limit: str


class SosStatusUpdate(BaseModel):
    status: str = Field(pattern=r"^(received|acknowledged|dispatched|resolved|false_alarm)$")
    note: str | None = Field(default=None, max_length=500)


class SosVerificationCreate(BaseModel):
    category: str = Field(pattern=r"^(location_callback|barangay_contact|field_report|official_source|other)$")
    source_role: str = Field(min_length=2, max_length=120)
    contact_method: str = Field(min_length=2, max_length=80)
    source_observed_at: datetime | None = None
    note: str = Field(min_length=5, max_length=1000)
    reference_number: str | None = Field(default=None, max_length=160)


class SosVerificationRecord(BaseModel):
    id: UUID
    sos_id: UUID
    category: str
    source_role: str
    contact_method: str
    source_observed_at: datetime | None = None
    note: str
    reference_number: str | None = None
    recorded_by_user_id: UUID | None = None
    recorded_by_role: str | None = None
    recorded_at: datetime
    decision_limit: str


class SosVerificationSnapshot(BaseModel):
    generated_at: datetime
    source: str
    records: list[SosVerificationRecord]


class RoutePoint(BaseModel):
    latitude: float
    longitude: float


class SafeRouteResponse(BaseModel):
    center_id: UUID
    center_name: str
    distance_meters: float
    estimated_seconds: int
    route: list[RoutePoint]
    avoided_hazard_count: int
    route_is_safe_as_of: datetime
