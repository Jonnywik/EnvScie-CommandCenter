from dataclasses import dataclass
from datetime import datetime, timezone
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.schemas.alerts import AlertIngestRequest
from app.services.demo_data import record_demo_audit, upsert_demo_alerts

settings = get_settings()


@dataclass(frozen=True)
class IngestResult:
    source_name: str
    run_id: int | str
    status: str
    items_seen: int
    items_inserted: int
    items_updated: int
    completed_at: datetime


async def ingest_alerts(
    session: AsyncSession | None,
    payload: AlertIngestRequest,
) -> IngestResult:
    completed_at = datetime.now(timezone.utc)
    if settings.demo_mode:
        inserted, updated = upsert_demo_alerts(
            [item.model_dump(mode="json") for item in payload.items]
        )
        record_demo_audit(
            actor_user_id=None,
            actor_role="admin",
            action="alerts.ingested",
            resource_type="verified_alerts",
            metadata={
                "source_name": payload.source_name,
                "items_seen": len(payload.items),
                "items_inserted": inserted,
                "items_updated": updated,
            },
        )
        return IngestResult(
            source_name=payload.source_name,
            run_id=f"demo-{int(completed_at.timestamp())}",
            status="succeeded",
            items_seen=len(payload.items),
            items_inserted=inserted,
            items_updated=updated,
            completed_at=completed_at,
        )

    if session is None:
        raise RuntimeError("database unavailable")

    source_row = (
        await session.execute(
            text(
                """
                INSERT INTO cfr.external_feed_sources (source_name, etag, last_modified)
                VALUES (:source_name, :etag, :last_modified)
                ON CONFLICT (source_name) DO UPDATE SET
                    etag = COALESCE(EXCLUDED.etag, cfr.external_feed_sources.etag),
                    last_modified = COALESCE(EXCLUDED.last_modified, cfr.external_feed_sources.last_modified),
                    updated_at = now()
                RETURNING source_name
                """
            ),
            {
                "source_name": payload.source_name,
                "etag": payload.etag,
                "last_modified": payload.last_modified,
            },
        )
    ).mappings().one()
    run_id = (
        await session.execute(
            text(
                """
                INSERT INTO cfr.external_feed_runs (source_name, run_status)
                VALUES (:source_name, 'started')
                RETURNING id
                """
            ),
            {"source_name": source_row["source_name"]},
        )
    ).scalar_one()

    inserted = 0
    updated = 0
    for item in payload.items:
        existing = (
            await session.execute(
                text(
                    """
                    SELECT id, content_hash
                    FROM cfr.verified_alerts
                    WHERE source_name = :source_name
                      AND source_event_id = :source_event_id
                    """
                ),
                {
                    "source_name": item.source_name,
                    "source_event_id": item.source_event_id,
                },
            )
        ).mappings().first()
        params = {
            "source_name": item.source_name,
            "source_event_id": item.source_event_id,
            "title": item.title,
            "body": item.body,
            "severity": item.severity,
            "hazard": item.hazard,
            "issued_at": item.issued_at,
            "expires_at": item.expires_at,
            "source_url": str(item.source_url) if item.source_url else None,
            "raw_payload": json.dumps(item.raw_payload),
            "content_hash": item.content_hash,
        }
        if existing is None:
            await session.execute(
                text(
                    """
                    INSERT INTO cfr.verified_alerts (
                        source_name, source_event_id, title, body, severity, hazard,
                        issued_at, expires_at, source_url, raw_payload, content_hash
                    ) VALUES (
                        :source_name, :source_event_id, :title, :body, :severity, :hazard,
                        :issued_at, :expires_at, :source_url, CAST(:raw_payload AS jsonb), :content_hash
                    )
                    """
                ),
                params,
            )
            inserted += 1
        elif existing["content_hash"] != item.content_hash:
            await session.execute(
                text(
                    """
                    UPDATE cfr.verified_alerts
                    SET title = :title, body = :body, severity = :severity, hazard = :hazard,
                        issued_at = :issued_at, expires_at = :expires_at, source_url = :source_url,
                        raw_payload = CAST(:raw_payload AS jsonb), content_hash = :content_hash
                    WHERE id = :id
                    """
                ),
                {**params, "id": existing["id"]},
            )
            updated += 1

    await session.execute(
        text(
            """
            UPDATE cfr.external_feed_runs
            SET run_status = 'succeeded', items_seen = :items_seen,
                items_inserted = :items_inserted, items_updated = :items_updated,
                finished_at = now()
            WHERE id = :run_id
            """
        ),
        {
            "run_id": run_id,
            "items_seen": len(payload.items),
            "items_inserted": inserted,
            "items_updated": updated,
        },
    )
    await session.execute(
        text(
            """
            UPDATE cfr.external_feed_sources
            SET last_success_at = now(), last_error_at = NULL, last_error = NULL,
                last_content_hash = :last_content_hash, updated_at = now()
            WHERE source_name = :source_name
            """
        ),
        {
            "source_name": payload.source_name,
            "last_content_hash": payload.items[-1].content_hash if payload.items else None,
        },
    )
    await session.commit()
    return IngestResult(
        source_name=payload.source_name,
        run_id=run_id,
        status="succeeded",
        items_seen=len(payload.items),
        items_inserted=inserted,
        items_updated=updated,
        completed_at=completed_at,
    )
