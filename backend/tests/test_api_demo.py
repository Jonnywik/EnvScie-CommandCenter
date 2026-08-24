from fastapi.testclient import TestClient

from datetime import datetime

from app.main import app
from app.api import routes
from app.services.responder_safety import build_responder_safety_assessment
from app.services.weather_feeds import parse_pagasa_visayas_forecast
from app.services import demo_data

client = TestClient(app)


def test_operations_readiness_exposes_non_sensitive_demo_release_blockers() -> None:
    response = client.get("/v1/operations/readiness")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "demo"
    assert payload["release_ready"] is False
    assert payload["checks"]["production_mode"] is False
    assert payload["checks"]["notification_provider"] is False
    assert any("training/demo mode" in blocker for blocker in payload["blockers"])
    assert "does not authorize" in payload["decision_limit"].lower()


def test_weather_endpoints_return_safe_snapshot_shapes(monkeypatch) -> None:
    async def fake_radar() -> dict:
        return {"frames": [{"time": 1710000000, "path": "/v2/radar/1710000000"}], "host": "https://tilecache.rainviewer.com", "fetched_at": "2026-08-20T00:00:00+00:00", "stale": False}

    async def fake_typhoon() -> dict:
        return {"active": True, "name": "TEST", "latitude": 11.2, "longitude": 125.4, "issued_at": "11:00 AM", "track": [{"latitude": 11.2, "longitude": 125.4}], "fetched_at": "2026-08-20T00:00:00+00:00", "stale": False, "source_url": "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin"}

    monkeypatch.setattr(routes, "get_radar_snapshot", fake_radar)
    monkeypatch.setattr(routes, "get_typhoon_snapshot", fake_typhoon)
    radar = client.get("/v1/weather/radar")
    typhoon = client.get("/v1/weather/typhoon")

    assert radar.status_code == 200
    assert radar.json()["frames"][0]["path"].startswith("/v2/radar/")
    assert radar.json()["stale"] is False
    assert typhoon.status_code == 200
    assert typhoon.json()["active"] is True
    assert typhoon.json()["track"][0]["longitude"] == 125.4


def test_map_overlay_endpoint_keeps_unapproved_provider_layers_disabled(monkeypatch) -> None:
    async def fake_overlays() -> dict:
        return {
            "fetched_at": "2026-08-23T00:00:00+00:00",
            "stale": False,
            "rainviewer_radar": {"frames": [], "host": None, "fetched_at": "2026-08-23T00:00:00+00:00", "stale": False},
            "typhoon": {"active": False, "name": None, "latitude": None, "longitude": None, "issued_at": None, "track": [], "fetched_at": "2026-08-23T00:00:00+00:00", "stale": False, "source_url": "https://example.test/pagasa"},
            "pagasa_radar": {"id": "pagasa-radar-qpe", "provider": "PAGASA", "freshness": "unavailable", "access_state": "pending_approval", "frames": []},
            "pagasa_stations": {"id": "pagasa-stations", "freshness": "unavailable", "access_state": "pending_approval", "stations": []},
            "pagasa_satellite": {"id": "pagasa-himawari-context", "freshness": "unavailable", "access_state": "pending_approval", "frame": None},
            "lightning": {"id": "licensed-lightning", "freshness": "unavailable", "access_state": "pending_procurement", "events": [], "history_minutes": 15},
            "decision_limit": "Map overlays provide operational context only.",
        }

    monkeypatch.setattr(routes, "get_map_overlays_snapshot", fake_overlays)
    response = client.get("/v1/weather/map-overlays")

    assert response.status_code == 200
    payload = response.json()
    assert payload["pagasa_radar"]["access_state"] == "pending_approval"
    assert payload["pagasa_stations"]["stations"] == []
    assert payload["pagasa_satellite"]["frame"] is None
    assert payload["lightning"]["access_state"] == "pending_procurement"
    assert payload["lightning"]["events"] == []
    assert "operational context" in payload["decision_limit"]


def test_project_noah_context_preserves_provenance_and_never_fabricates_facilities() -> None:
    context = client.get("/v1/gis/noah/context")

    assert context.status_code == 200
    payload = context.json()
    assert payload["provider"].startswith("Project NOAH")
    assert payload["license"] == "ODbL-1.0"
    assert {layer["id"] for layer in payload["layers"]} == {
        "noah-flood-100yr", "noah-landslide", "noah-storm-surge-scenarios",
    }
    assert all(layer["overlay_url"].startswith("/api/v1/gis/noah/overlays/") for layer in payload["layers"])
    assert "not a live hazard observation" in payload["decision_limit"].lower()
    assert payload["critical_facilities"]["status"] == "source_access_unconfirmed"
    assert "will not scrape or fabricate" in payload["critical_facilities"]["message"].lower()


def test_project_noah_overlay_endpoint_is_bounded_to_known_assets() -> None:
    overlay = client.get("/v1/gis/noah/overlays/noah-flood-100yr")
    missing = client.get("/v1/gis/noah/overlays/not-a-real-layer")

    assert overlay.status_code == 200
    assert overlay.headers["content-type"].startswith("image/png")
    assert overlay.content.startswith(b"\x89PNG")
    assert missing.status_code == 404


def test_official_balangiga_facility_registry_preserves_provenance_and_validation_boundary() -> None:
    response = client.get("/v1/gis/facilities/official-registry")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_status"] == "limited_official_coverage"
    assert {facility["name"] for facility in payload["facilities"]} == {
        "Albino M. Duran Memorial Hospital",
        "Balangiga Rural Health Unit",
    }
    assert all(facility["source_url"].startswith("https://") for facility in payload["facilities"])
    assert all(facility["coordinate_validation_status"] == "needs_lgu_verification" for facility in payload["facilities"])
    assert "do not confirm current staffing" in payload["decision_limit"].lower()


def test_lgu_facility_verification_records_reference_checks_without_readiness_claim() -> None:
    registry = client.get("/v1/gis/facilities/official-registry")
    assert registry.status_code == 200
    facility_id = registry.json()["facilities"][0]["id"]
    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Facility verifier"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    created = client.post(
        "/v1/gis/facilities/verifications",
        headers=headers,
        json={
            "facility_id": facility_id,
            "coordinate_confirmed": True,
            "contact_attempted": True,
            "reported_access": "reported_restricted",
            "verification_outcome": "follow_up_required",
            "source_document_reference": "Balangiga LGU facility focal-point call log, 24 Aug 2026",
            "revalidation_due_at": "2026-09-01T09:00:00Z",
            "verification_note": "LGU focal point contacted; pin cross-check completed and access follow-up remains required.",
        },
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["facility_id"] == facility_id
    assert payload["reported_access"] == "reported_restricted"
    assert payload["source_document_reference"].startswith("Balangiga LGU")
    assert payload["revalidation_due_at"] == "2026-09-01T09:00:00Z"
    assert "does not establish staffing" in payload["decision_limit"].lower()

    snapshot = client.get(f"/v1/gis/facilities/verifications?facility_id={facility_id}", headers=headers)
    assert snapshot.status_code == 200
    assert any(item["id"] == payload["id"] for item in snapshot.json()["records"])
    audit = client.get("/v1/auth/audit?limit=30", headers=headers)
    assert any(event["action"] == "facility.verification_recorded" for event in audit.json())


def test_map_source_health_exposes_provenance_without_operational_clearance_and_records_review() -> None:
    source_health = client.get("/v1/gis/source-health")

    assert source_health.status_code == 200
    records = source_health.json()
    noah = next(item for item in records if item["id"] == "project-noah-reference")
    facility = next(item for item in records if item["id"] == "official-facility-registry")
    assert noah["status"] == "reference_only"
    assert "does not confirm active hazards" in noah["decision_limit"].lower()
    assert facility["status"] == "reference_only"
    assert "verification is required" in facility["decision_limit"].lower()

    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Source health reviewer"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    review = client.post(
        "/v1/gis/source-health/review",
        headers=headers,
        json={"source_id": noah["id"], "review_note": "Reference date and decision limit reviewed."},
    )

    assert review.status_code == 200
    assert review.json()["review_required"] is True
    assert "route clearance" in review.json()["decision_limit"].lower()
    audit = client.get("/v1/auth/audit?limit=20", headers=headers)
    assert any(event["action"] == "gis.source_health_reviewed" for event in audit.json())


def test_provincial_weather_endpoint_returns_live_and_static_source_contract(monkeypatch) -> None:
    async def fake_provincial_weather() -> dict:
        return {
            "province": "Eastern Samar",
            "regional_office": "PAGASA Visayas",
            "weather_summary": "Partly cloudy skies with rainshowers or thunderstorm.",
            "issued_at": "05:00 AM, 20 August, 2026",
            "province_mentioned": False,
            "warnings": [{"id": "heavy-rainfall", "type": "heavy_rainfall", "statement": "No Heavy Rainfall Warning Issued.", "province_specific": False, "source_url": "https://www.pagasa.dost.gov.ph/regional-forecast/visprsd"}],
            "hazard_references": [{"id": "flood-risk", "title": "Flood-risk reference areas", "hazard": "flood", "coverage": "Eastern Samar province dataset", "model_scope": "Static Project NOAH flood-hazard reference", "classes": ["100-year return period"], "source_name": "Project NOAH Hazard Maps", "source_url": "https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps", "decision_limit": "Not a live flood extent."}],
            "source_links": [{"name": "PAGASA Visayas regional forecast", "url": "https://www.pagasa.dost.gov.ph/regional-forecast/visprsd", "kind": "live regional weather and warnings"}],
            "fetched_at": "2026-08-20T00:00:00+00:00",
            "stale": False,
        }

    monkeypatch.setattr(routes, "get_provincial_weather_snapshot", fake_provincial_weather)
    response = client.get("/v1/weather/provincial-situation")

    assert response.status_code == 200
    payload = response.json()
    assert payload["province"] == "Eastern Samar"
    assert payload["stale"] is False
    assert payload["hazard_references"][0]["hazard"] == "flood"
    assert "live flood extent" in payload["hazard_references"][0]["decision_limit"]


def test_dispatcher_can_request_review_only_high_flood_risk_assessment(monkeypatch) -> None:
    async def fake_assessment() -> dict:
        return {
            "assessment_id": "assessment-regression",
            "trigger": "operator_requested",
            "risk_level": "high",
            "review_required": True,
            "public_communication_sent": False,
            "evaluated_at": "2026-08-22T00:00:00+00:00",
            "province": "Eastern Samar",
            "source_freshness": {"fresh": True, "age_seconds": 12.0, "source_stale": False},
            "factors": [{"signal": "PAGASA heavy-rainfall statement", "status": "met", "detail": "Eastern Samar named."}],
            "warning": {"type": "heavy_rainfall", "province_specific": True},
            "hazard_context": [{"hazard": "flood", "model_scope": "static"}],
            "source_links": [],
            "decision_limits": ["Coordinator review is required."],
        }

    monkeypatch.setattr(routes, "evaluate_high_flood_risk", fake_assessment)
    resident_login = client.post("/v1/auth/demo-login", json={"role": "resident", "display_name": "Flood review resident"})
    assert resident_login.status_code == 200
    prohibited = client.post(
        "/v1/weather/flood-risk-assessment",
        headers={"Authorization": f"Bearer {resident_login.json()['access_token']}"},
    )
    assert prohibited.status_code == 403

    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Flood review dispatcher"})
    assert login.status_code == 200
    response = client.post(
        "/v1/weather/flood-risk-assessment",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["risk_level"] == "high"
    assert payload["review_required"] is True
    assert payload["public_communication_sent"] is False
    assert payload["hazard_context"][0]["hazard"] == "flood"


def test_pagasa_regional_parser_excludes_navigation_and_keeps_bounded_forecast_content() -> None:
    markup = """
    <nav>Daily Weather Forecast Weather Outlook Selected Tourist Areas Eastern Samar</nav>
    <div class="r-header"><span>Regional Forecast</span><span>Issued At: 05:00 AM, 20 August, 2026</span></div>
    <span class="description">Partly cloudy skies to at times cloudy with rainshowers or thunderstorm</span>
    <div id="rainfalls" class="tab-pane"><div>As of today, there is no Heavy Rainfall Warning Issued.</div></div>
    <div id="thunderstorms"><div>Thunderstorm Advisory No. 8 #VISPRSD<br />Issued at 02:04 PM 20 August 2026<br /><br />Moderate to Heavy rainshowers are expected over #Leyte.</div></div>
    """

    parsed = parse_pagasa_visayas_forecast(markup)

    assert parsed["weather_summary"] == "Partly cloudy skies to at times cloudy with rainshowers or thunderstorm"
    assert parsed["issued_at"] == "05:00 AM, 20 August, 2026"
    assert parsed["province_mentioned"] is False
    assert parsed["warnings"][0]["province_specific"] is False
    assert "Thunderstorm Advisory No. 8" in parsed["warnings"][1]["statement"]


def test_responder_safety_formula_is_explainable_and_preserves_hard_holds() -> None:
    assessment = build_responder_safety_assessment(
        incident={
            "id": "sos-risk-regression",
            "status": "acknowledged",
            "severity": "critical",
            "emergency_type": "TRAPPED",
            "barangay": "Barangay 4",
            "location": {"latitude": 11.1264, "longitude": 125.3892, "accuracy_meters": 150},
        },
        groups=[{
            "id": "group-risk-regression",
            "name": "Risk regression team",
            "call_sign": "RISK-1",
            "location": {"latitude": 11.19, "longitude": 125.45},
            "last_location_at": "2026-08-22T00:00:00+00:00",
            "last_check_in_at": "2026-08-22T00:00:00+00:00",
            "readiness_score": 48,
            "availability": "offline",
            "specialties": ["medical"],
            "equipment": [],
            "contact_channel": "offline",
            "constraints": ["flooding", "road blockage"],
        }],
        active_hazard_count=2,
        source="regression",
        now=datetime.fromisoformat("2026-08-22T01:00:00+00:00"),
    )

    candidate = assessment["assessments"][0]
    assert candidate["review_status"] == "hold"
    assert candidate["risk_band"] in {"high", "severe"}
    assert {factor["factor"] for factor in candidate["factors"]} == {
        "incident_hazard", "responder_exposure", "responder_vulnerability", "operational_controls", "route_uncertainty",
    }
    assert any("offline" in reason.lower() for reason in candidate["hold_reasons"])
    assert any("water-rescue" in reason.lower() for reason in candidate["hold_reasons"])
    assert assessment["automatic_dispatch_created"] is False
    assert assessment["route_cleared"] is False


def test_responder_safety_endpoint_requires_verified_sos_and_never_dispatches() -> None:
    created = client.post(
        "/v1/sos",
        json={
            "device_public_id": "responder-safety-regression",
            "emergency_type": "TRAPPED",
            "message": "Verified-SOS responder-safety test.",
            "latitude": 11.1264,
            "longitude": 125.3892,
            "accuracy_meters": 25,
            "client_occurred_at": "2026-08-22T10:20:00Z",
            "channel": "internet",
        },
    )
    assert created.status_code == 201
    sos_id = created.json()["id"]
    dispatcher_login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Responder safety dispatcher"})
    assert dispatcher_login.status_code == 200
    headers = {"Authorization": f"Bearer {dispatcher_login.json()['access_token']}"}

    unverified = client.post("/v1/sos/responder-safety-assessment", headers=headers, json={"sos_id": sos_id})
    assert unverified.status_code == 409

    acknowledged = client.patch(f"/v1/sos/{sos_id}/status", json={"status": "acknowledged", "note": "Verified for responder-safety review."})
    assert acknowledged.status_code == 200
    assessment = client.post("/v1/sos/responder-safety-assessment", headers=headers, json={"sos_id": sos_id})
    assert assessment.status_code == 200
    payload = assessment.json()
    assert payload["incident"]["id"] == sos_id
    assert payload["automatic_dispatch_created"] is False
    assert payload["route_cleared"] is False
    assert payload["command_center_tasks"]
    assert payload["assessments"]
    assert payload["assessments"][0]["field_execution_tasks"]

    resident_login = client.post("/v1/auth/demo-login", json={"role": "resident", "display_name": "Responder safety resident"})
    prohibited = client.post(
        "/v1/sos/responder-safety-assessment",
        headers={"Authorization": f"Bearer {resident_login.json()['access_token']}"},
        json={"sos_id": sos_id},
    )
    assert prohibited.status_code == 403


def test_demo_health_and_summary() -> None:
    health = client.get("/v1/health")
    summary = client.get("/v1/dashboard/summary")

    assert health.status_code == 200
    assert health.json()["mode"] == "demo"
    assert summary.status_code == 200
    assert summary.json()["metrics"]["open_centers"] >= 1


def test_demo_route_and_centers() -> None:
    centers = client.get("/v1/evacuation-centers")
    route = client.get("/v1/routes/safest-center?latitude=11.1264&longitude=125.3892")

    assert centers.status_code == 200
    assert len(centers.json()) >= 1
    assert route.status_code == 200
    assert route.json()["avoided_hazard_count"] == 2


def test_demo_sos_creation_and_triage() -> None:
    created = client.post(
        "/v1/sos",
        json={
            "device_public_id": "demo-device",
            "emergency_type": "TRAPPED",
            "message": "Water rising in the ground floor.",
            "latitude": 11.1264,
            "longitude": 125.3892,
            "accuracy_meters": 20,
            "client_occurred_at": "2026-08-12T10:20:00Z",
            "channel": "internet",
        },
    )

    assert created.status_code == 201
    sos_id = created.json()["id"]
    updated = client.patch(
        f"/v1/sos/{sos_id}/status",
        json={"status": "acknowledged", "note": "Dispatcher assigned coastal response team."},
    )

    assert updated.status_code == 200
    assert updated.json()["status"] == "acknowledged"


def test_coordinator_can_record_manual_emergency_and_it_enters_triage_queue() -> None:
    created = client.post(
        "/v1/sos/manual",
        json={
            "emergency_type": "MEDICAL",
            "severity": "warning",
            "summary": "Reported by radio: one adult needs urgent first aid near the public market.",
            "barangay": "Barangay 4",
            "latitude": 11.1264,
            "longitude": 125.3892,
            "accuracy_meters": 25,
            "reporter_name": "Market radio relay",
            "reporter_contact": "DRRM-1",
        },
    )

    assert created.status_code == 201
    assert created.json()["channel"] == "manual"
    summary = client.get("/v1/dashboard/summary")
    assert summary.status_code == 200
    incident = next(item for item in summary.json()["sos"] if item["id"] == created.json()["id"])
    assert incident["channel"] == "manual"
    assert incident["severity"] == "warning"
    assert incident["barangay"] == "Barangay 4"


def test_resident_cannot_record_manual_emergency() -> None:
    login = client.post("/v1/auth/demo-login", json={"role": "resident", "display_name": "Resident user"})
    assert login.status_code == 200
    response = client.post(
        "/v1/sos/manual",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        json={
            "emergency_type": "MEDICAL",
            "severity": "critical",
            "summary": "A caller reports immediate medical help is needed.",
            "barangay": "Barangay 1",
            "latitude": 11.1264,
            "longitude": 125.3892,
        },
    )
    assert response.status_code == 403


def test_demo_metrics_follow_sos_state_and_invalid_transition_is_rejected() -> None:
    before = client.get("/v1/dashboard/summary").json()["metrics"]["untriaged_sos"]
    created = client.post(
        "/v1/sos",
        json={
            "device_public_id": "metrics-test-device",
            "emergency_type": "TRAPPED",
            "message": "Metrics regression test.",
            "latitude": 11.1264,
            "longitude": 125.3892,
            "accuracy_meters": 10,
            "client_occurred_at": "2026-08-12T10:20:00Z",
            "channel": "internet",
        },
    )
    assert created.status_code == 201
    after_create = client.get("/v1/dashboard/summary").json()["metrics"]["untriaged_sos"]
    assert after_create == before + 1

    sos_id = created.json()["id"]
    acknowledged = client.patch(f"/v1/sos/{sos_id}/status", json={"status": "acknowledged"})
    assert acknowledged.status_code == 200
    after_ack = client.get("/v1/dashboard/summary").json()["metrics"]["untriaged_sos"]
    assert after_ack == before

    invalid = client.patch(
        "/v1/sos/3b9349bb-ef57-4fbb-b0b3-1f661d96f203/status",
        json={"status": "acknowledged"},
    )
    assert invalid.status_code == 409


def test_false_alarm_and_resolution_require_human_entered_reasons() -> None:
    created = client.post(
        "/v1/sos",
        json={
            "device_public_id": "closure-reason-regression",
            "emergency_type": "MEDICAL",
            "message": "Closure-reason regression report.",
            "latitude": 11.1264,
            "longitude": 125.3892,
            "accuracy_meters": 12,
            "client_occurred_at": "2026-08-12T10:20:00Z",
            "channel": "internet",
        },
    )
    assert created.status_code == 201
    sos_id = created.json()["id"]

    missing_false_alarm_reason = client.patch(f"/v1/sos/{sos_id}/status", json={"status": "false_alarm"})
    assert missing_false_alarm_reason.status_code == 422
    assert "human-entered reason" in missing_false_alarm_reason.json()["detail"]

    false_alarm = client.patch(f"/v1/sos/{sos_id}/status", json={"status": "false_alarm", "note": "Reporter confirmed this test signal was not an emergency."})
    assert false_alarm.status_code == 200
    assert false_alarm.json()["status"] == "false_alarm"

    resolution_created = client.post(
        "/v1/sos",
        json={
            "device_public_id": "resolution-reason-regression",
            "emergency_type": "MEDICAL",
            "message": "Resolution-reason regression report.",
            "latitude": 11.1264,
            "longitude": 125.3892,
            "accuracy_meters": 12,
            "client_occurred_at": "2026-08-12T10:20:00Z",
            "channel": "internet",
        },
    )
    assert resolution_created.status_code == 201
    resolution_sos_id = resolution_created.json()["id"]
    assert client.patch(f"/v1/sos/{resolution_sos_id}/status", json={"status": "acknowledged", "note": "Coordinator verified the report."}).status_code == 200
    demo_data.update_demo_sos_status(resolution_sos_id, "dispatched")

    missing_resolution_reason = client.patch(f"/v1/sos/{resolution_sos_id}/status", json={"status": "resolved"})
    assert missing_resolution_reason.status_code == 422
    resolved = client.patch(f"/v1/sos/{resolution_sos_id}/status", json={"status": "resolved", "note": "Coordinator recorded reported task completion for follow-up review."})
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"


def test_sos_verification_evidence_is_recorded_without_mutating_status() -> None:
    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Verification desk"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    sos_id = client.get("/v1/dashboard/summary").json()["sos"][0]["id"]
    original_status = client.get("/v1/dashboard/summary").json()["sos"][0]["status"]

    created = client.post(
        f"/v1/sos/{sos_id}/verification-records",
        headers=headers,
        json={
            "category": "barangay_contact",
            "source_role": "Barangay focal person",
            "contact_method": "radio relay",
            "note": "Focal person repeated the reported household location; conditions remain unverified.",
            "reference_number": "DRRM-VERIFY-001",
        },
    )
    assert created.status_code == 201
    assert created.json()["sos_id"] == sos_id
    assert created.json()["recorded_by_role"] == "dispatcher"
    assert "not proof of field safety" in created.json()["decision_limit"]

    snapshot = client.get(f"/v1/sos/{sos_id}/verification-records")
    assert snapshot.status_code == 200
    assert snapshot.json()["records"][0]["id"] == created.json()["id"]
    assert client.get("/v1/dashboard/summary").json()["sos"][0]["status"] == original_status


def test_demo_assignment_notifications_retry_acknowledge_and_audit() -> None:
    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Demo dispatcher"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    assigned = client.post(
        "/v1/response-groups/assign",
        headers=headers,
        json={
            "group_id": "group-delta",
            "target_type": "task",
            "target_id": "task-notification-regression",
            "assignment_note": "Confirm pier safety and report over DRRM-1.",
        },
    )
    assert assigned.status_code == 200
    assert assigned.json()["status"] == "pending_confirmation"

    snapshot = client.get("/v1/notifications", headers=headers)
    assert snapshot.status_code == 200
    assert not [item for item in snapshot.json()["notifications"] if item["target_id"] == "task-notification-regression"]

    confirmed = client.post(
        f"/v1/response-groups/assignments/{assigned.json()['assignment_id']}/transition",
        headers=headers,
        json={"action": "confirm", "operator_confirmed": True, "note": "Duty officer confirmed a dispatch record."},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"

    snapshot = client.get("/v1/notifications", headers=headers)
    assert snapshot.status_code == 200
    notifications = snapshot.json()["notifications"]
    assert len(notifications) >= 2
    sms = next(item for item in notifications if item["target_id"] == "task-notification-regression" and item["channel"] == "sms")
    in_app = next(item for item in notifications if item["target_id"] == "task-notification-regression" and item["channel"] == "in_app")
    assert sms["attempts"] == 1
    assert sms["status"] in {"delivered", "failed"}

    if sms["status"] == "failed":
        retried = client.post(f"/v1/notifications/{sms['id']}/retry", headers=headers)
        assert retried.status_code == 200
        assert retried.json()["attempts"] == 2

    acknowledged = client.post(
        f"/v1/notifications/{in_app['id']}/acknowledge",
        headers=headers,
        json={"note": "Receipt confirmed by the response unit."},
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["status"] == "acknowledged"

    audit = client.get("/v1/auth/audit?limit=100", headers=headers)
    assert audit.status_code == 200
    actions = {event["action"] for event in audit.json()}
    assert "dispatch.proposed" in actions
    assert "dispatch.confirmed" in actions
    assert "notification.queued" in actions
    assert "notification.acknowledged" in actions


def test_dispatch_lifecycle_requires_human_confirmation_and_keeps_unit_acknowledgement_distinct() -> None:
    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Lifecycle dispatcher"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    proposal = client.post(
        "/v1/response-groups/assign",
        headers=headers,
        json={"group_id": "group-charlie", "target_type": "task", "target_id": "lifecycle-regression", "assignment_note": "Review conditions before moving."},
    )
    assert proposal.status_code == 200
    assignment_id = proposal.json()["assignment_id"]
    assert proposal.json()["status"] == "pending_confirmation"

    blocked = client.post(
        f"/v1/response-groups/assignments/{assignment_id}/transition",
        headers=headers,
        json={"action": "confirm", "operator_confirmed": False},
    )
    assert blocked.status_code == 409

    confirmed = client.post(
        f"/v1/response-groups/assignments/{assignment_id}/transition",
        headers=headers,
        json={"action": "confirm", "operator_confirmed": True, "note": "Duty officer confirmed assignment."},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["acknowledged_at"] is None

    acknowledged = client.post(
        f"/v1/response-groups/assignments/{assignment_id}/transition",
        headers=headers,
        json={"action": "acknowledge", "note": "Unit reported acknowledgement over VHF."},
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["status"] == "acknowledged"
    assert acknowledged.json()["acknowledged_at"]

    lifecycle = client.get(f"/v1/response-groups/dispatch-lifecycle?target_id=lifecycle-regression", headers=headers)
    assert lifecycle.status_code == 200
    events = lifecycle.json()["assignments"][0]["events"]
    assert [event["to_status"] for event in events] == ["pending_confirmation", "confirmed", "acknowledged"]

    cancelled = client.post(
        f"/v1/response-groups/assignments/{assignment_id}/transition",
        headers=headers,
        json={"action": "cancel", "note": "Coordinator cancelled after reassessment."},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_dispatch_lifecycle_blocks_a_second_open_proposal_for_one_sos() -> None:
    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Duplicate-proposal regression dispatcher"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    target_id = "sos-one-open-proposal-regression"
    first = client.post(
        "/v1/response-groups/assign",
        headers=headers,
        json={"group_id": "group-charlie", "target_type": "sos_request", "target_id": target_id, "assignment_note": "First candidate pending human confirmation."},
    )
    assert first.status_code == 200
    assert first.json()["status"] == "pending_confirmation"

    duplicate = client.post(
        "/v1/response-groups/assign",
        headers=headers,
        json={"group_id": "group-echo", "target_type": "sos_request", "target_id": target_id, "assignment_note": "This competing candidate must be blocked."},
    )
    assert duplicate.status_code == 409
    assert "active dispatch proposal already exists" in duplicate.json()["detail"]

    lifecycle = client.get(f"/v1/response-groups/dispatch-lifecycle?target_id={target_id}", headers=headers)
    assert lifecycle.status_code == 200
    assert [assignment["assignment_id"] for assignment in lifecycle.json()["assignments"]] == [first.json()["assignment_id"]]

    cancelled = client.post(
        f"/v1/response-groups/assignments/{first.json()['assignment_id']}/transition",
        headers=headers,
        json={"action": "cancel", "note": "Regression cleanup after confirming one-open-proposal guard."},
    )
    assert cancelled.status_code == 200

    replacement = client.post(
        "/v1/response-groups/assign",
        headers=headers,
        json={"group_id": "group-echo", "target_type": "sos_request", "target_id": target_id, "assignment_note": "Replacement candidate after explicit cancellation."},
    )
    assert replacement.status_code == 200
    assert replacement.json()["status"] == "pending_confirmation"


def test_incident_command_record_requires_human_closure_follow_up_and_preserves_timeline() -> None:
    demo_data.DEMO_INCIDENTS.clear()
    demo_data.DEMO_INCIDENT_EVENTS.clear()
    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Incident coordinator"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    sos_id = client.get("/v1/dashboard/summary", headers=headers).json()["sos"][0]["id"]

    created = client.post(f"/v1/incidents/from-sos/{sos_id}", headers=headers, json={"follow_up_owner": "Barangay liaison", "follow_up_due_at": "2026-09-01T09:00:00Z"})
    assert created.status_code == 201
    incident = created.json()
    assert incident["linked_sos_ids"] == [sos_id]
    assert incident["status"] == "open"
    assert "does not verify field conditions" in incident["decision_limit"]

    blocked = client.post(f"/v1/incidents/{incident['id']}/transition", headers=headers, json={"action": "close", "note": "Coordinator reviewed the report."})
    assert blocked.status_code == 422

    closed = client.post(f"/v1/incidents/{incident['id']}/transition", headers=headers, json={"action": "close", "note": "Coordinator recorded remaining welfare follow-up.", "follow_up_owner": "Barangay liaison", "follow_up_due_at": "2026-09-02T09:00:00Z"})
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert [event["to_status"] for event in closed.json()["events"]] == ["open", "closed"]
