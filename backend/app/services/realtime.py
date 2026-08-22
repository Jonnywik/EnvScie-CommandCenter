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
