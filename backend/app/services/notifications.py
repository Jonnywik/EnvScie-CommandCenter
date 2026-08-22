import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.schemas.notifications import NotificationStatus
from app.services.demo_data import (
    DEMO_NOTIFICATIONS,
    acknowledge_demo_notification,
    create_demo_assignment_notification,
    retry_demo_notification,
)
from app.services.realtime import manager

settings = get_settings()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_dict(group: Any) -> dict:
    if hasattr(group, "model_dump"):
        return group.model_dump(mode="json")
    return dict(group)


def _demo_sms_succeeds(notification_id: str, attempts: int) -> bool:
    digest = hashlib.sha256(f"{notification_id}:{attempts}".encode()).hexdigest()
    return int(digest[:8], 16) % 10 != 0


def _demo_push_succeeds(notification_id: str, attempts: int) -> bool:
    digest = hashlib.sha256(f"push:{notification_id}:{attempts}".encode()).hexdigest()
    return int(digest[:8], 16) % 10 != 0


async def send_assignment_notification(
    group: Any,
    target_type: str,
    target_id: str,
    assignment_note: str | None,
    actor: Any,
    session: AsyncSession | None = None,
    assignment_id: str | None = None,
) -> list[dict]:
    """Queue SMS/push-compatible assignment notifications and publish delivery events."""
    group_dict = _as_dict(group)
    actor_id = str(getattr(actor, "id", "")) or None
    if settings.demo_mode:
        records = create_demo_assignment_notification(group_dict, target_type, target_id, assignment_note, actor_id)
        await manager.publish("lgu:notifications", {"event": "notification.queued", "notifications": records})
        await asyncio.sleep(max(0.0, settings.notification_demo_delay_seconds))
        now = _now().isoformat()
        for record in records:
            if record["channel"] == "in_app":
                continue
            succeeds = _demo_sms_succeeds(record["id"], record["attempts"]) if record["channel"] == "sms" else _demo_push_succeeds(record["id"], record["attempts"])
            if succeeds:
                record["status"] = "delivered"
                record["delivered_at"] = now
            else:
                record["status"] = "failed"
                record["last_error"] = f"Demo {record['channel']} gateway did not return a delivery receipt."
            await manager.publish("lgu:notifications", {"event": "notification.delivery_updated", "notification": record})
        return records

    if session is None:
        raise RuntimeError("database session is required in live notification mode")
    message = assignment_note or f"Assignment received for {target_type} {target_id}. Confirm receipt with Balangiga DRRM command."
    group_id = str(group_dict["id"])
    recipient_label = group_dict.get("call_sign") or group_dict.get("name") or group_id
    records: list[dict] = []
    for channel in ("sms", "push", "in_app"):
        created_at = _now()
        status: NotificationStatus = "delivered" if channel == "in_app" else "failed"
        last_error: str | None = None
        sent_at = created_at
        delivered_at = created_at if channel == "in_app" else None
        recipient_address = group_dict.get("notification_device") if channel == "push" else group_dict.get("notification_phone") or group_dict.get("contact_channel")
        if channel == "sms":
            status, last_error = await _deliver_sms(recipient_address, message)
            delivered_at = created_at if status == "delivered" else None
        elif channel == "push":
            status, last_error = await _deliver_push(recipient_address, message, target_type, target_id)
            delivered_at = created_at if status == "delivered" else None
        row = (await session.execute(text("""
            INSERT INTO cfr.assignment_notifications
                (assignment_id, group_id, target_type, target_id, channel, status, message,
                 recipient_label, recipient_address, created_at, sent_at, delivered_at, attempts, last_error, assignment_note, actor_user_id)
            VALUES (:assignment_id, :group_id, :target_type, :target_id, :channel, :status, :message,
                    :recipient_label, :recipient_address, :created_at, :sent_at, :delivered_at, 1, :last_error, :assignment_note, :actor_user_id)
            RETURNING id, group_id, target_type, target_id, channel, status, message, recipient_label, recipient_address,
                      created_at, sent_at, delivered_at, acknowledged_at, attempts, last_error, assignment_note, actor_user_id
        """), {
            "assignment_id": assignment_id, "group_id": group_id, "target_type": target_type, "target_id": target_id,
            "channel": channel, "status": status, "message": message, "recipient_label": recipient_label,
            "recipient_address": recipient_address, "created_at": created_at, "sent_at": sent_at,
            "delivered_at": delivered_at, "last_error": last_error, "assignment_note": assignment_note, "actor_user_id": actor_id,
        })).mappings().one()
        records.append(dict(row) | {"channels": ["sms", "push", "in_app"]})
    await session.commit()
    for record in records:
        await manager.publish("lgu:notifications", {"event": "notification.delivery_updated", "notification": record})
    return records


async def _deliver_sms(recipient_address: str | None, message: str) -> tuple[NotificationStatus, str | None]:
    if not settings.sms_provider_url:
        return "failed", "SMS_PROVIDER_URL is not configured for live delivery."
    payload = {"From": settings.sms_sender_id, "To": recipient_address or "", "Body": message}
    headers = {"Authorization": f"Bearer {settings.sms_provider_api_key}"} if settings.sms_provider_api_key else {}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(settings.sms_provider_url, data=payload, headers=headers)
            response.raise_for_status()
    except Exception as exc:  # provider errors must become an auditable delivery failure
        return "failed", str(exc)[:500]
    return "delivered", None


async def _deliver_push(recipient_address: str | None, message: str, target_type: str, target_id: str) -> tuple[NotificationStatus, str | None]:
    if not settings.push_provider_url:
        return "failed", "PUSH_PROVIDER_URL is not configured for live delivery."
    payload = {
        "to": recipient_address or "",
        "title": "Balangiga DRRM assignment",
        "body": message,
        "data": {"target_type": target_type, "target_id": target_id},
    }
    headers = {"Authorization": f"Bearer {settings.push_provider_api_key}"} if settings.push_provider_api_key else {}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(settings.push_provider_url, json=payload, headers=headers)
            response.raise_for_status()
    except Exception as exc:  # provider errors must become an auditable delivery failure
        return "failed", str(exc)[:500]
    return "delivered", None


async def retry_notification(
notification_id: str, session: AsyncSession | None, actor: Any) -> dict | None:
    actor_id = str(getattr(actor, "id", "")) or None
    if settings.demo_mode:
        record = retry_demo_notification(notification_id, actor_id)
        if record is None:
            return None
        await manager.publish("lgu:notifications", {"event": "notification.retry_started", "notification": record})
        await asyncio.sleep(0.25)
        succeeds = _demo_sms_succeeds(record["id"], record["attempts"]) if record["channel"] == "sms" else _demo_push_succeeds(record["id"], record["attempts"])
        if succeeds:
            record["status"] = "delivered"
            record["delivered_at"] = _now().isoformat()
        else:
            record["status"] = "failed"
            record["last_error"] = f"Demo {record['channel']} gateway did not return a delivery receipt."
        await manager.publish("lgu:notifications", {"event": "notification.delivery_updated", "notification": record})
        return record
    if session is None:
        raise RuntimeError("database session is required in live notification mode")
    row = (await session.execute(text("SELECT * FROM cfr.assignment_notifications WHERE id = :id FOR UPDATE"), {"id": notification_id})).mappings().first()
    if row is None:
        return None
    if row["status"] not in {"failed", "queued"}:
        return dict(row)
    if row["attempts"] >= settings.notification_retry_max:
        return dict(row)
    if row["channel"] == "push":
        status, error = await _deliver_push(row["recipient_address"], row["message"], row["target_type"], row["target_id"])
    else:
        status, error = await _deliver_sms(row["recipient_address"], row["message"])
    delivered_at = _now() if status == "delivered" else None
    updated = (await session.execute(text("""
        UPDATE cfr.assignment_notifications
        SET status = :status, attempts = attempts + 1, sent_at = now(), delivered_at = :delivered_at, last_error = :last_error
        WHERE id = :id
        RETURNING id, group_id, target_type, target_id, channel, status, message, recipient_label, recipient_address,
                  created_at, sent_at, delivered_at, acknowledged_at, attempts, last_error, assignment_note, actor_user_id
    """), {"id": notification_id, "status": status, "delivered_at": delivered_at, "last_error": error})).mappings().one()
    await session.commit()
    record = dict(updated) | {"channels": ["sms", "push", "in_app"]}
    await manager.publish("lgu:notifications", {"event": "notification.delivery_updated", "notification": record})
    return record
