from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, model_validator

AlertSeverity = Literal["info", "advisory", "watch", "warning", "critical"]
HazardType = Literal["flood", "storm_surge", "landslide", "wind", "other"]


class NormalizedAlert(BaseModel):
    source_name: str = Field(min_length=2, max_length=120)
    source_event_id: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=240)
    body: str = Field(min_length=1, max_length=4000)
    severity: AlertSeverity
    hazard: HazardType | None = None
    issued_at: datetime
    expires_at: datetime | None = None
    source_url: HttpUrl | None = None
    content_hash: str = Field(min_length=32, max_length=128)
    raw_payload: dict = Field(default_factory=dict)


class AlertIngestRequest(BaseModel):
    source_name: str = Field(min_length=2, max_length=120)
    items: list[NormalizedAlert] = Field(max_length=200)
    fetched_at: datetime | None = None
    etag: str | None = Field(default=None, max_length=256)
    last_modified: str | None = Field(default=None, max_length=256)

    @model_validator(mode="after")
    def validate_item_sources(self):
        mismatched = [item.source_name for item in self.items if item.source_name != self.source_name]
        if mismatched:
            raise ValueError("every alert item must use the request source_name")
        return self


class AlertIngestResponse(BaseModel):
    source_name: str
    run_id: int | str
    status: Literal["succeeded", "failed"]
    items_seen: int
    items_inserted: int
    items_updated: int
    completed_at: datetime


class FeedHealth(BaseModel):
    source_name: str
    endpoint_url: str | None = None
    last_success_at: datetime | None = None
    last_checked_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error: str | None = None
    last_content_hash: str | None = None
    stale: bool


class SyncCursor(BaseModel):
    cursor: str | None = None
    generated_at: datetime
    source: str
    alerts: list[dict]
    centers: list[dict]
