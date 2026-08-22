from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.alerts import AlertIngestRequest, NormalizedAlert
from app.services.alert_ingestion import IngestResult, ingest_alerts

settings = get_settings()


def _hash_payload(value: Any) -> str:
    encoded = repr(value).encode("utf-8")
    return sha256(encoded).hexdigest()


def normalize_direct_alert(source_name: str, raw: dict[str, Any]) -> NormalizedAlert:
    """Normalize a provider adapter's direct alert shape.

    A production connector should map the provider-specific fields into this
    direct shape and preserve the original object in raw_payload.
    """
    return NormalizedAlert(
        source_name=source_name,
        source_event_id=str(raw["source_event_id"]),
        title=str(raw["title"]),
        body=str(raw["body"]),
        severity=raw["severity"],
        hazard=raw.get("hazard"),
        issued_at=raw["issued_at"],
        expires_at=raw.get("expires_at"),
        source_url=raw.get("source_url"),
        content_hash=raw.get("content_hash") or _hash_payload(raw),
        raw_payload=raw,
    )


async def poll_configured_feed(session) -> IngestResult:
    if settings.demo_mode:
        raise RuntimeError("feed polling is disabled in demo mode")
    if not settings.alert_feed_url:
        raise RuntimeError("ALERT_FEED_URL is not configured")

    timeout = httpx.Timeout(settings.alert_feed_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.get(
            settings.alert_feed_url,
            headers={"Accept": "application/json", "User-Agent": "CodeForResilience/1.0"},
        )
        response.raise_for_status()
        document = response.json()

    raw_items = document.get("items", document if isinstance(document, list) else [])
    if not isinstance(raw_items, list):
        raise RuntimeError("configured feed must return a JSON array or an object with an items array")

    items = [normalize_direct_alert(settings.alert_feed_source_name, item) for item in raw_items]
    payload = AlertIngestRequest(
        source_name=settings.alert_feed_source_name,
        items=items,
        fetched_at=datetime.now(timezone.utc),
        etag=response.headers.get("etag"),
        last_modified=response.headers.get("last-modified"),
    )
    return await ingest_alerts(session, payload)
