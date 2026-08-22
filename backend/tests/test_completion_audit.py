from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.services import demo_data

client = TestClient(app)


def _auth_headers() -> dict[str, str]:
    login = client.post("/v1/auth/demo-login", json={"role": "dispatcher", "display_name": "Completion auditor"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def test_completion_audit_actions_mutate_demo_snapshots() -> None:
    headers = _auth_headers()

    feed_before = client.get("/v1/admin/feeds/health").json()
    assert feed_before
    feed_action = client.post(
        "/v1/dashboard/operations/actions",
        headers=headers,
        json={
            "action": "feed.health_checked",
            "resource_type": "feed_source",
            "resource_id": "PAGASA",
            "note": "Verified source health during completion audit.",
        },
    )
    assert feed_action.status_code == 200
    assert feed_action.json()["mutated"] is True
    feed_after = client.get("/v1/admin/feeds/health").json()
    pagasa = next(item for item in feed_after if item["source_name"] == "PAGASA")
    assert pagasa["last_checked_at"]
    assert _parse_iso(pagasa["last_checked_at"]) >= _parse_iso(pagasa["last_success_at"])

    sync_action = client.post(
        "/v1/dashboard/operations/actions",
        headers=headers,
        json={"action": "feeds.sync_requested", "resource_type": "feed_source"},
    )
    assert sync_action.status_code == 200
    assert sync_action.json()["mutated"] is True

    groups_before = client.get("/v1/response-groups").json()["groups"]
    group_before = next(item for item in groups_before if item["id"] == "group-delta")
    check_in = client.post(
        "/v1/dashboard/operations/actions",
        headers=headers,
        json={
            "action": "response_group.checked_in",
            "resource_type": "response_group",
            "resource_id": "group-delta",
        },
    )
    assert check_in.status_code == 200
    assert check_in.json()["mutated"] is True
    group_after = next(item for item in client.get("/v1/response-groups").json()["groups"] if item["id"] == "group-delta")
    assert _parse_iso(group_after["last_check_in_at"]) >= _parse_iso(group_before["last_check_in_at"])
    assert _parse_iso(group_after["last_location_at"]) >= _parse_iso(group_before["last_location_at"])

    center_id = client.get("/v1/evacuation-centers").json()[0]["id"]
    center_action = client.post(
        "/v1/dashboard/operations/actions",
        headers=headers,
        json={
            "action": "centers.capacity_reviewed",
            "resource_type": "evacuation_center",
            "resource_id": center_id,
            "note": "Capacity and intake conditions reviewed.",
        },
    )
    assert center_action.status_code == 200
    assert center_action.json()["mutated"] is True
    center = next(item for item in client.get("/v1/evacuation-centers").json() if item["id"] == center_id)
    assert center["last_action"] == "centers.capacity_reviewed"
    assert center["capacity_verified_at"]

    audit = client.get("/v1/auth/audit?limit=100", headers=headers)
    assert audit.status_code == 200
    actions = {event["action"] for event in audit.json()}
    assert {"feed.health_checked", "feeds.sync_requested", "response_group.checked_in", "centers.capacity_reviewed"}.issubset(actions)


def test_assignment_notification_has_push_channel_and_retry_contract() -> None:
    headers = _auth_headers()
    target_id = "completion-audit-push"
    assigned = client.post(
        "/v1/response-groups/assign",
        headers=headers,
        json={
            "group_id": "group-echo",
            "target_type": "task",
            "target_id": target_id,
            "assignment_note": "Push parity regression test.",
        },
    )
    assert assigned.status_code == 200

    snapshot = client.get("/v1/notifications", headers=headers)
    assert snapshot.status_code == 200
    records = [item for item in snapshot.json()["notifications"] if item["target_id"] == target_id]
    assert {item["channel"] for item in records} == {"sms", "push", "in_app"}
    push = next(item for item in records if item["channel"] == "push")
    assert push["channels"] == ["sms", "push", "in_app"]
    assert push["status"] in {"delivered", "failed"}

    if push["status"] == "failed":
        retried = client.post(f"/v1/notifications/{push['id']}/retry", headers=headers)
        assert retried.status_code == 200
        assert retried.json()["attempts"] == 2


def test_feed_poll_refreshes_demo_sources_and_dispatch_rejects_stale_check_in() -> None:
    headers = _auth_headers()
    poll = client.post("/v1/admin/feeds/poll", headers=headers)
    assert poll.status_code == 200
    assert poll.json()["status"] == "succeeded"
    assert all(item["stale"] is False for item in client.get("/v1/admin/feeds/health").json())

    group = next(item for item in demo_data.DEMO_RESPONSE_GROUPS if item["id"] == "group-charlie")
    original_check_in = group["last_check_in_at"]
    try:
        group["last_check_in_at"] = (datetime.now(timezone.utc) - timedelta(minutes=16)).isoformat()
        blocked = client.post(
            "/v1/response-groups/assign",
            headers=headers,
            json={
                "group_id": "group-charlie",
                "target_type": "task",
                "target_id": "stale-check-in-regression",
                "assignment_note": "Must not deploy without a current roster check.",
            },
        )
        assert blocked.status_code == 409
        assert "check-in is stale" in blocked.json()["detail"]
    finally:
        group["last_check_in_at"] = original_check_in
