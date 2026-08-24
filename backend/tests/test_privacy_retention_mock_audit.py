from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _login(role: str) -> dict[str, str]:
    response = client.post("/v1/auth/demo-login", json={"role": role, "display_name": f"Mock audit {role}"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_mock_privacy_audit_limits_readiness_and_service_health_to_non_sensitive_evidence() -> None:
    readiness = client.get("/v1/operations/readiness")
    service_health = client.get("/v1/operations/service-health")
    assert readiness.status_code == 200
    assert service_health.status_code == 200

    evidence = f"{readiness.json()} {service_health.json()}".lower()
    forbidden_fragments = ("auth_secret", "database_url", "api_key", "change-me", "dev-only-change-me")
    assert not any(fragment in evidence for fragment in forbidden_fragments)
    assert "does not authorize" in readiness.json()["decision_limit"].lower()
    assert "do not prove" in service_health.json()["migrations"]["decision_limit"].lower()


def test_mock_privacy_audit_scopes_audit_ledger_access_and_exposes_no_delete_routes() -> None:
    resident_audit = client.get("/v1/auth/audit", headers=_login("resident"))
    dispatcher_audit = client.get("/v1/auth/audit", headers=_login("dispatcher"))
    assert resident_audit.status_code == 403
    assert dispatcher_audit.status_code == 200

    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    methods = {method.lower() for path in openapi.json()["paths"].values() for method in path}
    assert "delete" not in methods
