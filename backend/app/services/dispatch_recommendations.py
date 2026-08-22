from __future__ import annotations

from datetime import datetime, timezone
from math import cos, radians, sqrt
from typing import Any, Iterable


DERIVED_SPECIALTIES: dict[str, list[str]] = {
    "MEDICAL": ["emergency triage", "first aid", "patient transport"],
    "TRAPPED": ["swiftwater rescue", "household extraction", "boat operations"],
    "FLOOD": ["swiftwater rescue", "boat operations", "shoreline extraction"],
    "STRUCTURAL": ["household extraction", "first aid"],
    "LOGISTICS": ["relief distribution", "water resupply", "evacuation-center support"],
}


def _specialty_key(value: str) -> str:
    return value.strip().lower().replace("_", " ").replace("-", " ")


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


def build_dispatch_recommendations(
    *,
    groups: Iterable[dict[str, Any]],
    incident_id: str,
    severity: str,
    emergency_type: str,
    latitude: float,
    longitude: float,
    required_specialties: list[str],
    max_results: int,
    source: str,
    engine_version: str = "dispatch-score-v1",
    now: datetime | None = None,
) -> dict[str, Any]:
    """Rank response groups using the auditable demo/live scoring contract.

    The service is deliberately data-source agnostic. Demo state and PostGIS rows
    are normalized into the same response-group shape before reaching this function.
    """
    generated_at = now or datetime.now(timezone.utc)
    needed = required_specialties or DERIVED_SPECIALTIES.get(emergency_type.upper(), [emergency_type.lower()])
    needed = list(dict.fromkeys(needed))
    severity_points = {"critical": 36, "high": 32, "warning": 24, "medium": 16, "low": 10}.get(severity, 16)
    ranked: list[dict[str, Any]] = []

    for group in groups:
        location = group.get("location") or {}
        group_latitude = float(location.get("latitude") or 0)
        group_longitude = float(location.get("longitude") or 0)
        distance = int(sqrt(
            ((group_latitude - latitude) * 111000) ** 2
            + ((group_longitude - longitude) * 111000 * cos(radians(latitude))) ** 2
        ))
        last_location = _as_datetime(group.get("last_location_at"), generated_at)
        freshness = max(0, int((generated_at - last_location).total_seconds() / 60))
        group_specialties = {_specialty_key(item): item for item in (group.get("specialties") or [])}
        needed_keys = {_specialty_key(item) for item in needed}
        matches = sorted(group_specialties[key] for key in group_specialties if key in needed_keys)
        missing = sorted(item for item in needed if _specialty_key(item) not in group_specialties)
        availability = group.get("availability", "offline")
        availability_points = {"available": 18, "limited": 9, "standby": 7, "assigned": 2, "offline": 0}.get(availability, 0)
        proximity_points = max(0, 18 - min(18, distance // 100))
        freshness_points = 10 if freshness <= 10 else 5 if freshness <= 20 else 0
        specialty_points = min(22, len(matches) * 8)
        constraints = list(group.get("constraints") or [])
        constraints_penalty = min(18, len(constraints) * 4 + (6 if availability == "assigned" else 0))
        readiness = int(group.get("readiness_score") or 0)
        readiness_points = round(readiness * 0.16)
        score = max(0, min(100, severity_points + specialty_points + proximity_points + readiness_points + availability_points + freshness_points - constraints_penalty))
        if availability == "offline":
            eligibility = "ineligible"
        elif availability in {"assigned", "limited"} or constraints_penalty >= 12:
            eligibility = "constrained"
        elif matches:
            eligibility = "recommended"
        else:
            eligibility = "eligible"
        estimated_minutes = group.get("estimated_response_minutes")
        if estimated_minutes is None and availability != "offline":
            estimated_minutes = max(1, round(distance / 450))
        ranked.append({
            "rank": 0,
            "group_id": str(group["id"]),
            "group_name": group.get("name", str(group["id"])),
            "eligibility": eligibility,
            "score": score,
            "distance_meters": distance,
            "estimated_response_minutes": estimated_minutes,
            "specialty_match": matches,
            "missing_specialties": missing,
            "freshness_minutes": freshness,
            "factors": [
                {"factor": "specialty_match", "points": specialty_points, "detail": f"{len(matches)} of {len(needed)} required specialties matched"},
                {"factor": "proximity", "points": proximity_points, "detail": f"Estimated {distance} m from incident origin"},
                {"factor": "readiness", "points": readiness_points, "detail": f"Readiness score {readiness}/100"},
                {"factor": "availability", "points": availability_points, "detail": f"Group is {availability}"},
                {"factor": "freshness", "points": freshness_points, "detail": f"Position checked {freshness} min ago"},
                {"factor": "constraints", "points": -constraints_penalty, "detail": "; ".join(constraints) or "No recorded constraints"},
            ],
            "reasons": [
                f"Matches {', '.join(matches)}" if matches else "No direct specialty match",
                f"{distance} m from incident",
                f"{readiness}/100 readiness",
            ],
            "constraints": constraints,
        })

    ranked.sort(key=lambda item: (item["eligibility"] == "recommended", item["score"], -item["distance_meters"]), reverse=True)
    ranked = ranked[:max_results]
    for index, item in enumerate(ranked, start=1):
        item["rank"] = index
    recommended = next((item["group_id"] for item in ranked if item["eligibility"] == "recommended"), None)
    return {
        "generated_at": generated_at,
        "source": source,
        "engine_version": engine_version,
        "incident": {
            "incident_id": incident_id,
            "severity": severity,
            "emergency_type": emergency_type,
            "latitude": latitude,
            "longitude": longitude,
            "required_specialties": needed,
        },
        "recommended_group_id": recommended,
        "recommendations": ranked,
        "safety_notes": [
            "Recommendation is advisory; dispatcher must confirm current channel acknowledgement and route safety.",
            "Assigned, stale, constrained, or offline groups are not treated as clear for immediate deployment.",
        ],
    }
