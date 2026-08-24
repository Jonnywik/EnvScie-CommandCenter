from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.schemas.auth import UserIdentity
from app.schemas.coordination import (
    CommunicationEventCreate,
    CommunicationSnapshot,
    RecommendationRequest,
    RecommendationResponse,
)
from app.schemas.gis import (
    GisCenter,
    GisHazard,
    GisMapSnapshot,
    GisResource,
    GisSosPoint,
    FacilityVerificationCreate,
    FacilityVerificationRecord,
    FacilityVerificationSnapshot,
    MapSourceHealth,
    NoahMapContext,
    NoahOverlayLayer,
    OfficialFacilityRecord,
    OfficialFacilityRegistry,
    OptimizedRouteResponse,
    ResourcePositionUpdate,
    RouteOptimizationRequest,
    SourceHealthReviewRequest,
    SourceHealthReviewResult,
)
from app.schemas.response_groups import (
    DispatchLifecycleAssignment,
    DispatchLifecycleEvent,
    DispatchLifecycleSnapshot,
    DispatchLifecycleTransitionRequest,
    ResponseGroupAssignmentRequest,
    ResponseGroupAssignmentResult,
    ResponseGroupSnapshot,
)
from app.schemas.incidents import IncidentEvent, IncidentFromSosRequest, IncidentRecord, IncidentSnapshot, IncidentTransitionRequest
from app.schemas.notifications import AssignmentNotification, NotificationAcknowledgement, NotificationSnapshot
from app.schemas.sos import (
    CoordinatorEmergencyCreate,
    RoutePoint,
    SafeRouteResponse,
    SmsSosRequest,
    SosCreate,
    SosResponse,
    SosStatusUpdate,
)
from app.services.auth import require_roles
from app.services.audit import write_audit_event
from app.services.demo_data import (
    demo_alerts,
    demo_centers,
    demo_route,
    demo_summary,
    demo_operations,
    demo_operations_state,
    demo_response_groups,
    demo_gis_map,
    demo_gis_route,
    assign_demo_response_group,
    create_demo_dispatch_assignment,
    demo_dispatch_lifecycle,
    transition_demo_dispatch_assignment,
    demo_facility_verifications,
    create_demo_facility_verification,
    create_demo_incident_from_sos,
    demo_incidents,
    transition_demo_incident,
    demo_communications,
    demo_dispatch_recommendations,
    record_demo_communication,
    record_demo_audit,
    record_demo_operations_action,
    record_demo_sos,
    update_demo_resource_position,
    update_demo_sos_status,
    acknowledge_demo_notification,
    demo_notifications,
    demo_feed_health,
    update_demo_feed_health,
)
from app.services.realtime import manager
from app.services.routing import find_nearest_safe_center
from app.services.dispatch_recommendations import build_dispatch_recommendations
from app.services.notifications import retry_notification, send_assignment_notification
from app.services.sos_codec import PayloadError, decode_sms_payload
from app.services.sos_state import is_valid_sos_transition
from app.services.weather_feeds import evaluate_high_flood_risk, get_map_overlays_snapshot, get_provincial_weather_snapshot, get_radar_snapshot, get_typhoon_snapshot
from app.services.responder_safety import build_responder_safety_assessment

router = APIRouter(prefix="/v1")
settings = get_settings()


@router.get("/maps/google-script", include_in_schema=False)
async def google_maps_script() -> Response:
    """Serve the managed Google Maps loader through the Command Center API.

    The managed Maps proxy validates its registered application origin. This relay keeps the
    public Maps credential out of the Command Center browser bundle while returning only the
    provider script required by the interactive map canvas.
    """
    proxy_base = os.getenv("VITE_FRONTEND_FORGE_API_URL", "").rstrip("/")
    public_key = os.getenv("VITE_FRONTEND_FORGE_API_KEY", "")
    registered_origin = os.getenv("MAPS_PROXY_REGISTERED_ORIGIN", "https://3000-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer")
    if not proxy_base or not public_key:
        raise HTTPException(status_code=503, detail="Google Maps proxy configuration is unavailable.")
    async with httpx.AsyncClient(timeout=15) as client:
        upstream = await client.get(
            f"{proxy_base}/v1/maps/proxy/maps/api/js",
            params={"key": public_key, "v": "weekly"},
            headers={"Origin": registered_origin},
        )
    if upstream.status_code != 200:
        raise HTTPException(status_code=upstream.status_code, detail="Google Maps proxy could not provide the loader.")
    return Response(content=upstream.content, media_type="application/javascript", headers={"Cache-Control": "private, max-age=300"})


class OperationsActionRequest(BaseModel):
    action: str = Field(min_length=3, max_length=80)
    resource_type: str = Field(min_length=2, max_length=80)
    resource_id: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=500)


class ResponderSafetyAssessmentRequest(BaseModel):
    sos_id: str = Field(min_length=3, max_length=120)


def _dedupe_key(*parts: object) -> str:
    canonical = "|".join(str(part) for part in parts)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _verify_gateway_signature(
    sender_phone: str,
    message: str,
    signature: str | None,
) -> None:
    """Verify the gateway envelope, not the phone's secret.

    If the gateway cannot sign inbound messages, authenticate the gateway at the
    network/API layer and replace this with the provider's official verification.
    Never accept a user-controlled signature as proof of identity.
    """
    if settings.sms_gateway_shared_secret == "change-me":
        raise HTTPException(status_code=503, detail="SMS gateway authentication is not configured")
    if not signature:
        raise HTTPException(status_code=401, detail="missing SMS gateway signature")
    body = f"{sender_phone}\n{message}".encode("utf-8")
    expected = hmac.new(settings.sms_gateway_shared_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="invalid SMS gateway signature")


async def _persist_sos(
    session: AsyncSession,
    *,
    device_public_id: str | None,
    sender_phone: str | None,
    emergency_type: str,
    message: str | None,
    latitude: float,
    longitude: float,
    accuracy_meters: float | None,
    client_occurred_at: datetime,
    channel: str,
    raw_payload: str | None,
    dedupe_key: str,
    severity: str = "critical",
    metadata: dict | None = None,
) -> tuple[UUID, str, datetime]:
    sql = text(
        """
        INSERT INTO cfr.sos_requests (
            user_id, device_id, sender_phone, channel, emergency_type, severity, message,
            location, accuracy_meters, client_occurred_at, dedupe_key, raw_payload, metadata
        )
        VALUES (
            (SELECT id FROM cfr.app_users WHERE phone_e164 = :sender_phone),
            (SELECT id FROM cfr.registered_devices WHERE device_public_id = :device_public_id),
            :sender_phone, :channel, :emergency_type, CAST(:severity AS cfr.alert_severity), :message,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
            :accuracy_meters, :client_occurred_at, :dedupe_key, :raw_payload, CAST(:metadata AS jsonb)
        )
        ON CONFLICT (dedupe_key) DO UPDATE SET received_at = cfr.sos_requests.received_at
        RETURNING id, status, received_at
        """
    )
    row = (await session.execute(sql, {
        "device_public_id": device_public_id,
        "sender_phone": sender_phone,
        "channel": channel,
            "emergency_type": emergency_type,
            "severity": severity,
        "message": message,
        "longitude": longitude,
        "latitude": latitude,
        "accuracy_meters": accuracy_meters,
        "client_occurred_at": client_occurred_at,
        "dedupe_key": dedupe_key,
            "raw_payload": raw_payload,
            "metadata": json.dumps(metadata or {}),
        })).mappings().one()
    await session.commit()
    return row["id"], row["status"], row["received_at"]


@router.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "mode": "demo" if settings.demo_mode else "live",
    }


@router.get("/dashboard/summary")
async def dashboard_summary(session: AsyncSession | None = Depends(get_db)) -> dict:
    if settings.demo_mode:
        return demo_summary()
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    untriaged = await session.scalar(text("SELECT count(*) FROM cfr.sos_requests WHERE status = 'received'"))
    critical = await session.scalar(text("SELECT count(*) FROM cfr.verified_alerts WHERE severity = 'critical' AND (expires_at IS NULL OR expires_at > now())"))
    open_centers = await session.scalar(text("SELECT count(*) FROM cfr.evacuation_centers WHERE status = 'open'"))
    sos_rows = (await session.execute(text("""
        SELECT id, severity::text AS severity, status::text AS status, emergency_type,
               channel::text AS channel,
               COALESCE(NULLIF(metadata ->> 'barangay', ''), 'Location pending verification') AS barangay,
               ST_Y(location) AS latitude, ST_X(location) AS longitude, accuracy_meters,
               received_at, COALESCE(message, emergency_type) AS summary
        FROM cfr.sos_requests
        ORDER BY CASE severity
            WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 WHEN 'watch' THEN 3
            WHEN 'advisory' THEN 4 ELSE 5 END, received_at DESC
        LIMIT 100
    """))).mappings().all()
    alert_rows = (await session.execute(text("""
        SELECT id, source_name, source_event_id, title, body, severity::text AS severity,
               hazard::text AS hazard, issued_at, expires_at, source_url
        FROM cfr.verified_alerts
        WHERE expires_at IS NULL OR expires_at > now()
        ORDER BY issued_at DESC
        LIMIT 50
    """))).mappings().all()
    center_rows = (await session.execute(text("""
        SELECT id, name, barangay, status::text AS status, capacity_total, occupancy_current,
               amenities, ST_Y(geom) AS latitude, ST_X(geom) AS longitude
        FROM cfr.evacuation_centers
        ORDER BY status, name
    """))).mappings().all()
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "postgis",
        "freshness": "live",
        "metrics": {
            "untriaged_sos": int(untriaged or 0),
            "critical_alerts": int(critical or 0),
            "open_centers": int(open_centers or 0),
            "residents_at_risk": 0,
        },
        "sos": [{
            "id": str(row["id"]), "severity": row["severity"], "status": row["status"],
            "emergency_type": row["emergency_type"], "channel": row["channel"],
            "barangay": row["barangay"],
            "location": {"latitude": row["latitude"], "longitude": row["longitude"], "accuracy_meters": row["accuracy_meters"]},
            "received_at": row["received_at"].isoformat(), "summary": row["summary"],
        } for row in sos_rows],
        "alerts": [{
            "id": str(row["id"]), "source_name": row["source_name"], "source_event_id": row["source_event_id"],
            "title": row["title"], "body": row["body"], "severity": row["severity"], "hazard": row["hazard"],
            "issued_at": row["issued_at"].isoformat(), "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
            "source_url": row["source_url"],
        } for row in alert_rows],
        "centers": [{
            "id": str(row["id"]), "name": row["name"], "barangay": row["barangay"], "status": row["status"],
            "capacity_total": row["capacity_total"], "occupancy_current": row["occupancy_current"],
            "amenities": row["amenities"] if isinstance(row["amenities"], list) else [],
            "location": {"latitude": row["latitude"], "longitude": row["longitude"]},
        } for row in center_rows],
    }


async def _live_operations_snapshot(session: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    group_snapshot = await response_groups_snapshot(session)
    teams = [
        {
            "id": group.id,
            "name": group.name,
            "mission": group.current_assignment or group.group_type,
            "status": group.status,
            "lead": group.lead,
            "members": group.personnel_ready,
            "vehicle": group.vehicle_or_asset,
            "channel": group.contact_channel,
            "last_update": group.last_location_at,
        }
        for group in group_snapshot.groups
    ]
    resources = [
        {
            "id": group.id,
            "name": group.name,
            "category": group.group_type,
            "location": group.location_label,
            "available": group.personnel_ready,
            "total": group.personnel_total,
            "unit": "personnel",
            "status": group.availability,
            "owner": group.agency,
        }
        for group in group_snapshot.groups
    ]

    communication_rows = (await session.execute(text("""
        SELECT id, occurred_at, channel, to_unit, message, priority, status, operator
        FROM cfr.communication_events
        ORDER BY occurred_at DESC
        LIMIT 20
    """))).mappings().all()
    communications = [
        {
            "id": str(row["id"]),
            "title": row["message"],
            "audience": row["to_unit"],
            "channel": row["channel"],
            "status": row["status"],
            "owner": row["operator"],
            "sent_at": row["occurred_at"],
            "acknowledgements": 1 if row["status"] == "acknowledged" else 0,
            "target_count": 1,
            "priority": row["priority"],
        }
        for row in communication_rows
    ]

    readiness_rows = (await session.execute(text("""
        SELECT
            COALESCE(NULLIF(metadata ->> 'barangay', ''), 'Unassigned') AS barangay,
            count(*)::integer AS active_requests,
            max(received_at) AS last_contact,
            array_agg(DISTINCT emergency_type ORDER BY emergency_type) AS needs,
            max(severity::text) AS priority
        FROM cfr.sos_requests
        WHERE status NOT IN ('resolved', 'cancelled', 'duplicate')
        GROUP BY 1
        ORDER BY active_requests DESC, barangay
        LIMIT 20
    """))).mappings().all()
    readiness = [
        {
            "barangay": row["barangay"],
            "population_at_risk": row["active_requests"],
            "priority": row["priority"] or "medium",
            "evacuation_status": "triage_required",
            "assigned_center": None,
            "transport": "Dispatch assessment required",
            "last_contact": row["last_contact"],
            "needs": row["needs"] or [],
        }
        for row in readiness_rows
    ]

    hazard_rows = (await session.execute(text("""
        SELECT id, name, hazard::text AS hazard, severity::text AS severity, is_active,
               valid_from, updated_at, properties
        FROM cfr.hazard_zones
        WHERE valid_from <= now() AND (valid_until IS NULL OR valid_until > now())
        ORDER BY is_active DESC, updated_at DESC
        LIMIT 20
    """))).mappings().all()
    hazards = [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "type": row["hazard"],
            "severity": row["severity"],
            "status": "active" if row["is_active"] else "monitoring",
            "affected_area": (row["properties"] or {}).get("affected_area", "Spatial area on file"),
            "last_verified": row["updated_at"] or row["valid_from"],
            "action": (row["properties"] or {}).get("action", "Review hazard boundary before dispatch."),
        }
        for row in hazard_rows
    ]

    task_rows = (await session.execute(text("""
        SELECT id, emergency_type, severity::text AS severity, status, received_at
        FROM cfr.sos_requests
        WHERE status NOT IN ('resolved', 'cancelled', 'duplicate')
        ORDER BY received_at ASC
        LIMIT 20
    """))).mappings().all()
    tasks = [
        {
            "id": f"sos-task-{row['id']}",
            "title": f"Triage {row['emergency_type']} assistance request",
            "owner": "Duty dispatcher",
            "priority": row["severity"],
            "status": "open" if row["status"] == "received" else "in_progress",
            "due_by": None,
            "dependency": "Confirm current location and safe route" if row["status"] == "received" else None,
        }
        for row in task_rows
    ]

    return {
        "generated_at": now,
        "incident_phase": "response",
        "operating_period": "Current operating period",
        "objectives": [
            "Triage active SOS requests and preserve life-safety response capacity.",
            "Keep an open, verified evacuation option available for active risk areas.",
            "Maintain redundant communications and confirm field acknowledgements.",
            "Record dispatch, hazard review, and handover decisions for an auditable operational record.",
        ],
        "teams": teams,
        "resources": resources,
        "communications": communications,
        "readiness": readiness,
        "hazards": hazards,
        "tasks": tasks,
    }


@router.get("/dashboard/operations")
async def dashboard_operations(session: AsyncSession | None = Depends(get_db)) -> dict:
    if settings.demo_mode:
        return demo_operations_state()
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    return await _live_operations_snapshot(session)


@router.post("/dashboard/operations/actions")
async def dashboard_operations_action(
    payload: OperationsActionRequest,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> dict:
    if settings.demo_mode:
        return record_demo_operations_action(
            actor_user_id=str(actor.id),
            actor_role=actor.role,
            action=payload.action,
            resource_type=payload.resource_type,
            resource_id=payload.resource_id,
            note=payload.note,
        )
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")

    mutated = False
    if payload.action == "feeds.sync_requested" and payload.resource_type == "feed_source":
        result = await session.execute(text("""
            UPDATE cfr.external_feed_sources
            SET updated_at = now()
            RETURNING source_name
        """))
        mutated = result.first() is not None
    elif payload.action == "feed.health_checked" and payload.resource_type == "feed_source" and payload.resource_id:
        result = await session.execute(text("""
            UPDATE cfr.external_feed_sources
            SET updated_at = now()
            WHERE source_name = :resource_id
            RETURNING source_name
        """), {"resource_id": payload.resource_id})
        mutated = result.first() is not None
    elif payload.action == "response_group.checked_in" and payload.resource_type == "response_group" and payload.resource_id:
        result = await session.execute(text("""
            UPDATE cfr.resource_units
            SET last_check_in_at = now(), updated_at = now()
            WHERE id::text = :resource_id
            RETURNING id
        """), {"resource_id": payload.resource_id})
        mutated = result.first() is not None
    elif payload.action in {"center.capacity_verified", "centers.capacity_reviewed"} and payload.resource_type == "evacuation_center":
        if payload.action == "centers.capacity_reviewed" and not payload.resource_id:
            result = await session.execute(text("""
                UPDATE cfr.evacuation_centers
                SET updated_at = now()
                RETURNING id
            """))
        elif payload.resource_id:
            result = await session.execute(text("""
                UPDATE cfr.evacuation_centers
                SET updated_at = now()
                WHERE id::text = :resource_id
                RETURNING id
            """), {"resource_id": payload.resource_id})
        else:
            result = None
        mutated = result is not None and result.first() is not None
    elif payload.action == "resource.resupply_requested" and payload.resource_type == "resource" and payload.resource_id:
        result = await session.execute(text("""
            UPDATE cfr.resource_units
            SET updated_at = now()
            WHERE id::text = :resource_id
            RETURNING id
        """), {"resource_id": payload.resource_id})
        mutated = result.first() is not None

    await write_audit_event(
        session,
        actor=actor,
        action=payload.action,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
        metadata={"note": payload.note, "mutated_live_state": mutated},
    )
    return {
        "status": "recorded",
        "action_id": "audit-log",
        "action": payload.action,
        "resource_type": payload.resource_type,
        "resource_id": payload.resource_id,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "mutated": mutated,
        "message": "Updated live operational state." if mutated else "Audit recorded; no live state change was required.",
    }


@router.get("/response-groups", response_model=ResponseGroupSnapshot)
async def response_groups_snapshot(session: AsyncSession | None = Depends(get_db)) -> ResponseGroupSnapshot:
    if settings.demo_mode:
        return ResponseGroupSnapshot(**demo_response_groups())
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (await session.execute(text("""
        SELECT ru.id, ru.label, ru.owner, ru.kind, ru.agency, ru.group_type,
               ru.specialties, ru.state, ru.readiness_score, ru.personnel_ready,
               ru.personnel_total, ru.call_sign, ru.location_label,
               ru.location_source, ru.equipment, ru.constraints, ru.notes,
               ru.current_assignment,
               COALESCE(rp.reported_at, ru.updated_at) AS last_location_at,
               COALESCE(ru.last_check_in_at, ru.updated_at) AS last_check_in_at,
               rp.accuracy_meters, ST_Y(rp.geom) AS latitude, ST_X(rp.geom) AS longitude,
               CASE
                 WHEN ru.state IN ('ready') THEN 'available'
                 WHEN ru.state IN ('standby') THEN 'limited'
                 WHEN ru.state IN ('en_route', 'deployed') THEN 'assigned'
                 ELSE 'offline'
               END AS availability
        FROM cfr.resource_units ru
        LEFT JOIN LATERAL (
            SELECT reported_at, accuracy_meters, geom
            FROM cfr.resource_positions
            WHERE resource_id = ru.id
            ORDER BY reported_at DESC LIMIT 1
        ) rp ON TRUE
        ORDER BY ru.label
    """))).mappings().all()
    now = datetime.now(timezone.utc)
    groups = []
    for row in rows:
        last_location_at = row["last_location_at"] or now
        groups.append({
            "id": str(row["id"]), "name": row["label"], "agency": row["agency"] or row["owner"],
            "group_type": row["group_type"] or row["kind"], "specialties": row["specialties"] or [],
            "status": row["state"], "availability": row["availability"],
            "readiness_score": row["readiness_score"], "personnel_ready": row["personnel_ready"],
            "personnel_total": row["personnel_total"], "lead": row["owner"],
            "contact_channel": "Configured operations channel", "call_sign": row["call_sign"] or row["label"],
            "location": {"latitude": row["latitude"] or 11.1305, "longitude": row["longitude"] or 125.3970},
            "location_label": row["location_label"] or "Last known position",
            "location_source": row["location_source"] or "last_known", "last_location_at": last_location_at,
            "location_accuracy_meters": row["accuracy_meters"], "vehicle_or_asset": row["label"],
            "current_assignment": row["current_assignment"], "assignment_target": None,
            "estimated_response_minutes": None, "equipment": row["equipment"] or [],
            "constraints": row["constraints"] or [], "last_check_in_at": row["last_check_in_at"] or last_location_at,
            "notes": row["notes"],
        })
    specialties = sorted({item for group in groups for item in group["specialties"]})
    counts = {availability: sum(group["availability"] == availability for group in groups) for availability in ("available", "limited", "assigned", "standby", "offline")}
    stale = sum((now - group["last_location_at"]).total_seconds() > 15 * 60 for group in groups)
    return ResponseGroupSnapshot(generated_at=now, source="postgis", groups=groups, specialties=specialties, availability_counts=counts, stale_location_count=stale)


@router.post("/response-groups/assign", response_model=ResponseGroupAssignmentResult)
async def assign_response_group(
    payload: ResponseGroupAssignmentRequest,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> ResponseGroupAssignmentResult:
    """Create a dispatch proposal. No resource movement or notification occurs until an explicit confirmation."""
    assigned_at = datetime.now(timezone.utc)
    if settings.demo_mode:
        try:
            assignment = create_demo_dispatch_assignment(
                payload.group_id, payload.target_type, payload.target_id, payload.assignment_note, str(actor.id), actor.role,
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if assignment is None:
            raise HTTPException(status_code=404, detail="response group not found")
        group = next((item for item in demo_response_groups()["groups"] if item["id"] == payload.group_id), None)
        if group is None:
            raise HTTPException(status_code=404, detail="response group not found")
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role,
            action="dispatch.proposed", resource_type="response_group_assignment", resource_id=assignment["assignment_id"],
            note=payload.assignment_note or f"Proposal created for {payload.target_type} {payload.target_id}; human confirmation is pending.",
        )
        return ResponseGroupAssignmentResult(
            status="pending_confirmation", group=group, target_type=payload.target_type,
            target_id=payload.target_id, assignment_id=assignment["assignment_id"], assigned_at=assignment["created_at"],
        )
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    try:
        group_uuid = UUID(payload.group_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="group_id must be a UUID in live mode") from exc
    assigned_at = datetime.now(timezone.utc)
    current = (await session.execute(text("""
        SELECT ru.id, ru.state, ru.readiness_score,
               COALESCE(ru.last_check_in_at, ru.updated_at) AS last_check_in_at,
               COALESCE(rp.reported_at, ru.updated_at) AS last_location_at
        FROM cfr.resource_units ru
        LEFT JOIN LATERAL (
            SELECT reported_at FROM cfr.resource_positions
            WHERE resource_id = ru.id
            ORDER BY reported_at DESC LIMIT 1
        ) rp ON TRUE
        WHERE ru.id = :group_id
        FOR UPDATE
    """), {"group_id": str(group_uuid)})).mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="response group not found")
    if current["state"] in ("deployed", "en_route", "offline"):
        raise HTTPException(status_code=409, detail="response group is not available for a new assignment")
    freshness_limit_seconds = 15 * 60
    if current["last_location_at"] is None or (assigned_at - current["last_location_at"]).total_seconds() > freshness_limit_seconds:
        raise HTTPException(status_code=409, detail="group location is stale; record a position check before assigning")
    if current["last_check_in_at"] is None or (assigned_at - current["last_check_in_at"]).total_seconds() > freshness_limit_seconds:
        raise HTTPException(status_code=409, detail="group check-in is stale; record a roster check before assigning")
    if int(current["readiness_score"] or 0) < 60:
        raise HTTPException(status_code=409, detail="group readiness is below the dispatch threshold")
    assignment = (await session.execute(text("""
        INSERT INTO cfr.response_group_assignments (group_id, target_type, target_id, assignment_note, assigned_by_user_id, lifecycle_status)
        VALUES (:group_id, :target_type, :target_id, :assignment_note, :actor_id, 'pending_confirmation')
        RETURNING id, assigned_at
    """), {"group_id": str(group_uuid), "target_type": payload.target_type, "target_id": payload.target_id, "assignment_note": payload.assignment_note, "actor_id": str(actor.id)})).mappings().one()
    await session.execute(text("""
        INSERT INTO cfr.response_group_assignment_events (assignment_id, event_type, to_status, note, actor_user_id, actor_role)
        VALUES (:assignment_id, 'dispatch.proposed', 'pending_confirmation', :note, :actor_id, :actor_role)
    """), {"assignment_id": str(assignment["id"]), "note": payload.assignment_note, "actor_id": str(actor.id), "actor_role": actor.role})
    await write_audit_event(session, actor=actor, action="dispatch.proposed", resource_type="response_group_assignment", resource_id=str(assignment["id"]), metadata={"group_id": str(group_uuid), "target_type": payload.target_type, "target_id": payload.target_id, "confirmation_required": True})
    await session.commit()
    snapshot = await response_groups_snapshot(session)
    group = next(item for item in snapshot.groups if item.id == str(group_uuid))
    await manager.publish("lgu:response_groups", {"event": "dispatch.proposed", "group": group.model_dump(mode="json"), "assignment_id": str(assignment["id"])})
    return ResponseGroupAssignmentResult(status="pending_confirmation", group=group, target_type=payload.target_type, target_id=payload.target_id, assignment_id=str(assignment["id"]), assigned_at=assignment["assigned_at"])


async def _live_dispatch_lifecycle(session: AsyncSession, target_id: str | None = None) -> DispatchLifecycleSnapshot:
    rows = (await session.execute(text("""
        SELECT a.id, a.group_id, a.target_type, a.target_id, a.assignment_note, a.lifecycle_status,
               a.assigned_at, a.confirmed_at, a.acknowledged_at, a.escalated_at, a.cancelled_at, a.closed_at
        FROM cfr.response_group_assignments a
        WHERE (:target_id IS NULL OR a.target_id = :target_id)
        ORDER BY a.assigned_at DESC
        LIMIT 100
    """), {"target_id": target_id})).mappings().all()
    assignment_ids = [str(row["id"]) for row in rows]
    events_by_assignment: dict[str, list[DispatchLifecycleEvent]] = {item: [] for item in assignment_ids}
    if assignment_ids:
        events = (await session.execute(text("""
            SELECT id, assignment_id, event_type, from_status, to_status, note, actor_user_id, actor_role, occurred_at
            FROM cfr.response_group_assignment_events
            WHERE assignment_id = ANY(CAST(:assignment_ids AS uuid[]))
            ORDER BY occurred_at ASC
        """), {"assignment_ids": assignment_ids})).mappings().all()
        for event in events:
            events_by_assignment[str(event["assignment_id"])].append(DispatchLifecycleEvent(**dict(event)))
    assignments = [DispatchLifecycleAssignment(
        assignment_id=str(row["id"]), group_id=str(row["group_id"]), target_type=row["target_type"], target_id=row["target_id"],
        assignment_note=row["assignment_note"], status=row["lifecycle_status"], created_at=row["assigned_at"],
        confirmed_at=row["confirmed_at"], acknowledged_at=row["acknowledged_at"], escalated_at=row["escalated_at"],
        cancelled_at=row["cancelled_at"], closed_at=row["closed_at"], events=events_by_assignment[str(row["id"])],
    ) for row in rows]
    return DispatchLifecycleSnapshot(generated_at=datetime.now(timezone.utc), source="database", assignments=assignments)


@router.get("/response-groups/dispatch-lifecycle", response_model=DispatchLifecycleSnapshot)
async def dispatch_lifecycle_snapshot(target_id: str | None = Query(default=None), session: AsyncSession | None = Depends(get_db)) -> DispatchLifecycleSnapshot:
    if settings.demo_mode:
        return DispatchLifecycleSnapshot(**demo_dispatch_lifecycle(target_id))
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    return await _live_dispatch_lifecycle(session, target_id)


@router.post("/response-groups/assignments/{assignment_id}/transition", response_model=DispatchLifecycleAssignment)
async def transition_dispatch_lifecycle(
    assignment_id: str,
    payload: DispatchLifecycleTransitionRequest,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> DispatchLifecycleAssignment:
    """Advance only through human-recorded states; notification receipts are not lifecycle acknowledgement."""
    if settings.demo_mode:
        try:
            assignment = transition_demo_dispatch_assignment(assignment_id, payload.action, payload.note, payload.operator_confirmed, str(actor.id), actor.role)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if assignment is None:
            raise HTTPException(status_code=404, detail="dispatch assignment not found")
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role, action=f"dispatch.{assignment['status']}",
            resource_type="response_group_assignment", resource_id=assignment_id, note=payload.note or f"Dispatch transition recorded: {assignment['status']}.",
        )
        if payload.action == "confirm":
            group = next((item for item in demo_response_groups()["groups"] if item["id"] == assignment["group_id"]), None)
            if group is not None:
                await send_assignment_notification(group, assignment["target_type"], assignment["target_id"], assignment["assignment_note"], actor)
        await manager.publish("lgu:dispatch_lifecycle", {"event": f"dispatch.{assignment['status']}", "assignment": assignment})
        return DispatchLifecycleAssignment(**assignment)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    try:
        assignment_uuid = UUID(assignment_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="assignment_id must be a UUID in live mode") from exc
    row = (await session.execute(text("""
        SELECT a.id, a.group_id, a.target_type, a.target_id, a.assignment_note, a.lifecycle_status
        FROM cfr.response_group_assignments a WHERE a.id = :assignment_id FOR UPDATE
    """), {"assignment_id": str(assignment_uuid)})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="dispatch assignment not found")
    current = row["lifecycle_status"]
    transitions = {
        "confirm": (("pending_confirmation",), "confirmed"),
        "acknowledge": (("confirmed",), "acknowledged"),
        "escalate": (("confirmed", "acknowledged"), "escalated"),
        "cancel": (("pending_confirmation", "confirmed", "acknowledged", "escalated"), "cancelled"),
        "close": (("confirmed", "acknowledged", "escalated"), "closed"),
    }
    allowed_from, next_status = transitions[payload.action]
    if current not in allowed_from:
        raise HTTPException(status_code=409, detail=f"invalid dispatch lifecycle transition: {current} -> {payload.action}")
    if payload.action == "confirm" and not payload.operator_confirmed:
        raise HTTPException(status_code=409, detail="explicit operator confirmation is required before dispatch is recorded")
    if payload.action == "close" and not payload.note:
        raise HTTPException(status_code=422, detail="a closure note is required before closing a dispatch")
    time_field = {"confirmed": "confirmed_at", "acknowledged": "acknowledged_at", "escalated": "escalated_at", "cancelled": "cancelled_at", "closed": "closed_at"}[next_status]
    actor_field = {"confirmed": "confirmed_by_user_id", "acknowledged": "acknowledged_by_user_id"}.get(next_status)
    assignments_update = f"lifecycle_status = :next_status, {time_field} = now()"
    if actor_field:
        assignments_update += f", {actor_field} = :actor_id"
    if next_status == "closed":
        assignments_update += ", closure_note = :note, released_at = now()"
    if next_status == "cancelled":
        assignments_update += ", released_at = now()"
    await session.execute(text(f"UPDATE cfr.response_group_assignments SET {assignments_update} WHERE id = :assignment_id"), {"next_status": next_status, "note": payload.note, "actor_id": str(actor.id), "assignment_id": str(assignment_uuid)})
    await session.execute(text("""
        INSERT INTO cfr.response_group_assignment_events (assignment_id, event_type, from_status, to_status, note, actor_user_id, actor_role)
        VALUES (:assignment_id, :event_type, :from_status, :to_status, :note, :actor_id, :actor_role)
    """), {"assignment_id": str(assignment_uuid), "event_type": f"dispatch.{next_status}", "from_status": current, "to_status": next_status, "note": payload.note, "actor_id": str(actor.id), "actor_role": actor.role})
    if payload.action == "confirm":
        await session.execute(text("UPDATE cfr.resource_units SET state = 'en_route', current_assignment = :assignment WHERE id = :group_id"), {"assignment": row["assignment_note"] or f"Confirmed dispatch to {row['target_type']} {row['target_id']}", "group_id": str(row["group_id"])})
        if row["target_type"] == "sos_request":
            await session.execute(text("UPDATE cfr.sos_requests SET status = 'dispatched', updated_at = now() WHERE id = CAST(:target_id AS uuid) AND status = 'acknowledged'"), {"target_id": row["target_id"]})
    if payload.action in {"cancel", "close"}:
        await session.execute(text("UPDATE cfr.resource_units SET state = 'ready', current_assignment = NULL WHERE id = :group_id"), {"group_id": str(row["group_id"])})
    await write_audit_event(session, actor=actor, action=f"dispatch.{next_status}", resource_type="response_group_assignment", resource_id=str(assignment_uuid), metadata={"from_status": current, "note": payload.note, "operator_confirmed": payload.operator_confirmed})
    await session.commit()
    lifecycle = await _live_dispatch_lifecycle(session)
    assignment = next(item for item in lifecycle.assignments if item.assignment_id == str(assignment_uuid))
    if payload.action == "confirm":
        group_snapshot = await response_groups_snapshot(session)
        group = next(item for item in group_snapshot.groups if item.id == str(row["group_id"]))
        await send_assignment_notification(group, row["target_type"], row["target_id"], row["assignment_note"], actor, session=session, assignment_id=str(assignment_uuid))
    await manager.publish("lgu:dispatch_lifecycle", {"event": f"dispatch.{next_status}", "assignment": assignment.model_dump(mode="json")})
    return assignment


async def _live_incident_snapshot(session: AsyncSession) -> IncidentSnapshot:
    rows = (await session.execute(text("""
        SELECT i.id, i.status, i.severity, i.emergency_type, i.barangay, i.summary, i.follow_up_owner, i.follow_up_due_at, i.created_at, i.updated_at,
               COALESCE(array_remove(array_agg(l.sos_id::text), NULL), ARRAY[]::text[]) AS linked_sos_ids
        FROM cfr.incidents i LEFT JOIN cfr.incident_sos_links l ON l.incident_id = i.id
        GROUP BY i.id ORDER BY i.updated_at DESC LIMIT 200
    """))).mappings().all()
    incident_ids = [str(row["id"]) for row in rows]
    events_by_incident: dict[str, list[IncidentEvent]] = {incident_id: [] for incident_id in incident_ids}
    if incident_ids:
        events = (await session.execute(text("""
            SELECT id, incident_id, action, from_status, to_status, note, actor_user_id, actor_role, occurred_at
            FROM cfr.incident_events WHERE incident_id = ANY(CAST(:incident_ids AS uuid[])) ORDER BY occurred_at ASC
        """), {"incident_ids": incident_ids})).mappings().all()
        for event in events:
            event_payload = {**dict(event), "id": str(event["id"]), "incident_id": str(event["incident_id"]), "actor_user_id": str(event["actor_user_id"]) if event["actor_user_id"] else None}
            events_by_incident[str(event["incident_id"])].append(IncidentEvent(**event_payload))
    return IncidentSnapshot(generated_at=datetime.now(timezone.utc), source="database", incidents=[IncidentRecord(**({**dict(row), "id": str(row["id"]), "linked_sos_ids": list(row["linked_sos_ids"] or []), "events": events_by_incident[str(row["id"])]})) for row in rows])


@router.get("/incidents", response_model=IncidentSnapshot)
async def incident_snapshot(session: AsyncSession | None = Depends(get_db)) -> IncidentSnapshot:
    """List command records; records organize evidence but do not verify conditions or authorize actions."""
    if settings.demo_mode:
        return IncidentSnapshot(**demo_incidents())
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    return await _live_incident_snapshot(session)


@router.post("/incidents/from-sos/{sos_id}", response_model=IncidentRecord, status_code=201)
async def create_incident_from_sos(
    sos_id: str, payload: IncidentFromSosRequest, session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> IncidentRecord:
    """Create a human-owned command record from SOS evidence without changing SOS or dispatch state."""
    if settings.demo_mode:
        record = create_demo_incident_from_sos(sos_id, payload.summary, payload.follow_up_owner, payload.follow_up_due_at.isoformat() if payload.follow_up_due_at else None, str(actor.id), actor.role)
        if record is None:
            raise HTTPException(status_code=404, detail="SOS record not found")
        await manager.publish("lgu:incidents", {"event": "incident.created", "incident": record})
        return IncidentRecord(**record)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    sos = (await session.execute(text("""SELECT id, severity::text, emergency_type, COALESCE(message, emergency_type) AS summary FROM cfr.sos_requests WHERE id = CAST(:sos_id AS uuid)"""), {"sos_id": sos_id})).mappings().first()
    if sos is None:
        raise HTTPException(status_code=404, detail="SOS record not found")
    existing = (await session.execute(text("""SELECT incident_id FROM cfr.incident_sos_links WHERE sos_id = CAST(:sos_id AS uuid) LIMIT 1"""), {"sos_id": sos_id})).scalar()
    if existing:
        snapshot = await _live_incident_snapshot(session)
        return next(item for item in snapshot.incidents if item.id == str(existing))
    row = (await session.execute(text("""
        INSERT INTO cfr.incidents (severity, emergency_type, barangay, summary, follow_up_owner, follow_up_due_at)
        SELECT :severity, :emergency_type, COALESCE(metadata->>'barangay', 'Location pending verification'), :summary, :owner, :due
        FROM cfr.sos_requests WHERE id = CAST(:sos_id AS uuid)
        RETURNING id
    """), {"sos_id": sos_id, "severity": sos["severity"], "emergency_type": sos["emergency_type"], "summary": payload.summary or sos["summary"], "owner": payload.follow_up_owner, "due": payload.follow_up_due_at})).mappings().one()
    incident_id = str(row["id"])
    await session.execute(text("""INSERT INTO cfr.incident_sos_links (incident_id, sos_id, linked_by_user_id) VALUES (CAST(:incident_id AS uuid), CAST(:sos_id AS uuid), :actor_id)"""), {"incident_id": incident_id, "sos_id": sos_id, "actor_id": str(actor.id)})
    await session.execute(text("""INSERT INTO cfr.incident_events (incident_id, action, to_status, note, actor_user_id, actor_role) VALUES (CAST(:incident_id AS uuid), 'created_from_sos', 'open', 'Human-created incident record from SOS evidence.', :actor_id, :actor_role)"""), {"incident_id": incident_id, "actor_id": str(actor.id), "actor_role": actor.role})
    await write_audit_event(session, actor=actor, action="incident.created", resource_type="incident", resource_id=incident_id, metadata={"sos_id": sos_id})
    await session.commit()
    snapshot = await _live_incident_snapshot(session)
    record = next(item for item in snapshot.incidents if item.id == incident_id)
    await manager.publish("lgu:incidents", {"event": "incident.created", "incident": record.model_dump(mode="json")})
    return record


@router.post("/incidents/{incident_id}/transition", response_model=IncidentRecord)
async def transition_incident(
    incident_id: str, payload: IncidentTransitionRequest, session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> IncidentRecord:
    """Record an explicit human state transition; closing requires accountable follow-up and never cancels response tasking."""
    if settings.demo_mode:
        if payload.action == "close" and (not payload.follow_up_owner or not payload.follow_up_due_at):
            raise HTTPException(status_code=422, detail="closure requires follow-up owner and due date")
        try:
            record = transition_demo_incident(incident_id, payload.action, payload.note, payload.follow_up_owner, payload.follow_up_due_at.isoformat() if payload.follow_up_due_at else None, str(actor.id), actor.role)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if record is None:
            raise HTTPException(status_code=404, detail="incident record not found")
        await manager.publish("lgu:incidents", {"event": f"incident.{payload.action}", "incident": record})
        return IncidentRecord(**record)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    target_status = {"monitor": "monitoring", "escalate": "escalated", "stabilize": "stabilized", "close": "closed", "reopen": "reopened"}[payload.action]
    if payload.action == "close" and (not payload.follow_up_owner or not payload.follow_up_due_at):
        raise HTTPException(status_code=422, detail="closure requires follow-up owner and due date")
    row = (await session.execute(text("""SELECT id, status FROM cfr.incidents WHERE id = CAST(:incident_id AS uuid) FOR UPDATE"""), {"incident_id": incident_id})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="incident record not found")
    if row["status"] == target_status:
        raise HTTPException(status_code=409, detail="incident is already in that state")
    await session.execute(text("""UPDATE cfr.incidents SET status = :status, follow_up_owner = COALESCE(:owner, follow_up_owner), follow_up_due_at = COALESCE(:due, follow_up_due_at), updated_at = now() WHERE id = CAST(:incident_id AS uuid)"""), {"status": target_status, "owner": payload.follow_up_owner, "due": payload.follow_up_due_at, "incident_id": incident_id})
    await session.execute(text("""INSERT INTO cfr.incident_events (incident_id, action, from_status, to_status, note, actor_user_id, actor_role) VALUES (CAST(:incident_id AS uuid), :action, :from_status, :to_status, :note, :actor_id, :actor_role)"""), {"incident_id": incident_id, "action": payload.action, "from_status": row["status"], "to_status": target_status, "note": payload.note, "actor_id": str(actor.id), "actor_role": actor.role})
    await write_audit_event(session, actor=actor, action=f"incident.{payload.action}", resource_type="incident", resource_id=incident_id, metadata={"from_status": row["status"], "to_status": target_status, "follow_up_owner": payload.follow_up_owner, "follow_up_due_at": payload.follow_up_due_at.isoformat() if payload.follow_up_due_at else None})
    await session.commit()
    snapshot = await _live_incident_snapshot(session)
    record = next(item for item in snapshot.incidents if item.id == incident_id)
    await manager.publish("lgu:incidents", {"event": f"incident.{payload.action}", "incident": record.model_dump(mode="json")})
    return record


@router.get("/notifications", response_model=NotificationSnapshot)
async def notification_snapshot(session: AsyncSession | None = Depends(get_db)) -> NotificationSnapshot:
    if settings.demo_mode:
        return NotificationSnapshot(**demo_notifications())
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (await session.execute(text("""
        SELECT id, group_id, target_type, target_id, channel, status, message, recipient_label, recipient_address,
               created_at, sent_at, delivered_at, acknowledged_at, attempts, last_error, assignment_note, actor_user_id
        FROM cfr.assignment_notifications
        ORDER BY created_at DESC LIMIT 100
    """))).mappings().all()
    notifications = [AssignmentNotification(**(dict(row) | {"channels": [row["channel"]]})) for row in rows]
    return NotificationSnapshot(
        generated_at=datetime.now(timezone.utc), source="database", notifications=notifications,
        pending_count=sum(item.status in {"queued", "sending", "failed"} for item in notifications),
        failed_count=sum(item.status == "failed" for item in notifications),
    )


@router.post("/notifications/{notification_id}/acknowledge", response_model=AssignmentNotification)
async def acknowledge_notification(
    notification_id: str,
    payload: NotificationAcknowledgement,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> AssignmentNotification:
    if settings.demo_mode:
        notification = acknowledge_demo_notification(notification_id, payload.note, str(actor.id))
        if notification is None:
            raise HTTPException(status_code=404, detail="notification not found")
        await manager.publish("lgu:notifications", {"event": "notification.acknowledged", "notification": notification})
        return AssignmentNotification(**notification)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    row = (await session.execute(text("""
        UPDATE cfr.assignment_notifications
        SET status = 'acknowledged', acknowledged_at = now(), last_error = NULL
        WHERE id = :id
        RETURNING id, group_id, target_type, target_id, channel, status, message, recipient_label, recipient_address,
                  created_at, sent_at, delivered_at, acknowledged_at, attempts, last_error, assignment_note, actor_user_id
    """), {"id": notification_id})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="notification not found")
    await write_audit_event(
        session,
        actor=actor,
        action="notification.acknowledged",
        resource_type="assignment_notification",
        resource_id=notification_id,
        metadata={"note": payload.note} if payload.note else {},
    )
    await session.commit()
    notification = AssignmentNotification(**(dict(row) | {"channels": [row["channel"]]}))
    await manager.publish("lgu:notifications", {"event": "notification.acknowledged", "notification": notification.model_dump(mode="json")})
    return notification


@router.post("/notifications/{notification_id}/retry", response_model=AssignmentNotification)
async def retry_assignment_notification(
    notification_id: str,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "admin")),
) -> AssignmentNotification:
    notification = await retry_notification(notification_id, session, actor)
    if notification is None:
        raise HTTPException(status_code=404, detail="notification not found")
    return AssignmentNotification(**notification)


@router.get("/coordination/communications", response_model=CommunicationSnapshot)
async def coordination_communications(session: AsyncSession | None = Depends(get_db)) -> CommunicationSnapshot:
    if settings.demo_mode:
        return CommunicationSnapshot(**demo_communications())
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (await session.execute(text("""
        SELECT id, occurred_at, direction, channel, from_unit, to_unit, message, priority, status,
               acknowledged_at, linked_incident_id, operator
        FROM cfr.communication_events ORDER BY occurred_at DESC LIMIT 50
    """))).mappings().all()
    audio = (await session.execute(text("""
        SELECT id, started_at, duration_seconds, channel, from_unit, to_unit, transcript, priority,
               status, linked_incident_id, waveform
        FROM cfr.audio_dispatch_items ORDER BY started_at DESC LIMIT 12
    """))).mappings().all()
    return CommunicationSnapshot(
        generated_at=datetime.now(timezone.utc), source="database",
        events=[dict(row) for row in rows], audio_feed=[dict(row) for row in audio],
        channel_health={"VHF": "clear", "HF": "clear", "SMS": "clear", "phone": "clear", "field_runner": "clear"},
        unread_count=sum(row["status"] == "received" for row in rows),
    )


@router.post("/coordination/communications", response_model=dict)
async def create_coordination_communication(
    payload: CommunicationEventCreate,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> dict:
    if settings.demo_mode:
        event = record_demo_communication(
            operator=actor.display_name or actor.role, channel=payload.channel, to_unit=payload.to_unit,
            message=payload.message, priority=payload.priority, linked_incident_id=payload.linked_incident_id,
            simulate_audio=payload.simulate_audio,
        )
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role, action="communication.sent",
            resource_type="communication_event", resource_id=event["id"], note=payload.message,
        )
        await manager.publish("lgu:communications", {"event": "communication.sent", "communication": event})
        return {"status": "sent", "communication": event}
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    result = (await session.execute(text("""
        INSERT INTO cfr.communication_events (direction, channel, from_unit, to_unit, message, priority, status, linked_incident_id, operator)
        VALUES ('outbound', :channel, 'Command', :to_unit, :message, :priority, 'sent', CAST(:incident_id AS uuid), :operator)
        RETURNING id, occurred_at, direction, channel, from_unit, to_unit, message, priority, status, acknowledged_at, linked_incident_id, operator
    """), {"channel": payload.channel, "to_unit": payload.to_unit, "message": payload.message, "priority": payload.priority, "incident_id": payload.linked_incident_id, "operator": actor.display_name or actor.role})).mappings().one()
    await write_audit_event(session, actor=actor, action="communication.sent", resource_type="communication_event", resource_id=str(result["id"]), metadata={"to_unit": payload.to_unit, "priority": payload.priority})
    await session.commit()
    event = dict(result)
    await manager.publish("lgu:communications", {"event": "communication.sent", "communication": event})
    return {"status": "sent", "communication": event}


@router.post("/coordination/recommendations", response_model=RecommendationResponse)
async def coordination_recommendations(
    payload: RecommendationRequest,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> RecommendationResponse:
    if settings.demo_mode:
        result = RecommendationResponse(**demo_dispatch_recommendations(
            incident_id=payload.incident_id, severity=payload.severity, emergency_type=payload.emergency_type,
            latitude=payload.latitude, longitude=payload.longitude, required_specialties=payload.required_specialties,
            max_results=payload.max_results,
        ))
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role, action="dispatch.recommendations_generated",
            resource_type="dispatch_recommendation", resource_id=payload.incident_id,
            note=f"Generated {len(result.recommendations)} ranked recommendations using {result.engine_version}.",
        )
        return result
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    snapshot = await response_groups_snapshot(session)
    result = build_dispatch_recommendations(
        groups=[group.model_dump(mode="json") for group in snapshot.groups],
        incident_id=payload.incident_id,
        severity=payload.severity,
        emergency_type=payload.emergency_type,
        latitude=payload.latitude,
        longitude=payload.longitude,
        required_specialties=payload.required_specialties,
        max_results=payload.max_results,
        source="postgis-engine",
    )
    response = RecommendationResponse(**result)
    await write_audit_event(
        session,
        actor=actor,
        action="dispatch.recommendations_generated",
        resource_type="dispatch_recommendation",
        resource_id=payload.incident_id,
        metadata={"recommendation_count": len(response.recommendations), "engine_version": response.engine_version},
    )
    await session.commit()
    return response


def _geojson_ring(raw_geojson: str | None) -> list[dict]:
    if not raw_geojson:
        return []
    try:
        geometry = json.loads(raw_geojson)
        coordinates = geometry.get("coordinates", [])
        if geometry.get("type") == "MultiPolygon":
            ring = coordinates[0][0]
        else:
            ring = coordinates[0]
        return [{"latitude": float(lat), "longitude": float(lon)} for lon, lat in ring]
    except (IndexError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return []


@router.get("/gis/map", response_model=GisMapSnapshot)
async def gis_map_snapshot(session: AsyncSession | None = Depends(get_db)) -> GisMapSnapshot:
    if settings.demo_mode:
        return GisMapSnapshot(**demo_gis_map())
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")

    resources = (await session.execute(text("""
        SELECT ru.id, ru.label, ru.kind, ru.owner, ru.state, ru.current_assignment,
               rp.reported_at, ST_Y(rp.geom) AS latitude, ST_X(rp.geom) AS longitude,
               rp.accuracy_meters, rp.heading_degrees, rp.speed_kph, rp.battery_pct, rp.source
        FROM cfr.resource_units ru
        LEFT JOIN LATERAL (
            SELECT * FROM cfr.resource_positions
            WHERE resource_id = ru.id ORDER BY reported_at DESC LIMIT 1
        ) rp ON TRUE
        ORDER BY ru.label
    """))).mappings().all()
    hazards = (await session.execute(text("""
        SELECT id, name, hazard::text, severity::text,
               CASE WHEN is_active THEN 'active' ELSE 'cleared' END AS status,
               ST_AsGeoJSON(geom) AS polygon, updated_at AS last_verified,
               COALESCE(properties->>'action', 'Review movement constraint.') AS action
        FROM cfr.hazard_zones
        WHERE valid_from <= now() AND (valid_until IS NULL OR valid_until > now())
        ORDER BY severity DESC, updated_at DESC
    """))).mappings().all()
    centers = (await session.execute(text("""
        SELECT id, name, status::text, capacity_total, occupancy_current,
               ST_Y(geom) AS latitude, ST_X(geom) AS longitude
        FROM cfr.evacuation_centers ORDER BY name
    """))).mappings().all()
    sos = (await session.execute(text("""
        SELECT id, status::text, severity::text, ST_Y(location) AS latitude,
               ST_X(location) AS longitude, accuracy_meters, COALESCE(message, emergency_type) AS summary
        FROM cfr.sos_requests
        WHERE resolved_at IS NULL ORDER BY received_at DESC LIMIT 100
    """))).mappings().all()
    source_health = await _source_health_snapshot(session)
    return GisMapSnapshot(
        generated_at=datetime.now(timezone.utc),
        source="postgis",
        center={"latitude": 11.1305, "longitude": 125.3970},
        bbox=[125.3820, 11.1200, 125.4100, 11.1450],
        resources=[GisResource(
            id=row["id"], label=row["label"], kind=row["kind"], owner=row["owner"], state=row["state"],
            position={"latitude": row["latitude"] or 11.1305, "longitude": row["longitude"] or 125.3970},
            reported_at=row["reported_at"], accuracy_meters=row["accuracy_meters"],
            heading_degrees=row["heading_degrees"], speed_kph=row["speed_kph"], battery_pct=row["battery_pct"],
            current_assignment=row["current_assignment"], last_update_source=row["source"],
        ) for row in resources],
        hazards=[GisHazard(
            id=row["id"], name=row["name"], hazard=row["hazard"], severity=row["severity"], status=row["status"],
            polygon=_geojson_ring(row["polygon"]), last_verified=row["last_verified"], action=row["action"],
        ) for row in hazards],
        centers=[GisCenter(
            id=row["id"], name=row["name"], status=row["status"], capacity_total=row["capacity_total"],
            occupancy_current=row["occupancy_current"], position={"latitude": row["latitude"], "longitude": row["longitude"]},
        ) for row in centers],
        sos=[GisSosPoint(
            id=row["id"], status=row["status"], severity=row["severity"],
            position={"latitude": row["latitude"], "longitude": row["longitude"]},
            accuracy_meters=row["accuracy_meters"], summary=row["summary"],
        ) for row in sos],
        source_health=source_health,
    )


NOAH_DATA_DIRECTORY = Path(__file__).resolve().parents[1] / "data" / "noah"
OFFICIAL_FACILITY_REGISTRY_PATH = Path(__file__).resolve().parents[1] / "data" / "facilities" / "official_balangiga_health_registry.json"


def _reference_last_changed(path: Path) -> datetime | None:
    if not path.exists():
        return None
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)


def _static_source_health() -> list[MapSourceHealth]:
    """Describe packaged map references without presenting them as live operational feeds."""
    return [
        MapSourceHealth(
            id="project-noah-reference",
            label="Project NOAH modeled hazard references",
            category="hazard_reference",
            provenance_url="https://noah.up.edu.ph/",
            last_success_at=_reference_last_changed(NOAH_DATA_DIRECTORY / "manifest.json"),
            last_checked_at=_reference_last_changed(NOAH_DATA_DIRECTORY / "manifest.json"),
            status="reference_only" if (NOAH_DATA_DIRECTORY / "manifest.json").exists() else "unavailable",
            review_required=True,
            decision_limit="Static modeled reference context only; it does not confirm active hazards, route clearance, or field safety.",
        ),
        MapSourceHealth(
            id="official-facility-registry",
            label="Official DOH facility reference registry",
            category="facility_reference",
            provenance_url="https://hfsrb.doh.gov.ph/",
            last_success_at=_reference_last_changed(OFFICIAL_FACILITY_REGISTRY_PATH),
            last_checked_at=_reference_last_changed(OFFICIAL_FACILITY_REGISTRY_PATH),
            status="reference_only" if OFFICIAL_FACILITY_REGISTRY_PATH.exists() else "unavailable",
            review_required=True,
            decision_limit="Reference locations and service classification only; LGU/DRRMO or facility verification is required before readiness, access, or availability is relied on.",
        ),
    ]


async def _source_health_snapshot(session: AsyncSession | None = None) -> list[MapSourceHealth]:
    if settings.demo_mode:
        now = datetime.now(timezone.utc)
        feed_items = demo_feed_health()
        records = [
            MapSourceHealth(
                id=f"alert-feed-{item['source_name'].lower().replace(' ', '-')}",
                label=item["source_name"],
                category="alert_feed",
                provenance_url=item.get("endpoint_url"),
                last_success_at=item.get("last_success_at"),
                last_checked_at=item.get("last_checked_at") or item.get("last_success_at"),
                stale_after_seconds=settings.alert_stale_after_seconds,
                status="stale" if item.get("stale") else "healthy",
                review_required=True,
                decision_limit="Feed freshness supports review only; verify an alert with the issuing authority and local observations before acting or warning the public.",
            ) for item in feed_items
        ]
        return records + _static_source_health()
    if session is None:
        return _static_source_health()
    rows = (await session.execute(text("""
        SELECT source_name, endpoint_url, last_success_at, last_error_at
        FROM cfr.external_feed_sources
        ORDER BY source_name
    """))).mappings().all()
    now = datetime.now(timezone.utc)
    records = []
    for row in rows:
        last_success_at = row["last_success_at"]
        stale = last_success_at is None or (now - last_success_at).total_seconds() > settings.alert_stale_after_seconds
        records.append(MapSourceHealth(
            id=f"alert-feed-{row['source_name'].lower().replace(' ', '-')}",
            label=row["source_name"],
            category="alert_feed",
            provenance_url=row["endpoint_url"],
            last_success_at=last_success_at,
            last_checked_at=row["last_error_at"] or last_success_at,
            stale_after_seconds=settings.alert_stale_after_seconds,
            status="stale" if stale else "healthy",
            review_required=True,
            decision_limit="Feed freshness supports review only; verify an alert with the issuing authority and local observations before acting or warning the public.",
        ))
    return records + _static_source_health()


@router.get("/gis/source-health", response_model=list[MapSourceHealth])
async def gis_source_health(session: AsyncSession | None = Depends(get_db)) -> list[MapSourceHealth]:
    """Expose provenance and freshness status without silently refreshing or authorizing a decision."""
    if settings.demo_mode:
        return await _source_health_snapshot()
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    return await _source_health_snapshot(session)


@router.post("/gis/source-health/review", response_model=SourceHealthReviewResult)
async def review_gis_source_health(
    payload: SourceHealthReviewRequest,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> SourceHealthReviewResult:
    """Record a human review; never refresh a source, clear a route, or authorize an operational action."""
    records = await _source_health_snapshot(session if not settings.demo_mode else None)
    record = next((item for item in records if item.id == payload.source_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="source-health record not found")
    note = payload.review_note or f"Reviewed {record.label} provenance and freshness."
    if settings.demo_mode:
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role,
            action="gis.source_health_reviewed", resource_type="map_source", resource_id=record.id, note=note,
        )
    else:
        if session is None:
            raise HTTPException(status_code=503, detail="database unavailable")
        await write_audit_event(
            session, actor=actor, action="gis.source_health_reviewed", resource_type="map_source", resource_id=record.id,
            metadata={"source_label": record.label, "source_status": record.status, "review_note": payload.review_note},
        )
        await session.commit()
    return SourceHealthReviewResult(
        source_id=record.id, reviewed_at=datetime.now(timezone.utc), status=record.status,
        decision_limit=record.decision_limit,
    )


@lru_cache(maxsize=1)
def _noah_manifest() -> dict:
    manifest_path = NOAH_DATA_DIRECTORY / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=503, detail="Project NOAH reference context is not installed.")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _official_facility_registry() -> dict:
    if not OFFICIAL_FACILITY_REGISTRY_PATH.exists():
        raise HTTPException(status_code=503, detail="Official facility registry is not installed.")
    return json.loads(OFFICIAL_FACILITY_REGISTRY_PATH.read_text(encoding="utf-8"))


@router.get("/gis/noah/context", response_model=NoahMapContext)
async def noah_map_context() -> NoahMapContext:
    """Return versioned Project NOAH reference metadata, never an active-hazard assertion."""
    manifest = _noah_manifest()
    return NoahMapContext(
        provider=manifest["provider"],
        dataset_title=manifest["dataset_title"],
        dataset_url=manifest["dataset_url"],
        license=manifest["license"],
        attribution=manifest["attribution"],
        source_geometry_dates=manifest["source_geometry_dates"],
        focus_bbox=manifest["focus_bbox"],
        decision_limit=manifest["decision_limit"],
        layers=[NoahOverlayLayer(**layer, overlay_url=f"/api/v1/gis/noah/overlays/{layer['id']}") for layer in manifest["layers"]],
        critical_facilities=manifest["critical_facilities"],
    )


@router.get("/gis/facilities/official-registry", response_model=OfficialFacilityRegistry)
async def official_facility_registry() -> OfficialFacilityRegistry:
    """Return source-backed facility references; never current readiness or access assertions."""
    registry = _official_facility_registry()
    return OfficialFacilityRegistry(
        provider=registry["provider"],
        scope=registry["scope"],
        source_status=registry["source_status"],
        decision_limit=registry["decision_limit"],
        facilities=[OfficialFacilityRecord(**facility) for facility in registry["facilities"]],
    )


@router.get("/gis/facilities/verifications", response_model=FacilityVerificationSnapshot)
async def facility_verification_snapshot(
    facility_id: str | None = Query(default=None),
    session: AsyncSession | None = Depends(get_db),
) -> FacilityVerificationSnapshot:
    """List human-entered reference checks; no result communicates readiness, access clearance, or suitability."""
    if settings.demo_mode:
        return FacilityVerificationSnapshot(**demo_facility_verifications(facility_id))
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (await session.execute(text("""
        SELECT id, facility_id, coordinate_confirmed, contact_attempted, reported_access, verification_outcome,
               source_document_reference, revalidation_due_at, verification_note, verified_by_user_id, verified_by_role, verified_at
        FROM cfr.facility_verifications
        WHERE (:facility_id IS NULL OR facility_id = :facility_id)
        ORDER BY verified_at DESC LIMIT 200
    """), {"facility_id": facility_id})).mappings().all()
    return FacilityVerificationSnapshot(
        generated_at=datetime.now(timezone.utc), source="database",
        records=[FacilityVerificationRecord(**({**dict(row), "id": str(row["id"]), "verified_by_user_id": str(row["verified_by_user_id"]) if row["verified_by_user_id"] else None})) for row in rows],
    )


@router.post("/gis/facilities/verifications", response_model=FacilityVerificationRecord, status_code=201)
async def record_facility_verification(
    payload: FacilityVerificationCreate,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> FacilityVerificationRecord:
    """Store a human reference check; intentionally does not turn a facility into a ready or cleared resource."""
    registry = _official_facility_registry()
    if not any(item["id"] == payload.facility_id for item in registry["facilities"]):
        raise HTTPException(status_code=404, detail="official facility reference not found")
    if settings.demo_mode:
        record = create_demo_facility_verification(
            facility_id=payload.facility_id, coordinate_confirmed=payload.coordinate_confirmed,
            contact_attempted=payload.contact_attempted, reported_access=payload.reported_access,
            verification_outcome=payload.verification_outcome, source_document_reference=payload.source_document_reference,
            revalidation_due_at=payload.revalidation_due_at.isoformat(), verification_note=payload.verification_note,
            actor_user_id=str(actor.id), actor_role=actor.role,
        )
        await manager.publish("lgu:facilities", {"event": "facility.verification_recorded", "record": record})
        return FacilityVerificationRecord(**record)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    row = (await session.execute(text("""
        INSERT INTO cfr.facility_verifications (
            facility_id, coordinate_confirmed, contact_attempted, reported_access, verification_outcome,
            source_document_reference, revalidation_due_at, verification_note, verified_by_user_id, verified_by_role
        ) VALUES (
            :facility_id, :coordinate_confirmed, :contact_attempted, :reported_access, :verification_outcome,
            :source_document_reference, :revalidation_due_at, :verification_note, :actor_id, :actor_role
        )
        RETURNING id, facility_id, coordinate_confirmed, contact_attempted, reported_access, verification_outcome,
                  source_document_reference, revalidation_due_at, verification_note, verified_by_user_id, verified_by_role, verified_at
    """), {**payload.model_dump(), "actor_id": str(actor.id), "actor_role": actor.role})).mappings().one()
    await write_audit_event(
        session, actor=actor, action="facility.verification_recorded", resource_type="official_facility", resource_id=payload.facility_id,
        metadata={"coordinate_confirmed": payload.coordinate_confirmed, "contact_attempted": payload.contact_attempted, "reported_access": payload.reported_access, "verification_outcome": payload.verification_outcome, "source_document_reference": payload.source_document_reference, "revalidation_due_at": payload.revalidation_due_at.isoformat()},
    )
    await session.commit()
    record = FacilityVerificationRecord(**({**dict(row), "id": str(row["id"]), "verified_by_user_id": str(row["verified_by_user_id"]) if row["verified_by_user_id"] else None}))
    await manager.publish("lgu:facilities", {"event": "facility.verification_recorded", "record": record.model_dump(mode="json")})
    return record


@router.get("/gis/noah/overlays/{layer_id}")
async def noah_overlay(layer_id: str) -> FileResponse:
    """Serve a bounded, pre-rendered NOAH reference overlay for the Balangiga map extent."""
    manifest = _noah_manifest()
    layer = next((item for item in manifest["layers"] if item["id"] == layer_id), None)
    if layer is None:
        raise HTTPException(status_code=404, detail="Project NOAH overlay not found.")
    overlay_path = NOAH_DATA_DIRECTORY / layer["file"]
    if not overlay_path.exists():
        raise HTTPException(status_code=503, detail="Project NOAH overlay asset is unavailable.")
    return FileResponse(overlay_path, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/weather/radar")
async def weather_radar() -> dict:
    """Recent public radar-frame metadata for display-only weather overlay use."""
    return await get_radar_snapshot()


@router.get("/weather/typhoon")
async def weather_typhoon() -> dict:
    """PAGASA bulletin snapshot for decision support, never route-safety confirmation."""
    return await get_typhoon_snapshot()


@router.get("/weather/map-overlays")
async def weather_map_overlays() -> dict:
    """Composite Command Map overlay contract with explicit provider-access states.

    Pending PAGASA radar/station/satellite and licensed-lightning layers are
    returned as disabled states until their access terms are approved. The route
    never turns absent data into a no-hazard, safe-route, or dispatch decision.
    """
    return await get_map_overlays_snapshot()


@router.get("/weather/provincial-situation")
async def provincial_weather_situation() -> dict:
    """Official-source provincial situation with static Project NOAH references.

    The response intentionally distinguishes PAGASA's live regional narrative
    from Project NOAH's static hazard models. Neither establishes field safety,
    road passability, damage, or evacuation readiness.
    """
    return await get_provincial_weather_snapshot()


@router.post("/weather/flood-risk-assessment")
async def flood_risk_assessment(
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "admin")),
) -> dict:
    """Evaluate current official-source evidence for coordinator review only.

    The action never transmits a public alert, creates an evacuation order, or
    turns Project NOAH's static reference layer into a live flood claim.
    """
    assessment = await evaluate_high_flood_risk()
    note = f"Operator-triggered flood-risk assessment returned {assessment['risk_level']} with coordinator review required."
    if settings.demo_mode:
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role,
            action="weather.flood_risk_assessed", resource_type="flood_risk_assessment",
            resource_id=assessment["assessment_id"], note=note,
        )
    else:
        if session is None:
            raise HTTPException(status_code=503, detail="database unavailable")
        await write_audit_event(
            session, actor=actor, action="weather.flood_risk_assessed",
            resource_type="flood_risk_assessment", resource_id=assessment["assessment_id"],
            metadata={"risk_level": assessment["risk_level"], "source_freshness": assessment["source_freshness"], "public_communication_sent": False},
        )
        await session.commit()
    await manager.publish("lgu:operations", {"event": "weather.flood_risk_assessed", "assessment": assessment})
    return assessment


@router.post("/sos/responder-safety-assessment")
async def responder_safety_assessment(
    payload: ResponderSafetyAssessmentRequest,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "admin")),
) -> dict:
    """Assess responder exposure for a verified SOS without dispatching anyone.

    Verification is represented by an acknowledged, verified, or dispatched SOS.
    The existing assignment endpoint remains the only place that can assign a group.
    """
    if settings.demo_mode:
        incident = next((item for item in demo_summary()["sos"] if item["id"] == payload.sos_id), None)
        if incident is None:
            raise HTTPException(status_code=404, detail="SOS incident not found")
        groups = demo_response_groups()["groups"]
        active_hazard_count = len(demo_gis_map().get("hazards", []))
        source = "demo-operational-state"
    else:
        if session is None:
            raise HTTPException(status_code=503, detail="database unavailable")
        try:
            incident_uuid = UUID(payload.sos_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="sos_id must be a UUID in live mode") from exc
        row = (await session.execute(text("""
            SELECT id, status, severity, emergency_type, channel, metadata ->> 'barangay' AS barangay,
                   ST_Y(location) AS latitude, ST_X(location) AS longitude, accuracy_meters,
                   received_at, message
            FROM cfr.sos_requests WHERE id = :sos_id
        """), {"sos_id": str(incident_uuid)})).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail="SOS incident not found")
        incident = {
            "id": str(row["id"]), "status": row["status"], "severity": row["severity"],
            "emergency_type": row["emergency_type"], "channel": row["channel"], "barangay": row["barangay"],
            "location": {"latitude": row["latitude"], "longitude": row["longitude"], "accuracy_meters": row["accuracy_meters"]},
            "received_at": row["received_at"], "summary": row["message"],
        }
        groups = [group.model_dump(mode="json") for group in (await response_groups_snapshot(session)).groups]
        active_hazard_count = len((await gis_map_snapshot(session)).hazards)
        source = "postgis-operational-state"
    if str(incident.get("status")).lower() not in {"acknowledged", "verified", "dispatched"}:
        raise HTTPException(status_code=409, detail="SOS must be verified or acknowledged before responder-safety assessment")
    assessment = build_responder_safety_assessment(
        incident=incident, groups=groups, active_hazard_count=active_hazard_count, source=source,
    )
    note = f"Responder-safety assessment for verified SOS {payload.sos_id}; no dispatch or route clearance created."
    if settings.demo_mode:
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role,
            action="sos.responder_safety_assessed", resource_type="sos", resource_id=payload.sos_id, note=note,
        )
    else:
        await write_audit_event(
            session, actor=actor, action="sos.responder_safety_assessed", resource_type="sos", resource_id=payload.sos_id,
            metadata={"assessment_id": assessment["assessment_id"], "automatic_dispatch_created": False, "route_cleared": False},
        )
        await session.commit()
    await manager.publish("lgu:operations", {"event": "sos.responder_safety_assessed", "assessment": assessment})
    return assessment


@router.post("/gis/resources/{resource_id}/position", response_model=GisResource)
async def update_gis_resource_position(
    resource_id: UUID,
    payload: ResourcePositionUpdate,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> GisResource:
    if settings.demo_mode:
        resource = update_demo_resource_position(str(resource_id), payload.model_dump(exclude_none=True))
        if resource is None:
            raise HTTPException(status_code=404, detail="resource not found")
        record_demo_operations_action(
            actor_user_id=str(actor.id), actor_role=actor.role,
            action="gis.resource_position_updated", resource_type="resource", resource_id=str(resource_id),
            note=f"Position update received from {payload.source}.",
        )
        await manager.publish("lgu:gis", {"event": "resource.position_updated", "resource": resource})
        return GisResource(**resource)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    current = (await session.execute(text("""
        SELECT id, label, kind, owner, state, current_assignment
        FROM cfr.resource_units WHERE id = :resource_id
    """), {"resource_id": str(resource_id)})).mappings().first()
    if current is None:
        raise HTTPException(status_code=404, detail="resource not found")
    reported_at = payload.reported_at or datetime.now(timezone.utc)
    await session.execute(text("""
        INSERT INTO cfr.resource_positions (
            resource_id, reported_at, source, geom, accuracy_meters, heading_degrees,
            speed_kph, battery_pct
        ) VALUES (
            :resource_id, :reported_at, :source,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
            :accuracy_meters, :heading_degrees, :speed_kph, :battery_pct
        )
    """), {**payload.model_dump(exclude_none=True), "resource_id": str(resource_id), "reported_at": reported_at})
    next_state = payload.state or current["state"]
    await session.execute(text("UPDATE cfr.resource_units SET state = :state WHERE id = :resource_id"), {"state": next_state, "resource_id": str(resource_id)})
    await write_audit_event(session, actor=actor, action="gis.resource_position_updated", resource_type="resource", resource_id=str(resource_id), metadata={"source": payload.source})
    await session.commit()
    resource = GisResource(
        id=current["id"], label=current["label"], kind=current["kind"], owner=current["owner"], state=next_state,
        position={"latitude": payload.latitude, "longitude": payload.longitude}, reported_at=reported_at,
        accuracy_meters=payload.accuracy_meters, heading_degrees=payload.heading_degrees,
        speed_kph=payload.speed_kph, battery_pct=payload.battery_pct,
        current_assignment=current["current_assignment"], last_update_source=payload.source,
    )
    await manager.publish("lgu:gis", {"event": "resource.position_updated", "resource": resource.model_dump(mode="json")})
    return resource


@router.post("/gis/routes/optimize", response_model=OptimizedRouteResponse)
async def optimize_gis_route(
    payload: RouteOptimizationRequest,
    session: AsyncSession | None = Depends(get_db),
) -> OptimizedRouteResponse:
    if settings.demo_mode:
        return OptimizedRouteResponse(**demo_gis_route(payload.latitude, payload.longitude, str(payload.destination_center_id) if payload.destination_center_id else None))
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    try:
        result = await find_nearest_safe_center(
            session,
            latitude=payload.latitude,
            longitude=payload.longitude,
            destination_center_id=payload.destination_center_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    route_is_safe_as_of = result.route_is_safe_as_of
    age_seconds = max(0, int((datetime.now(timezone.utc) - route_is_safe_as_of).total_seconds()))
    route_status = "stale" if age_seconds > payload.max_route_age_seconds else "safe"
    warnings = ["Route avoids active flood, storm-surge, landslide, and road-closure polygons.", "Confirm field conditions immediately before departure."]
    if route_status == "stale":
        warnings.insert(0, "Route snapshot is older than the requested freshness window; recalculate before dispatch.")
    return OptimizedRouteResponse(
        center_id=result.center_id, center_name=result.center_name,
        origin={"latitude": payload.latitude, "longitude": payload.longitude},
        distance_meters=result.distance_meters, estimated_seconds=result.estimated_seconds,
        route=[{"latitude": lat, "longitude": lon} for lon, lat in result.route],
        avoided_hazard_count=result.avoided_hazard_count, blocked_segment_count=0,
        route_status=route_status, route_is_safe_as_of=route_is_safe_as_of, warnings=warnings,
    )


@router.get("/alerts")
async def alerts(session: AsyncSession | None = Depends(get_db)) -> list[dict]:
    if settings.demo_mode:
        return demo_alerts()
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (await session.execute(text("""
        SELECT id, source_name, source_event_id, title, body, severity, hazard,
               issued_at, expires_at, source_url
        FROM cfr.verified_alerts
        WHERE expires_at IS NULL OR expires_at > now()
        ORDER BY issued_at DESC
        LIMIT 50
    """))).mappings().all()
    return [dict(row) for row in rows]


@router.get("/evacuation-centers")
async def evacuation_centers(session: AsyncSession | None = Depends(get_db)) -> list[dict]:
    if settings.demo_mode:
        return demo_centers()
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    rows = (await session.execute(text("""
        SELECT id, name, barangay, status, capacity_total, occupancy_current,
               amenities, ST_Y(geom) AS latitude, ST_X(geom) AS longitude
        FROM cfr.evacuation_centers
        ORDER BY status, name
    """))).mappings().all()
    return [dict(row) for row in rows]


@router.post("/sos", response_model=SosResponse, status_code=201)
async def receive_internet_sos(payload: SosCreate, session: AsyncSession | None = Depends(get_db)) -> SosResponse:
    if settings.demo_mode:
        incident = record_demo_sos(
            emergency_type=payload.emergency_type,
            channel=payload.channel.value,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy_meters=payload.accuracy_meters,
            message=payload.message,
        )
        await manager.publish("lgu:sos", {"event": "sos.received", **incident})
        return SosResponse(
            id=UUID(incident["id"]),
            status=incident["status"],
            received_at=datetime.fromisoformat(incident["received_at"]),
            channel=payload.channel,
        )
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    dedupe_key = _dedupe_key(
        payload.device_public_id or "anonymous",
        payload.emergency_type,
        payload.latitude,
        payload.longitude,
        payload.client_occurred_at.isoformat(),
    )
    sos_id, status, received_at = await _persist_sos(
        session,
        device_public_id=payload.device_public_id,
        sender_phone=None,
        emergency_type=payload.emergency_type,
        message=payload.message,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_meters=payload.accuracy_meters,
        client_occurred_at=payload.client_occurred_at,
        channel=payload.channel.value,
        raw_payload=None,
        dedupe_key=dedupe_key,
    )
    await manager.publish("lgu:sos", {
        "event": "sos.received",
        "sos_id": str(sos_id),
        "status": status,
        "channel": payload.channel.value,
        "severity": "critical",
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "received_at": received_at.isoformat(),
    })
    return SosResponse(id=sos_id, status=status, received_at=received_at, channel=payload.channel)


@router.post("/sos/manual", response_model=SosResponse, status_code=201)
async def create_coordinator_emergency(
    payload: CoordinatorEmergencyCreate,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "admin")),
) -> SosResponse:
    """Record a phone, radio, walk-in, or field-relayed emergency at the command desk."""
    metadata = {
        "source": "coordinator_manual_entry",
        "barangay": payload.barangay,
        "reporter_name": payload.reporter_name,
        "reporter_contact": payload.reporter_contact,
        "recorded_by": actor.display_name,
        "recorded_by_role": actor.role,
    }
    if settings.demo_mode:
        incident = record_demo_sos(
            emergency_type=payload.emergency_type,
            channel="manual",
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy_meters=payload.accuracy_meters,
            message=payload.summary,
            severity=payload.severity.value,
            barangay=payload.barangay,
        )
        record_demo_audit(
            actor_user_id=str(actor.id),
            actor_role=actor.role,
            action="sos.manual_created",
            resource_type="sos_request",
            resource_id=incident["id"],
            metadata=metadata,
        )
        await manager.publish("lgu:sos", {"event": "sos.manual_created", **incident})
        return SosResponse(
            id=UUID(incident["id"]),
            status=incident["status"],
            received_at=datetime.fromisoformat(incident["received_at"]),
            channel="manual",
        )
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    dedupe_key = _dedupe_key(
        "coordinator-manual",
        actor.id,
        payload.emergency_type,
        payload.latitude,
        payload.longitude,
        payload.occurred_at.isoformat(),
        payload.summary,
    )
    sos_id, status, received_at = await _persist_sos(
        session,
        device_public_id=None,
        sender_phone=None,
        emergency_type=payload.emergency_type,
        message=payload.summary,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_meters=payload.accuracy_meters,
        client_occurred_at=payload.occurred_at,
        channel="manual",
        raw_payload=None,
        dedupe_key=dedupe_key,
        severity=payload.severity.value,
        metadata=metadata,
    )
    await write_audit_event(
        session,
        actor=actor,
        action="sos.manual_created",
        resource_type="sos_request",
        resource_id=str(sos_id),
        metadata=metadata,
    )
    await manager.publish("lgu:sos", {
        "event": "sos.manual_created",
        "sos_id": str(sos_id),
        "status": status,
        "channel": "manual",
        "severity": payload.severity.value,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "received_at": received_at.isoformat(),
    })
    return SosResponse(id=sos_id, status=status, received_at=received_at, channel="manual")


@router.post("/sos/sms", response_model=SosResponse, status_code=201)
async def receive_sms_sos(
    payload: SmsSosRequest,
    x_gateway_signature: str | None = Header(default=None),
    session: AsyncSession | None = Depends(get_db),
) -> SosResponse:
    _verify_gateway_signature(payload.sender_phone, payload.message, x_gateway_signature)
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    try:
        decoded = decode_sms_payload(payload.message)
    except PayloadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    now_epoch = int(time.time())
    if abs(now_epoch - decoded.client_epoch) > settings.sms_max_age_seconds:
        raise HTTPException(status_code=422, detail="SMS SOS payload is outside the accepted time window")

    client_occurred_at = datetime.fromtimestamp(decoded.client_epoch, tz=timezone.utc)
    dedupe_key = _dedupe_key("sms", payload.sender_phone, decoded.device_public_id, decoded.nonce)
    sos_id, status, received_at = await _persist_sos(
        session,
        device_public_id=decoded.device_public_id,
        sender_phone=payload.sender_phone,
        emergency_type=decoded.emergency_type,
        message="Received through SMS fallback",
        latitude=decoded.latitude,
        longitude=decoded.longitude,
        accuracy_meters=decoded.accuracy_meters,
        client_occurred_at=client_occurred_at,
        channel="sms",
        raw_payload=payload.message,
        dedupe_key=dedupe_key,
    )
    await manager.publish("lgu:sos", {
        "event": "sos.received",
        "sos_id": str(sos_id),
        "status": status,
        "channel": "sms",
        "severity": "critical",
        "latitude": decoded.latitude,
        "longitude": decoded.longitude,
        "received_at": received_at.isoformat(),
    })
    return SosResponse(id=sos_id, status=status, received_at=received_at, channel="sms")


@router.get("/routes/safest-center", response_model=SafeRouteResponse)
async def safest_center_route(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    session: AsyncSession | None = Depends(get_db),
) -> SafeRouteResponse:
    if settings.demo_mode:
        return SafeRouteResponse(**demo_route())
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    try:
        result = await find_nearest_safe_center(
            session, latitude=latitude, longitude=longitude
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SafeRouteResponse(
        center_id=result.center_id,
        center_name=result.center_name,
        distance_meters=result.distance_meters,
        estimated_seconds=result.estimated_seconds,
        route=[RoutePoint(latitude=lat, longitude=lon) for lon, lat in result.route],
        avoided_hazard_count=result.avoided_hazard_count,
        route_is_safe_as_of=result.route_is_safe_as_of,
    )


@router.patch("/sos/{sos_id}/status")
async def update_sos_status(
    sos_id: UUID,
    payload: SosStatusUpdate,
    session: AsyncSession | None = Depends(get_db),
    actor: UserIdentity = Depends(require_roles("dispatcher", "responder", "admin")),
) -> dict:
    if settings.demo_mode:
        try:
            incident = update_demo_sos_status(str(sos_id), payload.status)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if incident is None:
            raise HTTPException(status_code=404, detail="SOS not found")
        record_demo_audit(
            actor_user_id=str(actor.id),
            actor_role=actor.role,
            action="sos.status_changed",
            resource_type="sos_request",
            resource_id=str(sos_id),
            metadata={"to_status": payload.status, "note": payload.note},
        )
        event = {"event": "sos.status_changed", **incident, "note": payload.note}
        await manager.publish("lgu:sos", event)
        return incident
    if session is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    current_row = (await session.execute(
        text("SELECT status FROM cfr.sos_requests WHERE id = :sos_id"),
        {"sos_id": str(sos_id)},
    )).mappings().first()
    if current_row is None:
        raise HTTPException(status_code=404, detail="SOS not found")
    if not is_valid_sos_transition(str(current_row["status"]), payload.status):
        raise HTTPException(
            status_code=409,
            detail=f"invalid SOS transition: {current_row['status']} -> {payload.status}",
        )
    row = (await session.execute(text("""
        UPDATE cfr.sos_requests
        SET status = :status,
            acknowledged_at = CASE WHEN :status = 'acknowledged' THEN now() ELSE acknowledged_at END,
            resolved_at = CASE WHEN :status IN ('resolved', 'false_alarm') THEN now() ELSE resolved_at END
        WHERE id = :sos_id
        RETURNING id, status, received_at, channel
    """), {"status": payload.status, "sos_id": str(sos_id)})).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="SOS not found")
    await session.execute(
        text("""
            INSERT INTO cfr.sos_status_events (
                sos_id, from_status, to_status, actor_user_id, note
            ) VALUES (
                :sos_id, :from_status, :to_status, :actor_user_id, :note
            )
        """),
        {
            "sos_id": str(sos_id),
            "from_status": str(current_row["status"]),
            "to_status": payload.status,
            "actor_user_id": str(actor.id),
            "note": payload.note,
        },
    )
    await session.commit()
    await write_audit_event(
        session,
        actor=actor,
        action="sos.status_changed",
        resource_type="sos_request",
        resource_id=str(sos_id),
        metadata={"to_status": payload.status, "note": payload.note},
    )
    event = {"event": "sos.status_changed", **dict(row), "note": payload.note}
    await manager.publish("lgu:sos", event)
    return dict(row)


@router.websocket("/ws/lgu")
async def lgu_dashboard_socket(websocket: WebSocket) -> None:
    topic = "lgu:sos"
    await manager.connect(websocket, topic)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, topic)


@router.websocket("/ws/gis")
async def gis_dashboard_socket(websocket: WebSocket) -> None:
    topic = "lgu:gis"
    await manager.connect(websocket, topic)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, topic)


@router.websocket("/ws/response-groups")
async def response_groups_socket(websocket: WebSocket) -> None:
    topic = "lgu:response_groups"
    await manager.connect(websocket, topic)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, topic)


@router.websocket("/ws/coordination")
async def coordination_socket(websocket: WebSocket) -> None:
    topic = "lgu:communications"
    await manager.connect(websocket, topic)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, topic)


@router.websocket("/ws/notifications")
async def notifications_socket(websocket: WebSocket) -> None:
    topic = "lgu:notifications"
    await manager.connect(websocket, topic)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, topic)
