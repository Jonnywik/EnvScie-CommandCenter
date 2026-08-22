from datetime import datetime, timezone

from app.services.dispatch_recommendations import build_dispatch_recommendations


def test_dispatch_recommendations_rank_specialty_and_freshness() -> None:
    now = datetime(2026, 8, 17, 4, 0, tzinfo=timezone.utc)
    groups = [
        {
            "id": "rescue-a",
            "name": "Alpha Rescue",
            "availability": "available",
            "readiness_score": 92,
            "specialties": ["swiftwater rescue", "boat operations"],
            "constraints": [],
            "last_location_at": "2026-08-17T03:58:00+00:00",
            "location": {"latitude": 11.1305, "longitude": 125.3970},
            "personnel_ready": 6,
            "personnel_total": 6,
        },
        {
            "id": "medical-b",
            "name": "Bravo Medical",
            "availability": "assigned",
            "readiness_score": 99,
            "specialties": ["emergency triage", "first aid"],
            "constraints": ["already assigned"],
            "last_location_at": "2026-08-17T03:20:00+00:00",
            "location": {"latitude": 11.15, "longitude": 125.42},
            "personnel_ready": 2,
            "personnel_total": 4,
        },
    ]

    result = build_dispatch_recommendations(
        groups=groups,
        incident_id="sos-001",
        severity="critical",
        emergency_type="TRAPPED",
        latitude=11.1305,
        longitude=125.3970,
        required_specialties=[],
        max_results=5,
        source="postgis-engine",
        now=now,
    )

    assert result["source"] == "postgis-engine"
    assert result["engine_version"] == "dispatch-score-v1"
    assert result["incident"]["required_specialties"] == ["swiftwater rescue", "household extraction", "boat operations"]
    assert result["recommended_group_id"] == "rescue-a"
    assert result["recommendations"][0]["rank"] == 1
    assert result["recommendations"][0]["specialty_match"] == ["boat operations", "swiftwater rescue"]
    assert result["recommendations"][1]["eligibility"] == "constrained"
    assert result["recommendations"][1]["freshness_minutes"] == 40


def test_dispatch_recommendations_mark_offline_groups_ineligible() -> None:
    result = build_dispatch_recommendations(
        groups=[
            {
                "id": "offline-1",
                "name": "Offline Unit",
                "availability": "offline",
                "readiness_score": 100,
                "specialties": ["first aid"],
                "constraints": [],
                "last_location_at": "not-a-date",
                "location": {"latitude": 11.13, "longitude": 125.39},
            }
        ],
        incident_id="sos-002",
        severity="high",
        emergency_type="MEDICAL",
        latitude=11.13,
        longitude=125.39,
        required_specialties=["first aid"],
        max_results=1,
        source="postgis-engine",
    )

    recommendation = result["recommendations"][0]
    assert recommendation["eligibility"] == "ineligible"
    assert result["recommended_group_id"] is None
    assert recommendation["estimated_response_minutes"] is None
