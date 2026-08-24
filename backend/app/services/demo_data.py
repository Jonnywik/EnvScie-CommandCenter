from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from math import cos, radians, sqrt
from uuid import UUID, uuid4

from app.services.sos_state import is_valid_sos_transition

DEMO_CENTER_ID = UUID("1f8b1f2a-6b22-4a5b-90dc-9f8c7e7d11a1")
DISPATCH_FRESHNESS_SECONDS = 15 * 60


def _is_fresh_for_dispatch(timestamp: str | None, now: datetime | None = None) -> bool:
    """Return whether a field update is recent enough for a new deployment."""
    if not timestamp:
        return False
    try:
        reported_at = datetime.fromisoformat(timestamp)
    except ValueError:
        return False
    if reported_at.tzinfo is None:
        reported_at = reported_at.replace(tzinfo=timezone.utc)
    reference = now or datetime.now(timezone.utc)
    return (reference - reported_at).total_seconds() <= DISPATCH_FRESHNESS_SECONDS


def demo_summary() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "generated_at": now.isoformat(),
        "source": "demo-seed",
        "freshness": "demo",
        "metrics": {
            "untriaged_sos": sum(1 for item in DEMO_SOS_QUEUE if item["status"] == "received"),
            "critical_alerts": sum(1 for item in DEMO_ALERTS if item["severity"] == "critical"),
            "open_centers": sum(1 for item in demo_centers() if item["status"] == "open"),
            "residents_at_risk": 187,
        },
        "sos": DEMO_SOS_QUEUE or demo_sos_queue(),
        "alerts": demo_alerts(),
        "centers": demo_centers(),
    }


def demo_sos_queue() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "id": "e6c8edb4-1f7f-4e7d-9f82-8a0ed6b1e901",
            "severity": "critical",
            "status": "received",
            "emergency_type": "TRAPPED",
            "channel": "sms",
            "barangay": "Barangay 1",
            "location": {"latitude": 11.1264, "longitude": 125.3892, "accuracy_meters": 42},
            "received_at": (now - timedelta(minutes=3)).isoformat(),
            "summary": "Family of four reporting rising water near the coastal road.",
        },
        {
            "id": "9ce3c7b4-6e02-4ae1-8209-cf27b88e7f02",
            "severity": "warning",
            "status": "acknowledged",
            "emergency_type": "MEDICAL",
            "channel": "internet",
            "barangay": "Barangay 2",
            "location": {"latitude": 11.1311, "longitude": 125.3948, "accuracy_meters": 18},
            "received_at": (now - timedelta(minutes=11)).isoformat(),
            "summary": "Injury reported; responder team requested.",
        },
        {
            "id": "3b9349bb-ef57-4fbb-b0b3-1f661d96f203",
            "severity": "critical",
            "status": "dispatched",
            "emergency_type": "STRUCTURAL",
            "channel": "mesh",
            "barangay": "Barangay 4",
            "location": {"latitude": 11.1372, "longitude": 125.4011, "accuracy_meters": 65},
            "received_at": (now - timedelta(minutes=19)).isoformat(),
            "summary": "Roof damage; one person still inside the structure.",
        },
    ]


DEMO_SOS_QUEUE: list[dict] = []
DEMO_AUDIT_LOG: list[dict] = []
DEMO_COMMUNICATION_EVENTS: list[dict] = []
DEMO_AUDIO_FEED: list[dict] = []
DEMO_NOTIFICATIONS: list[dict] = []
DEMO_DISPATCH_ASSIGNMENTS: list[dict] = []
DEMO_FACILITY_VERIFICATIONS: list[dict] = []
DEMO_INCIDENTS: list[dict] = []


def _incident_events(incident_id: str) -> list[dict]:
    return list(reversed([event for event in DEMO_INCIDENT_EVENTS if event["incident_id"] == incident_id]))


DEMO_INCIDENT_EVENTS: list[dict] = []


def demo_incidents() -> dict:
    records = []
    for item in DEMO_INCIDENTS:
        record = deepcopy(item)
        record["events"] = _incident_events(item["id"])
        records.append(record)
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "source": "demo-seed", "incidents": records}


def create_demo_incident_from_sos(sos_id: str, summary: str | None, follow_up_owner: str | None, follow_up_due_at: str | None, actor_user_id: str | None, actor_role: str | None) -> dict | None:
    sos = next((item for item in DEMO_SOS_QUEUE if item["id"] == sos_id), None)
    if sos is None:
        return None
    existing = next((item for item in DEMO_INCIDENTS if sos_id in item["linked_sos_ids"]), None)
    if existing:
        return {**deepcopy(existing), "events": _incident_events(existing["id"])}
    now = datetime.now(timezone.utc).isoformat()
    incident = {"id": str(uuid4()), "status": "open", "severity": sos["severity"], "emergency_type": sos["emergency_type"], "barangay": sos["barangay"], "summary": summary or sos["summary"], "linked_sos_ids": [sos_id], "follow_up_owner": follow_up_owner, "follow_up_due_at": follow_up_due_at, "created_at": now, "updated_at": now}
    DEMO_INCIDENTS.insert(0, incident)
    event = {"id": str(uuid4()), "incident_id": incident["id"], "action": "created_from_sos", "from_status": None, "to_status": "open", "note": "Human-created incident record from SOS evidence.", "actor_user_id": actor_user_id, "actor_role": actor_role, "occurred_at": now}
    DEMO_INCIDENT_EVENTS.insert(0, event)
    record_demo_audit(actor_user_id=actor_user_id, actor_role=actor_role, action="incident.created", resource_type="incident", resource_id=incident["id"], metadata={"sos_id": sos_id})
    return {**deepcopy(incident), "events": [event]}


def transition_demo_incident(incident_id: str, action: str, note: str, follow_up_owner: str | None, follow_up_due_at: str | None, actor_user_id: str | None, actor_role: str | None) -> dict | None:
    target = {"monitor": "monitoring", "escalate": "escalated", "stabilize": "stabilized", "close": "closed", "reopen": "reopened"}.get(action)
    incident = next((item for item in DEMO_INCIDENTS if item["id"] == incident_id), None)
    if incident is None or target is None:
        return None
    if action == "close" and (not follow_up_owner or not follow_up_due_at):
        raise ValueError("closing an incident requires follow-up owner and due date")
    old_status = incident["status"]
    if old_status == target:
        raise ValueError("incident is already in that state")
    now = datetime.now(timezone.utc).isoformat()
    incident["status"] = target; incident["updated_at"] = now
    if follow_up_owner is not None: incident["follow_up_owner"] = follow_up_owner
    if follow_up_due_at is not None: incident["follow_up_due_at"] = follow_up_due_at
    event = {"id": str(uuid4()), "incident_id": incident_id, "action": action, "from_status": old_status, "to_status": target, "note": note, "actor_user_id": actor_user_id, "actor_role": actor_role, "occurred_at": now}
    DEMO_INCIDENT_EVENTS.insert(0, event)
    record_demo_audit(actor_user_id=actor_user_id, actor_role=actor_role, action=f"incident.{action}", resource_type="incident", resource_id=incident_id, metadata={"from_status": old_status, "to_status": target})
    return {**deepcopy(incident), "events": _incident_events(incident_id)}


def record_demo_audit(
    *,
    actor_user_id: str | None,
    actor_role: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    metadata: dict | None = None,
) -> dict:
    event = {
        "id": len(DEMO_AUDIT_LOG) + 1,
        "actor_user_id": actor_user_id,
        "actor_role": actor_role,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    DEMO_AUDIT_LOG.insert(0, event)
    return event


def record_demo_sos(
    *,
    emergency_type: str,
    channel: str,
    latitude: float,
    longitude: float,
    accuracy_meters: float | None,
    message: str | None,
    severity: str = "critical",
    barangay: str = "Location pending verification",
) -> dict:
    now = datetime.now(timezone.utc)
    incident = {
        "id": str(uuid4()),
        "severity": severity,
        "status": "received",
        "emergency_type": emergency_type,
        "channel": channel,
        "barangay": barangay,
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "accuracy_meters": accuracy_meters,
        },
        "received_at": now.isoformat(),
        "summary": message or "Resident requested emergency assistance.",
    }
    DEMO_SOS_QUEUE.insert(0, incident)
    return incident


def update_demo_sos_status(sos_id: str, status: str) -> dict | None:
    for item in DEMO_SOS_QUEUE:
        if item["id"] == sos_id:
            current = item["status"]
            if status == current:
                return item
            if not is_valid_sos_transition(current, status):
                raise ValueError(f"invalid SOS transition: {current} -> {status}")
            item["status"] = status
            return item
    return None


def demo_audit_log(limit: int = 50) -> list[dict]:
    return DEMO_AUDIT_LOG[:limit]


def _ensure_demo_coordination() -> None:
    if DEMO_COMMUNICATION_EVENTS:
        return
    now = datetime.now(timezone.utc)
    DEMO_COMMUNICATION_EVENTS.extend([
        {
            "id": "comms-001", "occurred_at": (now - timedelta(minutes=2)).isoformat(),
            "direction": "inbound", "channel": "VHF", "from_unit": "ALPHA-1",
            "to_unit": "Command", "message": "Coastal road sweep started; water level rising at the eastern bend.",
            "priority": "urgent", "status": "received", "acknowledged_at": None,
            "linked_incident_id": DEMO_SOS_QUEUE[0]["id"] if DEMO_SOS_QUEUE else None, "operator": "ALPHA-1",
        },
        {
            "id": "comms-002", "occurred_at": (now - timedelta(minutes=6)).isoformat(),
            "direction": "outbound", "channel": "VHF", "from_unit": "Command",
            "to_unit": "DELTA-BOAT", "message": "Stand by for shoreline extraction tasking. Confirm pier safety check before launch.",
            "priority": "priority", "status": "acknowledged", "acknowledged_at": (now - timedelta(minutes=5)).isoformat(),
            "linked_incident_id": DEMO_SOS_QUEUE[0]["id"] if DEMO_SOS_QUEUE else None, "operator": "Dispatcher 01",
        },
        {
            "id": "comms-003", "occurred_at": (now - timedelta(minutes=10)).isoformat(),
            "direction": "broadcast", "channel": "SMS", "from_unit": "Command",
            "to_unit": "Barangay focal points", "message": "Verify evacuation-center intake counts and report transport gaps on the next check-in.",
            "priority": "routine", "status": "sent", "acknowledged_at": (now - timedelta(minutes=8)).isoformat(),
            "linked_incident_id": None, "operator": "Dispatcher 01",
        },
        {
            "id": "comms-004", "occurred_at": (now - timedelta(minutes=14)).isoformat(),
            "direction": "inbound", "channel": "SMS", "from_unit": "Barangay 2 focal point",
            "to_unit": "Command", "message": "Medical triage point has one oxygen cylinder remaining; requesting resupply.",
            "priority": "priority", "status": "acknowledged", "acknowledged_at": (now - timedelta(minutes=12)).isoformat(),
            "linked_incident_id": None, "operator": "RHU liaison",
        },
    ])
    DEMO_AUDIO_FEED.extend([
        {
            "id": "audio-001", "started_at": (now - timedelta(seconds=32)).isoformat(), "duration_seconds": 18,
            "channel": "VHF", "from_unit": "ALPHA-1", "to_unit": "Command",
            "transcript": "Command, Alpha One. Coastal road sweep underway. Request updated route check before crossing the eastern bend.",
            "priority": "urgent", "status": "playing", "linked_incident_id": DEMO_SOS_QUEUE[0]["id"] if DEMO_SOS_QUEUE else None,
            "waveform": [28, 42, 36, 58, 46, 68, 51, 40, 63, 38, 54, 31, 47, 34, 50, 29],
        },
        {
            "id": "audio-002", "started_at": (now - timedelta(minutes=3)).isoformat(), "duration_seconds": 11,
            "channel": "VHF", "from_unit": "DELTA-BOAT", "to_unit": "Command",
            "transcript": "Delta Boat copies. Crew ready at Municipal Pier. Awaiting launch clearance.",
            "priority": "priority", "status": "played", "linked_incident_id": None,
            "waveform": [20, 32, 44, 39, 52, 30, 46, 34, 41, 26, 38, 24],
        },
        {
            "id": "audio-003", "started_at": (now - timedelta(minutes=8)).isoformat(), "duration_seconds": 9,
            "channel": "SMS", "from_unit": "BRAVO-MED", "to_unit": "Command",
            "transcript": "Bravo Medical acknowledges. Triage post remains operational; oxygen resupply requested.",
            "priority": "routine", "status": "played", "linked_incident_id": None,
            "waveform": [18, 27, 35, 22, 42, 30, 37, 25, 33, 21],
        },
    ])


def demo_communications() -> dict:
    _ensure_demo_coordination()
    now = datetime.now(timezone.utc)
    return {
        "generated_at": now.isoformat(),
        "source": "demo-seed",
        "events": DEMO_COMMUNICATION_EVENTS[:30],
        "audio_feed": DEMO_AUDIO_FEED[:12],
        "channel_health": {"VHF": "busy", "HF": "clear", "SMS": "degraded", "phone": "clear", "field_runner": "clear"},
        "unread_count": sum(event["status"] == "received" for event in DEMO_COMMUNICATION_EVENTS),
    }


def record_demo_communication(*, operator: str, channel: str, to_unit: str, message: str, priority: str, linked_incident_id: str | None, simulate_audio: bool) -> dict:
    _ensure_demo_coordination()
    now = datetime.now(timezone.utc)
    event = {
        "id": f"comms-{len(DEMO_COMMUNICATION_EVENTS) + 1:03d}", "occurred_at": now.isoformat(),
        "direction": "outbound", "channel": channel, "from_unit": "Command", "to_unit": to_unit,
        "message": message, "priority": priority, "status": "sent", "acknowledged_at": None,
        "linked_incident_id": linked_incident_id, "operator": operator,
    }
    DEMO_COMMUNICATION_EVENTS.insert(0, event)
    if simulate_audio:
        DEMO_AUDIO_FEED.insert(0, {
            "id": f"audio-{len(DEMO_AUDIO_FEED) + 1:03d}", "started_at": now.isoformat(), "duration_seconds": max(4, min(45, len(message) // 9)),
            "channel": channel, "from_unit": "Command", "to_unit": to_unit, "transcript": message,
            "priority": priority, "status": "playing", "linked_incident_id": linked_incident_id,
            "waveform": [22, 38, 31, 56, 44, 62, 35, 48, 28, 42, 34, 50],
        })
    return event


def demo_dispatch_recommendations(*, incident_id: str, severity: str, emergency_type: str, latitude: float, longitude: float, required_specialties: list[str], max_results: int) -> dict:
    _ensure_demo_response_groups()
    now = datetime.now(timezone.utc)
    derived = {
        "MEDICAL": ["emergency triage", "first aid", "patient transport"],
        "TRAPPED": ["swiftwater rescue", "household extraction", "boat operations"],
        "FLOOD": ["swiftwater rescue", "boat operations", "shoreline extraction"],
        "STRUCTURAL": ["household extraction", "first aid"],
        "LOGISTICS": ["relief distribution", "water resupply", "evacuation-center support"],
    }
    needed = required_specialties or derived.get(emergency_type.upper(), [emergency_type.lower()])
    needed = list(dict.fromkeys(needed))

    def specialty_key(value: str) -> str:
        return value.strip().lower().replace("_", " ").replace("-", " ")

    severity_points = {"critical": 36, "high": 32, "warning": 24, "medium": 16, "low": 10}.get(severity, 16)
    ranked: list[dict] = []
    for group in demo_response_groups()["groups"]:
        lat = group["location"]["latitude"]
        lon = group["location"]["longitude"]
        distance = int(sqrt(((lat - latitude) * 111000) ** 2 + ((lon - longitude) * 111000 * cos(radians(latitude))) ** 2))
        freshness = max(0, int((now - datetime.fromisoformat(group["last_location_at"])).total_seconds() / 60))
        group_specialties = {specialty_key(item): item for item in group["specialties"]}
        needed_keys = {specialty_key(item) for item in needed}
        matches = sorted(group_specialties[key] for key in group_specialties if key in needed_keys)
        missing = sorted(item for item in needed if specialty_key(item) not in group_specialties)
        availability_points = {"available": 18, "limited": 9, "standby": 7, "assigned": 2, "offline": 0}.get(group["availability"], 0)
        proximity_points = max(0, 18 - min(18, distance // 100))
        freshness_points = 10 if freshness <= 10 else 5 if freshness <= 20 else 0
        specialty_points = min(22, len(matches) * 8)
        constraints_penalty = min(18, len(group["constraints"]) * 4 + (6 if group["availability"] == "assigned" else 0))
        score = max(0, min(100, severity_points + specialty_points + proximity_points + round(group["readiness_score"] * 0.16) + availability_points + freshness_points - constraints_penalty))
        if group["availability"] == "offline":
            eligibility = "ineligible"
        elif group["availability"] in {"assigned", "limited"} or constraints_penalty >= 12:
            eligibility = "constrained"
        elif matches:
            eligibility = "recommended"
        else:
            eligibility = "eligible"
        factors = [
            {"factor": "specialty_match", "points": specialty_points, "detail": f"{len(matches)} of {len(needed)} required specialties matched"},
            {"factor": "proximity", "points": proximity_points, "detail": f"Estimated {distance} m from incident origin"},
            {"factor": "readiness", "points": round(group["readiness_score"] * 0.16), "detail": f"Readiness score {group['readiness_score']}/100"},
            {"factor": "availability", "points": availability_points, "detail": f"Group is {group['availability']}"},
            {"factor": "freshness", "points": freshness_points, "detail": f"Position checked {freshness} min ago"},
            {"factor": "constraints", "points": -constraints_penalty, "detail": "; ".join(group["constraints"]) or "No recorded constraints"},
        ]
        ranked.append({
            "rank": 0, "group_id": group["id"], "group_name": group["name"], "eligibility": eligibility, "score": score,
            "distance_meters": distance, "estimated_response_minutes": group.get("estimated_response_minutes"),
            "specialty_match": matches, "missing_specialties": missing, "freshness_minutes": freshness,
            "factors": factors, "reasons": [f"Matches {', '.join(matches)}" if matches else "No direct specialty match", f"{distance} m from incident", f"{group['readiness_score']}/100 readiness"], "constraints": group["constraints"],
        })
    ranked.sort(key=lambda item: (item["eligibility"] == "recommended", item["score"], -item["distance_meters"]), reverse=True)
    ranked = ranked[:max_results]
    for index, item in enumerate(ranked, start=1):
        item["rank"] = index
    recommended = next((item["group_id"] for item in ranked if item["eligibility"] == "recommended"), None)
    return {
        "generated_at": now.isoformat(), "source": "demo-engine", "engine_version": "dispatch-score-v1",
        "incident": {"incident_id": incident_id, "severity": severity, "emergency_type": emergency_type, "latitude": latitude, "longitude": longitude, "required_specialties": needed},
        "recommended_group_id": recommended, "recommendations": ranked,
        "safety_notes": ["Recommendation is advisory; dispatcher must confirm current channel acknowledgement and route safety.", "Assigned, stale, constrained, or offline groups are not treated as clear for immediate deployment."],
    }


def _demo_alert_seed() -> list[dict]:
    now = datetime.now(timezone.utc)
    return [
        {
            "id": "alert-demo-001",
            "source_name": "PAGASA",
            "source_event_id": "balangiga-rainfall-demo",
            "title": "Heavy rainfall warning — coastal and low-lying areas",
            "body": "Residents near waterways and the coast should prepare to move to an open evacuation center.",
            "severity": "warning",
            "hazard": "flood",
            "issued_at": (now - timedelta(minutes=7)).isoformat(),
            "expires_at": (now + timedelta(hours=3)).isoformat(),
            "source_url": "https://bagong.pagasa.dost.gov.ph/",
        },
        {
            "id": "alert-demo-002",
            "source_name": "LGU DRRM bulletin",
            "source_event_id": "balangiga-shelter-demo",
            "title": "Evacuation centers are open",
            "body": "Bring drinking water, medicines, identification, and essential documents.",
            "severity": "advisory",
            "hazard": None,
            "issued_at": (now - timedelta(minutes=18)).isoformat(),
            "expires_at": (now + timedelta(hours=8)).isoformat(),
            "source_url": None,
        },
    ]


DEMO_ALERTS: list[dict] = _demo_alert_seed()
DEMO_FEED_HEALTH: dict[str, dict] = {}


def _ensure_demo_feed_health() -> None:
    if DEMO_FEED_HEALTH:
        return
    now = datetime.now(timezone.utc)
    DEMO_FEED_HEALTH.update({
        "PAGASA": {
            "source_name": "PAGASA",
            "endpoint_url": "https://www.pagasa.dost.gov.ph/",
            "last_success_at": now - timedelta(minutes=4),
            "last_content_hash": "demo-pagasa-hash",
            "stale": False,
        },
        "LGU DRRM bulletin": {
            "source_name": "LGU DRRM bulletin",
            "endpoint_url": None,
            "last_success_at": now - timedelta(minutes=11),
            "last_content_hash": "demo-lgu-hash",
            "stale": False,
        },
    })


def demo_feed_health() -> list[dict]:
    _ensure_demo_feed_health()
    return deepcopy(list(DEMO_FEED_HEALTH.values()))


def update_demo_feed_health(source_name: str | None = None) -> list[dict]:
    _ensure_demo_feed_health()
    now = datetime.now(timezone.utc).isoformat()
    targets = [source_name] if source_name else list(DEMO_FEED_HEALTH)
    for name in targets:
        if name in DEMO_FEED_HEALTH:
            DEMO_FEED_HEALTH[name]["last_success_at"] = now
            DEMO_FEED_HEALTH[name]["last_checked_at"] = now
            DEMO_FEED_HEALTH[name]["stale"] = False
    return demo_feed_health()


def demo_alerts() -> list[dict]:
    return deepcopy(DEMO_ALERTS)


def upsert_demo_alerts(items: list[dict]) -> tuple[int, int]:
    index = {(item["source_name"], item["source_event_id"]): item for item in DEMO_ALERTS}
    inserted = 0
    updated = 0
    for incoming in items:
        item = dict(incoming)
        key = (item["source_name"], item["source_event_id"])
        if key in index:
            index[key].update(item)
            updated += 1
        else:
            DEMO_ALERTS.insert(0, item)
            index[key] = item
            inserted += 1
    return inserted, updated


DEMO_CENTERS: list[dict] | None = None


def _ensure_demo_centers() -> None:
    global DEMO_CENTERS
    if DEMO_CENTERS is not None:
        return
    DEMO_CENTERS = [
        {
            "id": str(DEMO_CENTER_ID),
            "name": "Balangiga Central School Evacuation Center",
            "barangay": "Barangay 2",
            "status": "open",
            "capacity_total": 500,
            "occupancy_current": 182,
            "amenities": ["water", "first aid", "accessible toilet"],
            "location": {"latitude": 11.1322, "longitude": 125.3975},
            "distance_meters": 920,
        },
        {
            "id": "2f8b1f2a-6b22-4a5b-90dc-9f8c7e7d11a2",
            "name": "Barangay 4 Covered Court",
            "barangay": "Barangay 4",
            "status": "open",
            "capacity_total": 260,
            "occupancy_current": 71,
            "amenities": ["water", "charging station"],
            "location": {"latitude": 11.1399, "longitude": 125.4029},
            "distance_meters": 1640,
        },
        {
            "id": "3f8b1f2a-6b22-4a5b-90dc-9f8c7e7d11a3",
            "name": "Municipal Gymnasium",
            "barangay": "Poblacion",
            "status": "unknown",
            "capacity_total": 400,
            "occupancy_current": 0,
            "amenities": ["water", "medical desk"],
            "location": {"latitude": 11.1291, "longitude": 125.3918},
            "distance_meters": 2100,
        },
    ]


def demo_centers() -> list[dict]:
    _ensure_demo_centers()
    return deepcopy(DEMO_CENTERS or [])


def update_demo_center(center_id: str, *, action: str, note: str | None = None) -> dict | None:
    _ensure_demo_centers()
    center = next((item for item in DEMO_CENTERS or [] if item["id"] == center_id), None)
    if center is None:
        return None
    now = datetime.now(timezone.utc).isoformat()
    center["last_action"] = action
    center["last_action_at"] = now
    if action in {"center.capacity_verified", "centers.capacity_reviewed"}:
        center["capacity_verified_at"] = now
    elif action == "center.resupply_requested":
        center["resupply_requested_at"] = now
    if note:
        center["last_action_note"] = note
    return deepcopy(center)


DEMO_SOS_QUEUE.extend(demo_sos_queue())


DEMO_GIS_RESOURCES: list[dict] = []
DEMO_RESPONSE_GROUPS: list[dict] = []


def _ensure_demo_gis_resources() -> None:
    if DEMO_GIS_RESOURCES:
        return
    now = datetime.now(timezone.utc)
    DEMO_GIS_RESOURCES.extend([
        {
            "id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1201",
            "label": "Alpha Rescue · Truck 01",
            "kind": "vehicle",
            "owner": "MDRRMO",
            "state": "en_route",
            "position": {"latitude": 11.1342, "longitude": 125.3938},
            "reported_at": (now - timedelta(minutes=3)).isoformat(),
            "accuracy_meters": 12,
            "heading_degrees": 118,
            "speed_kph": 18,
            "battery_pct": 82,
            "current_assignment": "Barangay 1 household sweep",
            "last_update_source": "gps",
        },
        {
            "id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1202",
            "label": "Bravo Medical · Ambulance 02",
            "kind": "medical",
            "owner": "RHU / BFP",
            "state": "deployed",
            "position": {"latitude": 11.1318, "longitude": 125.3971},
            "reported_at": (now - timedelta(minutes=8)).isoformat(),
            "accuracy_meters": 8,
            "heading_degrees": 0,
            "speed_kph": 0,
            "battery_pct": 64,
            "current_assignment": "Triage at Barangay 2",
            "last_update_source": "radio",
        },
        {
            "id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1203",
            "label": "Rescue boat · Pier 01",
            "kind": "boat",
            "owner": "MDRRMO",
            "state": "ready",
            "position": {"latitude": 11.1278, "longitude": 125.4019},
            "reported_at": (now - timedelta(minutes=5)).isoformat(),
            "accuracy_meters": 22,
            "heading_degrees": 72,
            "speed_kph": 0,
            "battery_pct": 91,
            "current_assignment": "Shoreline extraction standby",
            "last_update_source": "manual",
        },
        {
            "id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1204",
            "label": "Charlie Logistics · Van 03",
            "kind": "supply",
            "owner": "CSWDO",
            "state": "standby",
            "position": {"latitude": 11.1370, "longitude": 125.3995},
            "reported_at": (now - timedelta(minutes=14)).isoformat(),
            "accuracy_meters": 15,
            "heading_degrees": 256,
            "speed_kph": 0,
            "battery_pct": 56,
            "current_assignment": "Central School water resupply",
            "last_update_source": "sms",
        },
        {
            "id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1205",
            "label": "VHF relay · Municipal Hall",
            "kind": "communications",
            "owner": "MDRRMO",
            "state": "ready",
            "position": {"latitude": 11.1295, "longitude": 125.3907},
            "reported_at": (now - timedelta(minutes=2)).isoformat(),
            "accuracy_meters": 5,
            "heading_degrees": None,
            "speed_kph": None,
            "battery_pct": 97,
            "current_assignment": "Maintain DRRM-1 coverage",
            "last_update_source": "manual",
        },
    ])


def demo_gis_resources() -> list[dict]:
    _ensure_demo_gis_resources()
    return [dict(item, position=dict(item["position"])) for item in DEMO_GIS_RESOURCES]


def update_demo_resource_position(resource_id: str, payload: dict) -> dict | None:
    _ensure_demo_gis_resources()
    for item in DEMO_GIS_RESOURCES:
        if item["id"] != resource_id:
            continue
        item["position"] = {"latitude": payload["latitude"], "longitude": payload["longitude"]}
        item["reported_at"] = payload.get("reported_at") or datetime.now(timezone.utc).isoformat()
        item["accuracy_meters"] = payload.get("accuracy_meters")
        item["heading_degrees"] = payload.get("heading_degrees")
        item["speed_kph"] = payload.get("speed_kph")
        item["battery_pct"] = payload.get("battery_pct")
        item["last_update_source"] = payload.get("source", "manual")
        if payload.get("state"):
            item["state"] = payload["state"]
        return dict(item, position=dict(item["position"]))
    return None


def _ensure_demo_response_groups() -> None:
    if DEMO_RESPONSE_GROUPS:
        return
    _ensure_demo_gis_resources()
    now = datetime.now(timezone.utc)
    resources = {item["id"]: item for item in DEMO_GIS_RESOURCES}
    DEMO_RESPONSE_GROUPS.extend([
        {
            "id": "group-alpha",
            "name": "Alpha Rescue",
            "agency": "MDRRMO",
            "group_type": "Search and rescue",
            "specialties": ["swiftwater rescue", "boat operations", "household extraction"],
            "status": "en_route",
            "availability": "assigned",
            "readiness_score": 94,
            "personnel_ready": 6,
            "personnel_total": 6,
            "lead": "R. Dela Cruz",
            "contact_channel": "VHF DRRM-1",
            "call_sign": "ALPHA-1",
            "notification_phone": "+639170000001",
            "notification_device": "demo-alpha-device",
            "resource_id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1201",
            "location_label": "En route to Barangay 1 coastal road",
            "location_source": "gps",
            "vehicle_or_asset": "Rescue truck 01",
            "current_assignment": "Barangay 1 household sweep",
            "assignment_target": "barangay-1",
            "estimated_response_minutes": 8,
            "equipment": ["throw bags", "life jackets", "portable pump", "first-aid kit"],
            "constraints": ["Coastal road flood polygon nearby"],
            "notes": "Crew has completed radio check and PPE inspection.",
            "last_location_at": resources["8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1201"]["reported_at"],
            "last_check_in_at": (now - timedelta(minutes=3)).isoformat(),
        },
        {
            "id": "group-bravo",
            "name": "Bravo Medical",
            "agency": "RHU / BFP",
            "group_type": "Medical and triage",
            "specialties": ["emergency triage", "first aid", "patient transport"],
            "status": "deployed",
            "availability": "assigned",
            "readiness_score": 88,
            "personnel_ready": 4,
            "personnel_total": 4,
            "lead": "J. Santos, RN",
            "contact_channel": "VHF DRRM-2",
            "call_sign": "BRAVO-MED",
            "notification_phone": "+639170000002",
            "notification_device": "demo-bravo-device",
            "resource_id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1202",
            "location_label": "Barangay 2 triage point",
            "location_source": "radio",
            "vehicle_or_asset": "Ambulance 02",
            "current_assignment": "Triage at Barangay 2",
            "assignment_target": "barangay-2",
            "estimated_response_minutes": 12,
            "equipment": ["trauma kits", "oxygen", "stretchers", "patient tags"],
            "constraints": ["One ambulance committed to current triage point"],
            "notes": "Can accept one critical transfer at a time.",
            "last_location_at": resources["8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1202"]["reported_at"],
            "last_check_in_at": (now - timedelta(minutes=8)).isoformat(),
        },
        {
            "id": "group-charlie",
            "name": "Charlie Logistics",
            "agency": "CSWDO",
            "group_type": "Relief and logistics",
            "specialties": ["relief distribution", "water resupply", "evacuation-center support"],
            "status": "standby",
            "availability": "limited",
            "readiness_score": 76,
            "personnel_ready": 3,
            "personnel_total": 5,
            "lead": "M. Villanueva",
            "contact_channel": "SMS fallback",
            "call_sign": "CHARLIE-LOG",
            "notification_phone": "+639170000003",
            "notification_device": "demo-charlie-device",
            "resource_id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1204",
            "location_label": "Central School loading bay",
            "location_source": "manual",
            "vehicle_or_asset": "Utility van 03",
            "current_assignment": "Central School water resupply",
            "assignment_target": "center-central-school",
            "estimated_response_minutes": 15,
            "equipment": ["utility van", "water packs", "hand trolley", "inventory sheets"],
            "constraints": ["Two personnel unavailable", "Fuel confirmation pending"],
            "notes": "Suitable for non-life-safety logistics tasks while fuel is confirmed.",
            "last_location_at": resources["8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1204"]["reported_at"],
            "last_check_in_at": (now - timedelta(minutes=14)).isoformat(),
        },
        {
            "id": "group-delta",
            "name": "Delta Water Rescue",
            "agency": "MDRRMO",
            "group_type": "Water rescue",
            "specialties": ["boat operations", "shoreline extraction", "swiftwater rescue"],
            "status": "ready",
            "availability": "available",
            "readiness_score": 91,
            "personnel_ready": 4,
            "personnel_total": 4,
            "lead": "A. Manalo",
            "contact_channel": "VHF DRRM-1",
            "call_sign": "DELTA-BOAT",
            "notification_phone": "+639170000004",
            "notification_device": "demo-delta-device",
            "resource_id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1203",
            "location_label": "Municipal pier staging area",
            "location_source": "manual",
            "vehicle_or_asset": "Rescue boat · Pier 01",
            "current_assignment": None,
            "assignment_target": None,
            "estimated_response_minutes": 10,
            "equipment": ["rescue boat", "life jackets", "throw lines", "marine radio"],
            "constraints": ["Launch only after pier safety check"],
            "notes": "Best match for shoreline or floodwater extraction requests.",
            "last_location_at": resources["8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1203"]["reported_at"],
            "last_check_in_at": (now - timedelta(minutes=5)).isoformat(),
        },
        {
            "id": "group-echo",
            "name": "Echo Communications",
            "agency": "MDRRMO",
            "group_type": "Communications and relay",
            "specialties": ["VHF relay", "radio dispatch", "SMS fallback coordination"],
            "status": "ready",
            "availability": "available",
            "readiness_score": 97,
            "personnel_ready": 2,
            "personnel_total": 2,
            "lead": "L. Garcia",
            "contact_channel": "VHF DRRM-1",
            "call_sign": "ECHO-RELAY",
            "notification_phone": "+639170000005",
            "notification_device": "demo-echo-device",
            "resource_id": "8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1205",
            "location_label": "Municipal Hall communications desk",
            "location_source": "manual",
            "vehicle_or_asset": "VHF relay · Municipal Hall",
            "current_assignment": "Maintain DRRM-1 coverage",
            "assignment_target": "comms-network",
            "estimated_response_minutes": 3,
            "equipment": ["VHF base station", "handsets", "battery bank", "message log"],
            "constraints": ["Must retain one operator at Municipal Hall"],
            "notes": "Do not deploy the full group away from the relay desk.",
            "last_location_at": resources["8f8b1f2a-6b22-4a5b-90dc-9f8c7e7d1205"]["reported_at"],
            "last_check_in_at": (now - timedelta(minutes=2)).isoformat(),
        },
    ])


def demo_response_groups() -> dict:
    _ensure_demo_response_groups()
    now = datetime.now(timezone.utc)
    resources = {item["id"]: item for item in DEMO_GIS_RESOURCES}
    groups: list[dict] = []
    for group in DEMO_RESPONSE_GROUPS:
        resource = resources[group["resource_id"]]
        groups.append({
            key: value for key, value in group.items()
            if key != "resource_id"
        } | {
            "location": dict(resource["position"]),
            "location_accuracy_meters": resource.get("accuracy_meters"),
            "last_location_at": resource.get("reported_at") or group["last_location_at"],
        })
    all_specialties = sorted({specialty for group in groups for specialty in group["specialties"]})
    counts = {availability: sum(group["availability"] == availability for group in groups) for availability in ("available", "limited", "assigned", "standby", "offline")}
    stale_count = sum((now - datetime.fromisoformat(group["last_location_at"])).total_seconds() > 15 * 60 for group in groups)
    return {
        "generated_at": now.isoformat(),
        "source": "demo-seed",
        "groups": groups,
        "specialties": all_specialties,
        "availability_counts": counts,
        "stale_location_count": stale_count,
    }


def assign_demo_response_group(group_id: str, target_type: str, target_id: str, assignment_note: str | None = None) -> dict | None:
    _ensure_demo_response_groups()
    _ensure_demo_gis_resources()
    resources = {item["id"]: item for item in DEMO_GIS_RESOURCES}
    for group in DEMO_RESPONSE_GROUPS:
        if group["id"] != group_id:
            continue
        if group["availability"] in {"offline", "assigned"}:
            raise ValueError("group is not available for a new assignment")
        resource = resources[group["resource_id"]]
        if not _is_fresh_for_dispatch(resource.get("reported_at") or group.get("last_location_at")):
            raise ValueError("group location is stale; record a position check before assigning")
        if not _is_fresh_for_dispatch(group.get("last_check_in_at")):
            raise ValueError("group check-in is stale; record a roster check before assigning")
        if int(group.get("readiness_score") or 0) < 60:
            raise ValueError("group readiness is below the dispatch threshold")
        assigned_at = datetime.now(timezone.utc).isoformat()
        group["availability"] = "assigned"
        group["status"] = "deployed"
        group["current_assignment"] = assignment_note or f"Assigned to {target_type} {target_id}"
        group["assignment_target"] = target_id
        group["last_check_in_at"] = assigned_at
        resource["state"] = "deployed"
        resource["current_assignment"] = group["current_assignment"]
        return next(item for item in demo_response_groups()["groups"] if item["id"] == group_id)
    return None


def _demo_dispatch_event(assignment: dict, *, event_type: str, from_status: str | None, to_status: str, note: str | None, actor_user_id: str | None, actor_role: str | None) -> dict:
    event = {
        "id": str(uuid4()), "assignment_id": assignment["assignment_id"], "event_type": event_type,
        "from_status": from_status, "to_status": to_status, "note": note,
        "actor_user_id": actor_user_id, "actor_role": actor_role,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
    assignment["events"].append(event)
    return event


def create_demo_dispatch_assignment(group_id: str, target_type: str, target_id: str, assignment_note: str | None, actor_user_id: str | None, actor_role: str | None) -> dict | None:
    """Create a proposal only; no unit, notification, or SOS state changes until confirmation."""
    _ensure_demo_response_groups()
    _ensure_demo_gis_resources()
    resources = {item["id"]: item for item in DEMO_GIS_RESOURCES}
    group = next((item for item in DEMO_RESPONSE_GROUPS if item["id"] == group_id), None)
    if group is None:
        return None
    if group["availability"] in {"offline", "assigned"}:
        raise ValueError("group is not available for a dispatch proposal")
    resource = resources[group["resource_id"]]
    if not _is_fresh_for_dispatch(resource.get("reported_at") or group.get("last_location_at")):
        raise ValueError("group location is stale; record a position check before proposing dispatch")
    if not _is_fresh_for_dispatch(group.get("last_check_in_at")):
        raise ValueError("group check-in is stale; record a roster check before proposing dispatch")
    if int(group.get("readiness_score") or 0) < 60:
        raise ValueError("group readiness is below the dispatch threshold")
    now = datetime.now(timezone.utc).isoformat()
    assignment = {
        "assignment_id": str(uuid4()), "group_id": group_id, "target_type": target_type, "target_id": target_id,
        "assignment_note": assignment_note, "status": "pending_confirmation", "created_at": now,
        "confirmed_at": None, "acknowledged_at": None, "escalated_at": None, "cancelled_at": None, "closed_at": None,
        "events": [], "confirmation_required": True,
        "decision_limit": "A lifecycle status records human decisions and reported acknowledgement only; it does not prove notification delivery, route clearance, or field safety.",
    }
    _demo_dispatch_event(assignment, event_type="dispatch.proposed", from_status=None, to_status="pending_confirmation", note=assignment_note, actor_user_id=actor_user_id, actor_role=actor_role)
    DEMO_DISPATCH_ASSIGNMENTS.insert(0, assignment)
    return deepcopy(assignment)


def demo_dispatch_lifecycle(target_id: str | None = None) -> dict:
    assignments = [item for item in DEMO_DISPATCH_ASSIGNMENTS if target_id is None or item["target_id"] == target_id]
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "source": "demo-seed", "assignments": deepcopy(assignments)}


def transition_demo_dispatch_assignment(assignment_id: str, action: str, note: str | None, operator_confirmed: bool, actor_user_id: str | None, actor_role: str | None) -> dict | None:
    assignment = next((item for item in DEMO_DISPATCH_ASSIGNMENTS if item["assignment_id"] == assignment_id), None)
    if assignment is None:
        return None
    current = assignment["status"]
    transitions = {
        "confirm": ("pending_confirmation", "confirmed"),
        "acknowledge": ("confirmed", "acknowledged"),
        "escalate": (("confirmed", "acknowledged"), "escalated"),
        "cancel": (("pending_confirmation", "confirmed", "acknowledged", "escalated"), "cancelled"),
        "close": (("confirmed", "acknowledged", "escalated"), "closed"),
    }
    expected, next_status = transitions.get(action, ((), ""))
    allowed = current == expected if isinstance(expected, str) else current in expected
    if not allowed:
        raise ValueError(f"invalid dispatch lifecycle transition: {current} -> {action}")
    if action == "confirm" and not operator_confirmed:
        raise ValueError("explicit operator confirmation is required before dispatch is recorded")
    if action == "close" and not note:
        raise ValueError("a closure note is required before closing a dispatch")
    now = datetime.now(timezone.utc).isoformat()
    assignment["status"] = next_status
    assignment[f"{next_status}_at"] = now
    _demo_dispatch_event(assignment, event_type=f"dispatch.{next_status}", from_status=current, to_status=next_status, note=note, actor_user_id=actor_user_id, actor_role=actor_role)
    group = next((item for item in DEMO_RESPONSE_GROUPS if item["id"] == assignment["group_id"]), None)
    resource = next((item for item in DEMO_GIS_RESOURCES if group and item["id"] == group["resource_id"]), None)
    if group and action == "confirm":
        group["availability"] = "assigned"; group["status"] = "en_route"; group["current_assignment"] = assignment["assignment_note"] or f"Confirmed dispatch to {assignment['target_type']} {assignment['target_id']}"; group["assignment_target"] = assignment["target_id"]
        if resource: resource["state"] = "en_route"; resource["current_assignment"] = group["current_assignment"]
        if assignment["target_type"] == "sos_request":
            incident = next((item for item in DEMO_SOS_QUEUE if item["id"] == assignment["target_id"]), None)
            if incident and incident["status"] == "acknowledged": incident["status"] = "dispatched"
    if group and action in {"cancel", "close"}:
        group["availability"] = "available"; group["status"] = "ready"; group["current_assignment"] = None; group["assignment_target"] = None
        if resource: resource["state"] = "ready"; resource["current_assignment"] = None
    return deepcopy(assignment)


def create_demo_assignment_notification(
    group: dict,
    target_type: str,
    target_id: str,
    assignment_note: str | None,
    actor_user_id: str | None = None,
) -> list[dict]:
    """Create delivery records that mirror the live SMS + in-app flow."""
    now = datetime.now(timezone.utc).isoformat()
    message = assignment_note or f"Assignment received for {target_type} {target_id}. Confirm receipt with Balangiga DRRM command."
    notifications = [
        {
            "id": str(uuid4()), "group_id": group["id"], "target_type": target_type, "target_id": target_id,
            "channel": "sms", "channels": ["sms", "push", "in_app"], "status": "sending", "message": message,
            "recipient_label": group.get("call_sign") or group["name"], "recipient_address": group.get("notification_phone"),
            "created_at": now, "sent_at": now, "delivered_at": None, "acknowledged_at": None,
            "attempts": 1, "last_error": None, "assignment_note": assignment_note, "actor_user_id": actor_user_id,
        },
        {
            "id": str(uuid4()), "group_id": group["id"], "target_type": target_type, "target_id": target_id,
            "channel": "push", "channels": ["sms", "push", "in_app"], "status": "sending", "message": message,
            "recipient_label": group.get("call_sign") or group["name"], "recipient_address": group.get("notification_device"),
            "created_at": now, "sent_at": now, "delivered_at": None, "acknowledged_at": None,
            "attempts": 1, "last_error": None, "assignment_note": assignment_note, "actor_user_id": actor_user_id,
        },
        {
            "id": str(uuid4()), "group_id": group["id"], "target_type": target_type, "target_id": target_id,
            "channel": "in_app", "channels": ["sms", "push", "in_app"], "status": "delivered", "message": message,
            "recipient_label": group.get("call_sign") or group["name"], "recipient_address": group.get("notification_device"),
            "created_at": now, "sent_at": now, "delivered_at": now, "acknowledged_at": None,
            "attempts": 1, "last_error": None, "assignment_note": assignment_note, "actor_user_id": actor_user_id,
        },
    ]
    DEMO_NOTIFICATIONS[0:0] = notifications
    record_demo_audit(
        actor_user_id=actor_user_id,
        actor_role="dispatcher",
        action="notification.queued",
        resource_type="assignment_notification",
        resource_id=notifications[0]["id"],
        metadata={"group_id": group["id"], "target_type": target_type, "target_id": target_id, "channels": ["sms", "push", "in_app"]},
    )
    return notifications


def demo_notifications() -> dict:
    now = datetime.now(timezone.utc)
    notifications = [dict(item) for item in DEMO_NOTIFICATIONS[:100]]
    return {
        "generated_at": now.isoformat(),
        "source": "demo-seed",
        "notifications": notifications,
        "pending_count": sum(item["status"] in {"queued", "sending", "failed"} for item in notifications),
        "failed_count": sum(item["status"] == "failed" for item in notifications),
    }


def acknowledge_demo_notification(notification_id: str, note: str | None = None, actor_user_id: str | None = None) -> dict | None:
    now = datetime.now(timezone.utc).isoformat()
    for item in DEMO_NOTIFICATIONS:
        if item["id"] != notification_id:
            continue
        if item["status"] == "acknowledged":
            return item
        item["status"] = "acknowledged"
        item["acknowledged_at"] = now
        item["last_error"] = None
        record_demo_audit(
            actor_user_id=actor_user_id, actor_role="responder", action="notification.acknowledged",
            resource_type="assignment_notification", resource_id=notification_id,
            metadata={"note": note} if note else {},
        )
        return item
    return None


def retry_demo_notification(notification_id: str, actor_user_id: str | None = None) -> dict | None:
    for item in DEMO_NOTIFICATIONS:
        if item["id"] != notification_id:
            continue
        item["attempts"] += 1
        item["status"] = "sending"
        item["last_error"] = None
        record_demo_audit(
            actor_user_id=actor_user_id, actor_role="dispatcher", action="notification.retry_requested",
            resource_type="assignment_notification", resource_id=notification_id,
            metadata={"attempt": item["attempts"]},
        )
        return item
    return None


def demo_route() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "center_id": str(DEMO_CENTER_ID),
        "center_name": "Balangiga Central School Evacuation Center",
        "distance_meters": 920,
        "estimated_seconds": 780,
        "route": [
            {"latitude": 11.1264, "longitude": 125.3892},
            {"latitude": 11.1297, "longitude": 125.3922},
            {"latitude": 11.1322, "longitude": 125.3975},
        ],
        "avoided_hazard_count": 2,
        "route_is_safe_as_of": now.isoformat(),
        "source": "demo-seed",
    }


def demo_gis_map() -> dict:
    _ensure_demo_gis_resources()
    now = datetime.now(timezone.utc)
    hazards = [
        {
            "id": "hazard-flood-01",
            "name": "Coastal road flood polygon",
            "hazard": "flood",
            "severity": "critical",
            "status": "active",
            "polygon": [
                {"latitude": 11.1238, "longitude": 125.3845},
                {"latitude": 11.1295, "longitude": 125.3848},
                {"latitude": 11.1310, "longitude": 125.3920},
                {"latitude": 11.1260, "longitude": 125.3940},
                {"latitude": 11.1225, "longitude": 125.3900},
            ],
            "last_verified": (now - timedelta(minutes=6)).isoformat(),
            "action": "Keep rescue routing on the inland road.",
        },
        {
            "id": "hazard-surge-01",
            "name": "Storm-surge watch area",
            "hazard": "storm_surge",
            "severity": "warning",
            "status": "monitoring",
            "polygon": [
                {"latitude": 11.1210, "longitude": 125.4020},
                {"latitude": 11.1260, "longitude": 125.4080},
                {"latitude": 11.1370, "longitude": 125.4090},
                {"latitude": 11.1370, "longitude": 125.4030},
                {"latitude": 11.1300, "longitude": 125.4000},
            ],
            "last_verified": (now - timedelta(minutes=12)).isoformat(),
            "action": "Pre-position boats and notify shoreline households.",
        },
        {
            "id": "hazard-road-01",
            "name": "Bridge approach obstruction",
            "hazard": "road_closure",
            "severity": "warning",
            "status": "active",
            "polygon": [
                {"latitude": 11.1350, "longitude": 125.3990},
                {"latitude": 11.1373, "longitude": 125.3995},
                {"latitude": 11.1370, "longitude": 125.4018},
                {"latitude": 11.1347, "longitude": 125.4013},
            ],
            "last_verified": (now - timedelta(minutes=18)).isoformat(),
            "action": "Route heavy vehicles through Poblacion.",
        },
    ]
    return {
        "generated_at": now.isoformat(),
        "source": "demo-seed",
        "center": {"latitude": 11.1305, "longitude": 125.3970},
        "bbox": [125.3820, 11.1200, 125.4100, 11.1450],
        "resources": demo_gis_resources(),
        "hazards": hazards,
        "centers": [
            {
                "id": center["id"],
                "name": center["name"],
                "status": center["status"],
                "capacity_total": center["capacity_total"],
                "occupancy_current": center["occupancy_current"],
                "position": center["location"],
            }
            for center in demo_centers()
        ],
        "sos": [
            {
                "id": item["id"],
                "status": item["status"],
                "severity": item["severity"],
                "position": item["location"],
                "accuracy_meters": item["location"].get("accuracy_meters"),
                "summary": item["summary"],
            }
            for item in DEMO_SOS_QUEUE
        ],
        "source_health": [
            {
                "id": f"alert-feed-{item['source_name'].lower().replace(' ', '-')}",
                "label": item["source_name"],
                "category": "alert_feed",
                "provenance_url": item.get("endpoint_url"),
                "last_success_at": item.get("last_success_at"),
                "last_checked_at": item.get("last_checked_at") or item.get("last_success_at"),
                "stale_after_seconds": 900,
                "status": "stale" if item.get("stale") else "healthy",
                "review_required": True,
                "decision_limit": "Feed freshness supports review only; verify an alert with the issuing authority and local observations before acting or warning the public.",
            }
            for item in demo_feed_health()
        ] + [
            {
                "id": "project-noah-reference",
                "label": "Project NOAH modeled hazard references",
                "category": "hazard_reference",
                "provenance_url": "https://noah.up.edu.ph/",
                "last_success_at": None,
                "last_checked_at": None,
                "stale_after_seconds": None,
                "status": "reference_only",
                "review_required": True,
                "decision_limit": "Static modeled reference context only; it does not confirm active hazards, route clearance, or field safety.",
            },
            {
                "id": "official-facility-registry",
                "label": "Official DOH facility reference registry",
                "category": "facility_reference",
                "provenance_url": "https://hfsrb.doh.gov.ph/",
                "last_success_at": None,
                "last_checked_at": None,
                "stale_after_seconds": None,
                "status": "reference_only",
                "review_required": True,
                "decision_limit": "Reference locations and service classification only; LGU/DRRMO or facility verification is required before readiness, access, or availability is relied on.",
            },
        ],
    }


def demo_facility_verifications(facility_id: str | None = None) -> dict:
    records = [item for item in DEMO_FACILITY_VERIFICATIONS if facility_id is None or item["facility_id"] == facility_id]
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "source": "demo-seed", "records": deepcopy(records)}


def create_demo_facility_verification(*, facility_id: str, coordinate_confirmed: bool, contact_attempted: bool, reported_access: str, verification_outcome: str, source_document_reference: str, revalidation_due_at: str, verification_note: str, actor_user_id: str | None, actor_role: str | None) -> dict:
    record = {
        "id": str(uuid4()), "facility_id": facility_id, "coordinate_confirmed": coordinate_confirmed,
        "contact_attempted": contact_attempted, "reported_access": reported_access,
        "verification_outcome": verification_outcome, "source_document_reference": source_document_reference,
        "revalidation_due_at": revalidation_due_at, "verification_note": verification_note,
        "verified_by_user_id": actor_user_id, "verified_by_role": actor_role,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "decision_limit": "This verification records reported reference and contact checks only. It does not establish staffing, capacity, supplies, communications, structural safety, or suitability for an emergency task.",
    }
    DEMO_FACILITY_VERIFICATIONS.insert(0, record)
    record_demo_audit(
        actor_user_id=actor_user_id, actor_role=actor_role, action="facility.verification_recorded",
        resource_type="official_facility", resource_id=facility_id,
        metadata={"verification_outcome": verification_outcome, "coordinate_confirmed": coordinate_confirmed, "contact_attempted": contact_attempted, "reported_access": reported_access, "revalidation_due_at": revalidation_due_at},
    )
    return deepcopy(record)


def demo_gis_route(latitude: float, longitude: float, destination_center_id: str | None = None) -> dict:
    centers = [center for center in demo_centers() if center["status"] in ("open", "unknown") and center["occupancy_current"] < center["capacity_total"]]
    destination = next((center for center in centers if center["id"] == destination_center_id), None) if destination_center_id else None
    destination = destination or min(centers, key=lambda center: (center["location"]["latitude"] - latitude) ** 2 + (center["location"]["longitude"] - longitude) ** 2)
    center_lat = destination["location"]["latitude"]
    center_lon = destination["location"]["longitude"]
    now = datetime.now(timezone.utc)
    return {
        "center_id": destination["id"],
        "center_name": destination["name"],
        "origin": {"latitude": latitude, "longitude": longitude},
        "distance_meters": round(((center_lat - latitude) ** 2 + (center_lon - longitude) ** 2) ** 0.5 * 111000),
        "estimated_seconds": 780,
        "route": [
            {"latitude": latitude, "longitude": longitude},
            {"latitude": round((latitude + center_lat) / 2 + 0.0016, 5), "longitude": round((longitude + center_lon) / 2 - 0.0008, 5)},
            {"latitude": center_lat, "longitude": center_lon},
        ],
        "avoided_hazard_count": 3,
        "blocked_segment_count": 1,
        "route_status": "safe",
        "route_is_safe_as_of": now.isoformat(),
        "warnings": [
            "Demo route uses the seeded road graph and hazard snapshot.",
            "Confirm road and water conditions with the assigned field team before departure.",
        ],
    }


def demo_operations() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "generated_at": now.isoformat(),
        "incident_phase": "response",
        "operating_period": "12 Aug 2026 · 06:00–18:00 local",
        "objectives": [
            "Protect life in coastal and low-lying barangays before the next high-tide window.",
            "Keep an open, verified evacuation option available for every active risk area.",
            "Maintain redundant communications while commercial power and mobile signal remain unstable.",
            "Log every dispatch, public warning, and handover for a defensible operational record.",
        ],
        "teams": [
            {
                "id": "team-alpha",
                "name": "Alpha Rescue",
                "mission": "Coastal road extraction",
                "status": "en_route",
                "lead": "R. Dela Cruz",
                "members": 6,
                "vehicle": "Rescue truck 01",
                "channel": "VHF DRRM-1",
                "last_update": (now - timedelta(minutes=3)).isoformat(),
            },
            {
                "id": "team-bravo",
                "name": "Bravo Medical",
                "mission": "Triage at Barangay 2",
                "status": "deployed",
                "lead": "J. Santos, RN",
                "members": 4,
                "vehicle": "Ambulance 02",
                "channel": "VHF DRRM-2",
                "last_update": (now - timedelta(minutes=8)).isoformat(),
            },
            {
                "id": "team-charlie",
                "name": "Charlie Logistics",
                "mission": "Center resupply and charging",
                "status": "standby",
                "lead": "M. Villanueva",
                "members": 5,
                "vehicle": "Utility van 03",
                "channel": "SMS fallback",
                "last_update": (now - timedelta(minutes=14)).isoformat(),
            },
        ],
        "resources": [
            {"id": "rescue-boats", "name": "Rescue boats", "category": "rescue", "location": "Municipal pier", "available": 2, "total": 3, "unit": "boats", "status": "ready", "owner": "MDRRMO"},
            {"id": "life-jackets", "name": "Life jackets", "category": "rescue", "location": "MDRRMO store", "available": 46, "total": 80, "unit": "kits", "status": "low", "owner": "MDRRMO"},
            {"id": "medical-kits", "name": "Trauma and first-aid kits", "category": "medical", "location": "Municipal gym", "available": 12, "total": 18, "unit": "kits", "status": "ready", "owner": "RHU / BFP"},
            {"id": "ambulances", "name": "Ambulances", "category": "transport", "location": "MDRRMO bay", "available": 1, "total": 2, "unit": "vehicles", "status": "deployed", "owner": "RHU"},
            {"id": "water-packs", "name": "Drinking-water packs", "category": "relief", "location": "Central School", "available": 128, "total": 300, "unit": "packs", "status": "low", "owner": "CSWDO"},
            {"id": "vhf-handsets", "name": "VHF handsets", "category": "communications", "location": "MDRRMO desk", "available": 9, "total": 12, "unit": "radios", "status": "ready", "owner": "MDRRMO"},
        ],
        "communications": [
            {"id": "comms-001", "title": "Prepare to move: coastal and low-lying areas", "audience": "Barangays 1, 2, and 4 residents", "channel": "sms", "status": "sent", "owner": "Duty officer", "sent_at": (now - timedelta(minutes=22)).isoformat(), "acknowledgements": 342, "target_count": 510},
            {"id": "comms-002", "title": "Evacuation center capacity and intake protocol", "audience": "Center managers and barangay focal points", "channel": "radio", "status": "acknowledged", "owner": "Operations lead", "sent_at": (now - timedelta(minutes=34)).isoformat(), "acknowledgements": 8, "target_count": 9},
            {"id": "comms-003", "title": "All-clear not issued — continue sheltering", "audience": "Municipal public information network", "channel": "social", "status": "queued", "owner": "PIO desk", "sent_at": None, "acknowledgements": 0, "target_count": 1},
        ],
        "readiness": [
            {"barangay": "Barangay 1", "population_at_risk": 86, "priority": "high", "evacuation_status": "in_progress", "assigned_center": "Barangay 2 Central School", "transport": "1 rescue truck · 1 boat on standby", "last_contact": (now - timedelta(minutes=4)).isoformat(), "needs": ["life jackets", "elderly assistance"]},
            {"barangay": "Barangay 2", "population_at_risk": 54, "priority": "high", "evacuation_status": "mobilizing", "assigned_center": "Balangiga Central School", "transport": "Barangay service vehicle", "last_contact": (now - timedelta(minutes=9)).isoformat(), "needs": ["medical triage", "charging access"]},
            {"barangay": "Barangay 4", "population_at_risk": 47, "priority": "medium", "evacuation_status": "in_progress", "assigned_center": "Barangay 4 Covered Court", "transport": "Walking groups · utility van", "last_contact": (now - timedelta(minutes=13)).isoformat(), "needs": ["roof inspection", "water packs"]},
        ],
        "hazards": [
            {"id": "hazard-flood-01", "name": "Coastal road flood polygon", "type": "flood", "severity": "critical", "status": "active", "affected_area": "Barangay 1 coastal road · 0.8 km", "last_verified": (now - timedelta(minutes=6)).isoformat(), "action": "Keep rescue routing on the inland road."},
            {"id": "hazard-surge-01", "name": "Storm-surge watch area", "type": "storm_surge", "severity": "warning", "status": "monitoring", "affected_area": "Low shoreline communities", "last_verified": (now - timedelta(minutes=12)).isoformat(), "action": "Pre-position boats and notify shoreline households."},
            {"id": "hazard-road-01", "name": "Bridge approach obstruction", "type": "road_closure", "severity": "warning", "status": "active", "affected_area": "Barangay 4 bridge approach", "last_verified": (now - timedelta(minutes=18)).isoformat(), "action": "Route heavy vehicles through Poblacion."},
        ],
        "tasks": [
            {"id": "task-001", "title": "Confirm Barangay 1 household sweep", "owner": "Alpha Rescue", "priority": "critical", "status": "in_progress", "due_by": "10:40", "dependency": "Coastal road remains passable"},
            {"id": "task-002", "title": "Verify Central School intake headcount", "owner": "Center manager", "priority": "high", "status": "open", "due_by": "10:50", "dependency": None},
            {"id": "task-003", "title": "Send second public warning with center capacity", "owner": "PIO desk", "priority": "high", "status": "open", "due_by": "11:00", "dependency": "Operations lead approval"},
            {"id": "task-004", "title": "Refuel utility van and deploy water packs", "owner": "Charlie Logistics", "priority": "routine", "status": "blocked", "due_by": "11:20", "dependency": "Fuel delivery confirmation"},
        ],
    }


DEMO_OPERATIONS_STATE: dict | None = None


def demo_operations_state() -> dict:
    global DEMO_OPERATIONS_STATE
    if DEMO_OPERATIONS_STATE is None:
        DEMO_OPERATIONS_STATE = demo_operations()
    return deepcopy(DEMO_OPERATIONS_STATE)


def apply_demo_operations_action(*, action: str, resource_type: str, resource_id: str | None = None, note: str | None = None) -> bool:
    global DEMO_OPERATIONS_STATE
    if DEMO_OPERATIONS_STATE is None:
        DEMO_OPERATIONS_STATE = demo_operations()
    state = DEMO_OPERATIONS_STATE
    now = datetime.now(timezone.utc).isoformat()
    mutated = False

    if resource_type == "resource":
        item = next((entry for entry in state["resources"] if entry["id"] == resource_id), None)
        if item is not None:
            item["last_action"] = action
            item["last_action_at"] = now
            if action == "resource.resupply_requested":
                item["status"] = "low"
            elif action == "resource.reserve_requested":
                item["status"] = "deployed" if item["available"] > 0 else "unavailable"
            mutated = True
    elif resource_type == "communications_plan":
        if action == "bulletin.draft_started":
            sequence = len(state["communications"]) + 1
            state["communications"].insert(0, {
                "id": f"comms-draft-{sequence:03d}",
                "title": "New public information bulletin",
                "audience": "LGU public information network",
                "channel": "social",
                "status": "draft",
                "owner": "Duty officer",
                "sent_at": None,
                "acknowledgements": 0,
                "target_count": 1,
                "last_action": action,
                "last_action_at": now,
            })
            mutated = True
        else:
            item = next((entry for entry in state["communications"] if entry["id"] == resource_id), None)
            if item is not None:
                item["last_action"] = action
                item["last_action_at"] = now
                if action == "bulletin.released" and item["status"] == "queued":
                    item["status"] = "sent"
                    item["sent_at"] = now
                elif action == "bulletin.acknowledgements_reviewed":
                    item["acknowledgements_reviewed_at"] = now
                mutated = True
    elif resource_type == "barangay_readiness":
        item = next((entry for entry in state["readiness"] if entry["barangay"] == resource_id), None)
        if item is not None:
            item["last_contact"] = now
            item["last_action"] = action
            item["last_action_at"] = now
            mutated = True
    elif resource_type == "feed_source":
        if action == "feeds.sync_requested":
            update_demo_feed_health()
            mutated = True
        elif action == "feed.health_checked" and resource_id:
            _ensure_demo_feed_health()
            if resource_id in DEMO_FEED_HEALTH:
                update_demo_feed_health(resource_id)
                mutated = True
    elif resource_type == "response_group":
        if action == "response_group.checked_in" and resource_id:
            _ensure_demo_response_groups()
            _ensure_demo_gis_resources()
            group = next((entry for entry in DEMO_RESPONSE_GROUPS if entry["id"] == resource_id), None)
            if group is not None:
                group["last_check_in_at"] = now
                group["last_location_at"] = now
                group["last_action"] = action
                group["last_action_at"] = now
                resource = next((entry for entry in DEMO_GIS_RESOURCES if entry["id"] == group["resource_id"]), None)
                if resource is not None:
                    resource["reported_at"] = now
                    resource["location_source"] = "roster_check_in"
                mutated = True
    elif resource_type == "evacuation_center":
        _ensure_demo_centers()
        targets = [
            center for center in (DEMO_CENTERS or [])
            if resource_id is None or center["id"] == resource_id
        ]
        if action == "centers.capacity_reviewed" and resource_id is None:
            targets = list(DEMO_CENTERS or [])
        for center in targets:
            center["last_action"] = action
            center["last_action_at"] = now
            if action in {"center.capacity_verified", "centers.capacity_reviewed"}:
                center["capacity_verified_at"] = now
            if note:
                center["last_action_note"] = note
        mutated = bool(targets)
    elif resource_type == "hazard_register":
        for item in state["hazards"]:
            item["last_reviewed_at"] = now
        mutated = True
    elif resource_type == "command_center_task":
        item = next((entry for entry in state["tasks"] if entry["id"] == resource_id), None)
        if item is not None:
            item["last_action"] = action
            item["last_action_at"] = now
            if action == "task.started" and item["status"] == "open":
                item["status"] = "in_progress"
            elif action == "task.completed":
                item["status"] = "complete"
            mutated = True

    return mutated


def record_demo_operations_action(
    *,
    actor_user_id: str | None,
    actor_role: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    note: str | None = None,
) -> dict:
    mutated = apply_demo_operations_action(action=action, resource_type=resource_type, resource_id=resource_id, note=note)
    if resource_type == "verified_alert" and resource_id:
        alert = next((item for item in DEMO_ALERTS if item["id"] == resource_id), None)
        if alert is not None:
            now = datetime.now(timezone.utc).isoformat()
            alert["last_action"] = action
            alert["last_action_at"] = now
            if action == "alert.verified":
                alert["verification_status"] = "verified"
                alert["verified_at"] = now
            elif action == "bulletin.queued":
                alert["bulletin_status"] = "queued"
                alert["bulletin_queued_at"] = now
            mutated = True
    if resource_type == "evacuation_center" and resource_id:
        mutated = update_demo_center(resource_id, action=action, note=note) is not None or mutated
    event = record_demo_audit(
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata={"note": note, "mutated_demo_state": mutated} if note else {"mutated_demo_state": mutated},
    )
    return {
        "status": "recorded",
        "action_id": event["id"],
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "recorded_at": event["created_at"],
        "mutated": mutated,
    }
