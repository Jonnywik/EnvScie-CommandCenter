from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_demo_login_returns_dispatcher_token():
    response = client.post(
        "/v1/auth/demo-login",
        json={"role": "dispatcher", "display_name": "Duty Officer"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "dispatcher"
    assert body["access_token"]


def test_me_is_available_without_token_in_demo_mode():
    response = client.get("/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["role"] == "dispatcher"


def test_audit_endpoint_exposes_demo_login_event():
    client.post("/v1/auth/demo-login", json={"role": "dispatcher"})
    response = client.get("/v1/auth/audit")
    assert response.status_code == 200
    assert response.json()[0]["action"] == "auth.demo_login"


def test_resident_token_cannot_read_audit_log():
    response = client.post("/v1/auth/demo-login", json={"role": "resident"})
    token = response.json()["access_token"]
    response = client.get(
        "/v1/auth/audit",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
