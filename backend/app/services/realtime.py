from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class DashboardConnectionManager:
    """Single-process starter hub.

    Production deployment must replace this with Redis/NATS/Kafka pub-sub so events
    reach every API worker and survive worker restarts.
    """

    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, topic: str) -> None:
        await websocket.accept()
        self.connections[topic].add(websocket)

    def disconnect(self, websocket: WebSocket, topic: str) -> None:
        self.connections[topic].discard(websocket)

    def health_snapshot(self) -> dict[str, Any]:
        """Return process-local observability only; this does not prove cross-worker delivery."""
        return {
            "transport": "in_process",
            "multi_worker_durable": False,
            "topics": {topic: len(connections) for topic, connections in sorted(self.connections.items())},
            "decision_limit": "Counts are process-local websocket connections only. They do not prove event delivery across workers, provider availability, or responder acknowledgement.",
        }

    async def publish(self, topic: str, event: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for websocket in self.connections[topic]:
            try:
                await websocket.send_json(event)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(websocket, topic)


manager = DashboardConnectionManager()
