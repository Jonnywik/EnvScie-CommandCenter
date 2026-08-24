from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _headers() -> dict[str, str]:
    response = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Integration matrix"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_read_endpoint_integration_matrix_is_available_and_non_destructive() -> None:
    headers = _headers()
    summary = client.get("/v1/dashboard/summary")
    assert summary.status_code == 200
    sos = summary.json()["sos"]
    assert sos
    incident_id = sos[0]["id"]

    routes = [
        ("/v1/health", None),
        ("/v1/operations/readiness", None),
        ("/v1/operations/service-health", None),
        ("/v1/dashboard/operations", None),
        ("/v1/response-groups", None),
        ("/v1/response-groups/dispatch-lifecycle", None),
        ("/v1/incidents", None),
        ("/v1/notifications", headers),
        ("/v1/coordination/communications", headers),
        ("/v1/gis/map", None),
        ("/v1/gis/source-health", None),
        ("/v1/gis/noah/context", None),
        ("/v1/gis/facilities/official-registry", None),
        ("/v1/gis/facilities/verifications", headers),
        ("/v1/weather/radar", None),
        ("/v1/weather/typhoon", None),
        ("/v1/weather/map-overlays", None),
        ("/v1/weather/provincial-situation", None),
        ("/v1/alerts", None),
        ("/v1/evacuation-centers", None),
        ("/v1/admin/feeds/health", headers),
        ("/v1/sync/bootstrap", headers),
        ("/v1/auth/me", headers),
        ("/v1/auth/audit?limit=20", headers),
        (f"/v1/sos/{incident_id}/verification-records", headers),
        ("/v1/routes/safest-center?latitude=11.1342&longitude=125.3938", None),
    ]

    for path, route_headers in routes:
        response = client.get(path, headers=route_headers)
        assert response.status_code == 200, path

    readiness = client.get("/v1/operations/readiness").json()
    service_health = client.get("/v1/operations/service-health").json()
    assert readiness["mode"] == "demo"
    assert readiness["release_ready"] is False
    assert service_health["realtime"]["multi_worker_durable"] is False
    assert "001_init.sql" in service_health["migrations"]["known_files"]

    overlay = client.get("/v1/gis/noah/overlays/noah-flood-100yr")
    assert overlay.status_code == 200
    assert overlay.headers["content-type"].startswith("image/png")


def test_websocket_topics_connect_and_service_health_reports_process_local_counts() -> None:
    topic_paths = {
        "/v1/ws/lgu": "lgu:sos",
        "/v1/ws/gis": "lgu:gis",
        "/v1/ws/response-groups": "lgu:response_groups",
        "/v1/ws/coordination": "lgu:communications",
        "/v1/ws/notifications": "lgu:notifications",
    }

    for path, topic in topic_paths.items():
        with client.websocket_connect(path):
            snapshot = client.get("/v1/operations/service-health")
            assert snapshot.status_code == 200
            assert snapshot.json()["realtime"]["topics"].get(topic, 0) >= 1
