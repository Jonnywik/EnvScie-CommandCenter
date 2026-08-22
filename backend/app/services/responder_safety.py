from __future__ import annotations

from datetime import datetime, timezone
from math import cos, radians, sqrt
from typing import Any, Iterable
from uuid import uuid4


def _as_datetime(value: Any, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return fallback
    else:
        return fallback
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _distance_meters(origin: dict[str, Any], destination: dict[str, Any]) -> int:
    latitude = float(origin.get("latitude") or 0)
    longitude = float(origin.get("longitude") or 0)
    target_latitude = float(destination.get("latitude") or 0)
    target_longitude = float(destination.get("longitude") or 0)
    return int(sqrt(
        ((target_latitude - latitude) * 111000) ** 2
        + ((target_longitude - longitude) * 111000 * cos(radians(latitude))) ** 2
    ))


def _risk_band(score: int) -> str:
    if score >= 70:
        return "severe"
    if score >= 50:
        return "high"
    if score >= 30:
        return "moderate"
    return "low"


def build_responder_safety_assessment(
    *,
    incident: dict[str, Any],
    groups: Iterable[dict[str, Any]],
    active_hazard_count: int,
    source: str,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Score potential responder exposure for a *verified* SOS.

    This deliberately produces an explainable decision-support result, not a
    dispatch decision, route clearance, or authority to enter a hazard area.
    Static susceptibility layers are only represented as exposure context.
    """
    generated_at = now or datetime.now(timezone.utc)
    severity = str(incident.get("severity") or "warning").lower()
    emergency_type = str(incident.get("emergency_type") or "").upper()
    incident_location = incident.get("location") or {}
    incident_accuracy = incident_location.get("accuracy_meters")
    hazard_base = {"critical": 28, "high": 24, "warning": 16, "medium": 12, "low": 8}.get(severity, 12)
    water_incident = emergency_type in {"FLOOD", "TRAPPED"}
    shared_hazard_score = hazard_base + (12 if water_incident else 0) + (8 if active_hazard_count else 0)
    candidate_assessments: list[dict[str, Any]] = []

    for group in groups:
        location = group.get("location") or {}
        distance = _distance_meters(incident_location, location)
        last_location = _as_datetime(group.get("last_location_at"), generated_at)
        last_check_in = _as_datetime(group.get("last_check_in_at"), generated_at)
        location_age = max(0, int((generated_at - last_location).total_seconds() // 60))
        check_in_age = max(0, int((generated_at - last_check_in).total_seconds() // 60))
        readiness = max(0, min(100, int(group.get("readiness_score") or 0)))
        availability = str(group.get("availability") or "offline")
        constraints = list(group.get("constraints") or [])
        specialties = {str(value).lower() for value in group.get("specialties") or []}
        equipment = {str(value).lower() for value in group.get("equipment") or []}
        comms_configured = bool(group.get("contact_channel")) and "offline" not in str(group.get("contact_channel")).lower()
        water_capable = bool({"swiftwater rescue", "boat operations", "shoreline extraction"} & specialties)
        flotation_available = any("life jacket" in item or "throw" in item for item in equipment)

        exposure_score = min(16, distance // 700) + (12 if location_age > 15 else 0) + (10 if check_in_age > 15 else 0)
        vulnerability_score = round((100 - readiness) * 0.20) + (7 if availability in {"assigned", "limited"} else 0)
        if water_incident and not water_capable:
            vulnerability_score += 14
        if incident_accuracy is not None and float(incident_accuracy) > 100:
            exposure_score += 4
        constraints_score = min(14, len(constraints) * 3) + 10  # route safety is always unconfirmed by this score.
        control_credit = (8 if comms_configured else 0) + (7 if water_incident and flotation_available else 0)
        score = max(0, min(100, shared_hazard_score + exposure_score + vulnerability_score + constraints_score - control_credit))

        hard_hold_reasons: list[str] = []
        if availability == "offline":
            hard_hold_reasons.append("Response group is offline.")
        if readiness < 60:
            hard_hold_reasons.append("Readiness is below the existing dispatch threshold of 60/100.")
        if location_age > 15:
            hard_hold_reasons.append("Last known position is older than 15 minutes.")
        if check_in_age > 15:
            hard_hold_reasons.append("Last responder check-in is older than 15 minutes.")
        if water_incident and not water_capable:
            hard_hold_reasons.append("Water-rescue specialty is not recorded for this water-related incident.")

        factors = [
            {"factor": "incident_hazard", "points": shared_hazard_score, "detail": f"{severity} {emergency_type or 'SOS'} incident; {active_hazard_count} active operational hazard record(s) in the map snapshot."},
            {"factor": "responder_exposure", "points": exposure_score, "detail": f"Estimated {distance} m away; location age {location_age} min; check-in age {check_in_age} min."},
            {"factor": "responder_vulnerability", "points": vulnerability_score, "detail": f"Readiness {readiness}/100; availability is {availability}."},
            {"factor": "operational_controls", "points": -control_credit, "detail": "Recorded communications and applicable flotation equipment reduce—but never eliminate—risk."},
            {"factor": "route_uncertainty", "points": constraints_score, "detail": "Route and scene safety require current human verification before movement."},
        ]
        protective_controls = [
            "Confirm a current radio or SMS check-in and a turnaround / emergency withdrawal signal.",
            "Confirm the selected route and scene access with a current field report; this score does not clear a route.",
            "Brief the team on incident location accuracy, known hazard records, and the current weather picture.",
            "Record team lead, call sign, personnel count, equipment, departure time, and next check-in time.",
        ]
        if water_incident:
            protective_controls.insert(1, "Confirm personal flotation devices, throw lines, boat / shoreline controls, and an approved launch or entry check.")
        field_tasks = [
            "Acknowledge tasking only after the team lead confirms current capability and constraints.",
            "Use the approved communications channel; report route blockage, water rise, injury, or loss of contact immediately.",
            "Stop, withdraw, or request reassessment if field conditions differ materially from the verified SOS or briefing.",
        ]
        candidate_assessments.append({
            "group_id": str(group.get("id")),
            "group_name": group.get("name") or str(group.get("id")),
            "call_sign": group.get("call_sign") or group.get("name"),
            "risk_score": score,
            "risk_band": _risk_band(score),
            "review_status": "hold" if hard_hold_reasons else "coordinator_review_required",
            "distance_meters": distance,
            "location_age_minutes": location_age,
            "check_in_age_minutes": check_in_age,
            "readiness_score": readiness,
            "availability": availability,
            "factors": factors,
            "hold_reasons": hard_hold_reasons,
            "protective_controls": protective_controls,
            "field_execution_tasks": field_tasks,
            "recorded_constraints": constraints,
        })

    candidate_assessments.sort(key=lambda item: (item["review_status"] == "hold", -item["risk_score"], item["distance_meters"]))
    return {
        "assessment_id": f"rsa-{uuid4()}",
        "generated_at": generated_at.isoformat(),
        "source": source,
        "engine_version": "responder-safety-v1",
        "incident": {
            "id": str(incident.get("id")), "status": incident.get("status"), "severity": severity,
            "emergency_type": emergency_type, "barangay": incident.get("barangay"), "location": incident_location,
        },
        "active_hazard_count": active_hazard_count,
        "assessments": candidate_assessments,
        "command_center_tasks": [
            "Confirm the SOS remains verified, locate the caller or barangay contact, and record any material change.",
            "Compare the assessor’s factors with live map hazards, current weather, and a field route check before assigning a group.",
            "Confirm crew check-in, readiness, specialty, equipment, route, communications, and withdrawal trigger before dispatch.",
            "Treat any hold or stale-data factor as a requirement for correction or documented override by an authorized coordinator.",
        ],
        "decision_limits": [
            "This is responder-safety decision support, not an automatic dispatch, route clearance, entry authorization, or safety guarantee.",
            "Static Project NOAH susceptibility context must not be treated as live flooding, passability, or damage confirmation.",
            "A coordinator must verify current field conditions and use the existing dispatch guardrails before assigning a response group.",
        ],
        "automatic_dispatch_created": False,
        "route_cleared": False,
    }
