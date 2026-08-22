from fastapi.testclient import TestClient

from datetime import datetime

from app.main import app
from app.api import routes
from app.services.responder_safety import build_responder_safety_assessment
from app.services.weather_feeds import parse_pagasa_visayas_forecast

client = TestClient(app)


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
    assert "notification.queued" in actions
    assert "notification.acknowledged" in actions
