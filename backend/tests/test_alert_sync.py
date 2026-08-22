from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _alert(event_id: str = "test-alert-001", title: str = "Test flood warning") -> dict:
    body = f"{event_id}|{title}"
    return {
        "source_name": "Test feed",
        "source_event_id": event_id,
        "title": title,
        "body": "Move away from waterways and monitor verified LGU updates.",
        "severity": "warning",
        "hazard": "flood",
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        "source_url": "https://www.pagasa.dost.gov.ph/",
        "content_hash": sha256(body.encode()).hexdigest(),
        "raw_payload": {"fixture": True},
    }


def test_demo_alert_ingest_is_idempotent_by_source_event_id():
    payload = {"source_name": "Test feed", "items": [_alert()]}
    first = client.post("/v1/admin/alerts/ingest", json=payload)
    assert first.status_code == 200
    assert first.json()["items_inserted"] == 1

    second = client.post("/v1/admin/alerts/ingest", json=payload)
    assert second.status_code == 200
    assert second.json()["items_updated"] == 1


def test_feed_health_and_bootstrap_are_available():
    health = client.get("/v1/admin/feeds/health")
    assert health.status_code == 200
    assert any(item["source_name"] == "PAGASA" for item in health.json())

    bootstrap = client.get("/v1/sync/bootstrap")
    assert bootstrap.status_code == 200
    assert bootstrap.json()["cursor"]
    assert bootstrap.json()["alerts"]
    assert bootstrap.json()["centers"]


def test_alert_ingest_rejects_mixed_source_batch():
    payload = {
        "source_name": "Test feed",
        "items": [_alert("mixed-source", "Mixed source"), {**_alert("other-source", "Other source"), "source_name": "Other feed"}],
    }
    response = client.post("/v1/admin/alerts/ingest", json=payload)
    assert response.status_code == 422
