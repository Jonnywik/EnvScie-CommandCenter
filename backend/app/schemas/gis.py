from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.sos import RoutePoint


ResourceKind = Literal["team", "vehicle", "boat", "supply", "medical", "communications"]
ResourceState = Literal["ready", "standby", "en_route", "deployed", "stale", "offline"]


class ResourcePositionUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_meters: float | None = Field(default=None, ge=0, le=10000)
    heading_degrees: float | None = Field(default=None, ge=0, le=360)
    speed_kph: float | None = Field(default=None, ge=0, le=160)
    battery_pct: int | None = Field(default=None, ge=0, le=100)
    state: ResourceState | None = None
    source: Literal["gps", "manual", "radio", "sms"] = "manual"
    reported_at: datetime | None = None


class GisResource(BaseModel):
    id: UUID
    label: str
    kind: ResourceKind
    owner: str
    state: ResourceState
    position: RoutePoint
    reported_at: datetime | None = None
    accuracy_meters: float | None = None
    heading_degrees: float | None = None
    speed_kph: float | None = None
    battery_pct: int | None = None
    current_assignment: str | None = None
    last_update_source: str | None = None


class GisHazard(BaseModel):
    id: UUID | str
    name: str
    hazard: str
    severity: str
    status: str
    polygon: list[RoutePoint]
    last_verified: datetime
    action: str


class GisCenter(BaseModel):
    id: UUID
    name: str
    status: str
    capacity_total: int
    occupancy_current: int
    position: RoutePoint


class GisSosPoint(BaseModel):
    id: UUID
    status: str
    severity: str
    position: RoutePoint
    accuracy_meters: float | None = None
    summary: str


class GisMapSnapshot(BaseModel):
    generated_at: datetime
    source: Literal["demo-seed", "postgis"]
    center: RoutePoint
    bbox: list[float] = Field(min_length=4, max_length=4)
    resources: list[GisResource]
    hazards: list[GisHazard]
    centers: list[GisCenter]
    sos: list[GisSosPoint]


class RouteOptimizationRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    destination_center_id: UUID | None = None
    max_route_age_seconds: int = Field(default=900, ge=60, le=86400)


class OptimizedRouteResponse(BaseModel):
    center_id: UUID
    center_name: str
    origin: RoutePoint
    distance_meters: float
    estimated_seconds: int
    route: list[RoutePoint]
    avoided_hazard_count: int
    blocked_segment_count: int
    route_status: Literal["safe", "stale", "blocked"]
    route_is_safe_as_of: datetime
    warnings: list[str]
