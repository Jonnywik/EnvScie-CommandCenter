from datetime import datetime, timedelta, timezone

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.schemas.alerts import AlertIngestRequest, AlertIngestResponse, FeedHealth, SyncCursor
from app.services.alert_ingestion import ingest_alerts
from app.services.feed_poller import poll_configured_feed
from app.services.auth import require_roles
from app.services.demo_data import demo_alerts, demo_centers, demo_feed_health, update_demo_feed_health

router = APIRouter(prefix="/v1", tags=["alerts"])
settings = get_settings()


@router.post("/admin/alerts/ingest", response_model=AlertIngestResponse)
async def ingest_verified_alerts(
    payload: AlertIngestRequest,
    session: AsyncSession | None = Depends(get_db),
    _actor=Depends(require_roles("dispatcher", "admin")),
) -> AlertIngestResponse:
    try:
        result = await ingest_alerts(session, payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return AlertIngestResponse(
        source_name=result.source_name,
        run_id=result.run_id,
        status=result.status,
        items_seen=result.items_seen,
        items_inserted=result.items_inserted,
        items_updated=result.items_updated,
        completed_at=result.completed_at,
    )


@router.post("/admin/feeds/poll", response_model=AlertIngestResponse)
async def poll_external_feed(
    session: AsyncSession | None = Depends(get_db),
    _actor=Depends(require_roles("dispatcher", "admin")),
) -> AlertIngestResponse:
    if settings.demo_mode:
        update_demo_feed_health(source_name=None)
        now = datetime.now(timezone.utc)
        return AlertIngestResponse(
            source_name="demo-configured-feeds",
            run_id=f"demo-feed-poll-{int(now.timestamp())}",
            status="succeeded",
            items_seen=len(demo_alerts()),
            items_inserted=0,
            items_updated=0,
            completed_at=now,
        )
    try:
        result = await poll_configured_feed(session)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return AlertIngestResponse(
        source_name=result.source_name,
        run_id=result.run_id,
        status=result.status,
        items_seen=result.items_seen,
        items_inserted=result.items_inserted,
        items_updated=result.items_updated,
        completed_at=result.completed_at,
    )


@router.get("/admin/feeds/health", response_model=list[FeedHealth])
async def feed_health(session: AsyncSession | None = Depends(get_db)) -> list[FeedHealth]:
    if settings.demo_mode:
        return [FeedHealth(**item) for item in demo_feed_health()]
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (
        await session.execute(
            text(
                """
                SELECT source_name, endpoint_url, last_success_at, last_error_at,
                       last_error, last_content_hash
                FROM cfr.external_feed_sources
                ORDER BY source_name
                """
            )
        )
    ).mappings().all()
    now = datetime.now(timezone.utc)
    return [
        FeedHealth(
            source_name=row["source_name"],
            endpoint_url=row["endpoint_url"],
            last_success_at=row["last_success_at"],
            last_error_at=row["last_error_at"],
            last_error=row["last_error"],
            last_content_hash=row["last_content_hash"],
            stale=(row["last_success_at"] is None or now - row["last_success_at"] > timedelta(seconds=settings.alert_stale_after_seconds)),
        )
        for row in rows
    ]


@router.get("/sync/bootstrap", response_model=SyncCursor)
async def sync_bootstrap(session: AsyncSession | None = Depends(get_db)) -> SyncCursor:
    generated_at = datetime.now(timezone.utc)
    if settings.demo_mode:
        return SyncCursor(
            cursor=generated_at.isoformat(),
            generated_at=generated_at,
            source="demo-seed",
            alerts=demo_alerts(),
            centers=demo_centers(),
        )
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    alert_rows = (
        await session.execute(
            text(
                """
                SELECT id, source_name, source_event_id, title, body, severity, hazard,
                       issued_at, expires_at, source_url
                FROM cfr.verified_alerts
                WHERE expires_at IS NULL OR expires_at > now()
                ORDER BY issued_at DESC
                LIMIT 100
                """
            )
        )
    ).mappings().all()
    center_rows = (
        await session.execute(
            text(
                """
                SELECT id, name, barangay, status, capacity_total, occupancy_current,
                       amenities, ST_Y(geom) AS latitude, ST_X(geom) AS longitude
                FROM cfr.evacuation_centers
                ORDER BY status, name
                """
            )
        )
    ).mappings().all()
    alerts = [dict(row) for row in alert_rows]
    centers = [
        {
            **{key: value for key, value in row.items() if key not in {"latitude", "longitude"}},
            "location": {"latitude": row["latitude"], "longitude": row["longitude"]},
        }
        for row in center_rows
    ]
    return SyncCursor(
        cursor=generated_at.isoformat(),
        generated_at=generated_at,
        source="postgis",
        alerts=alerts,
        centers=centers,
    )
