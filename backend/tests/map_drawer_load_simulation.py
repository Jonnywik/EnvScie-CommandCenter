#!/usr/bin/env python3
"""Controlled read-only Command Map traffic simulation; intentionally excluded from pytest collection."""

import asyncio
import json
import statistics
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx

BASE_URL = "https://3100-i945ssem2o6y5z2f9ewj6-9f6b4420.sg1.manus.computer"
ENDPOINTS = {
    "gis_map": "/api/v1/gis/map",
    "weather_radar": "/api/v1/weather/radar",
    "weather_typhoon": "/api/v1/weather/typhoon",
}
CONCURRENCY = 24
ROUNDS = 5
TIMEOUT_SECONDS = 15
OUTPUT_PATH = Path(__file__).with_name("map_drawer_load_simulation_report.json")


def percentile(values: list[float], rank: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    return ordered[min(len(ordered) - 1, max(0, int((len(ordered) - 1) * rank)))]


def valid_shape(name: str, payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    if name == "gis_map":
        return all(key in payload for key in ("resources", "hazards", "centers", "sos", "center"))
    if name == "weather_radar":
        return all(key in payload for key in ("frames", "fetched_at", "stale"))
    if name == "weather_typhoon":
        return all(key in payload for key in ("active", "fetched_at", "stale"))
    return False


async def request_once(client: httpx.AsyncClient, name: str, path: str, sequence: int) -> dict:
    started = time.perf_counter()
    try:
        response = await client.get(path, timeout=TIMEOUT_SECONDS)
        elapsed = round((time.perf_counter() - started) * 1000, 2)
        payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else None
        return {
            "endpoint": name,
            "sequence": sequence,
            "status": response.status_code,
            "latency_ms": elapsed,
            "shape_valid": response.status_code == 200 and valid_shape(name, payload),
            "error": None if response.status_code == 200 else response.text[:240],
        }
    except Exception as exc:  # reports the observed failure without retrying or mutating state
        return {"endpoint": name, "sequence": sequence, "status": 0, "latency_ms": round((time.perf_counter() - started) * 1000, 2), "shape_valid": False, "error": repr(exc)}


async def main() -> None:
    limits = httpx.Limits(max_connections=CONCURRENCY + 8, max_keepalive_connections=CONCURRENCY)
    headers = {"X-EnvScie-Test": "read-only-map-drawer-simulation"}
    async with httpx.AsyncClient(base_url=BASE_URL, limits=limits, headers=headers, follow_redirects=True) as client:
        warmup = await asyncio.gather(*(request_once(client, name, path, -1) for name, path in ENDPOINTS.items()))
        if any(item["status"] != 200 or not item["shape_valid"] for item in warmup):
            raise SystemExit(f"Warm-up failed: {json.dumps(warmup)}")

        jobs: list[asyncio.Task] = []
        started = time.perf_counter()
        sequence = 0
        for _ in range(ROUNDS):
            for name, path in ENDPOINTS.items():
                for _ in range(CONCURRENCY):
                    jobs.append(asyncio.create_task(request_once(client, name, path, sequence)))
                    sequence += 1
        results = await asyncio.gather(*jobs)
        wall_ms = round((time.perf_counter() - started) * 1000, 2)

    by_endpoint: dict[str, dict] = {}
    for name in ENDPOINTS:
        items = [item for item in results if item["endpoint"] == name]
        latencies = [item["latency_ms"] for item in items]
        statuses = Counter(str(item["status"]) for item in items)
        successes = [item for item in items if item["status"] == 200 and item["shape_valid"]]
        by_endpoint[name] = {
            "requests": len(items),
            "valid_200_responses": len(successes),
            "status_counts": dict(statuses),
            "latency_ms": {
                "min": min(latencies),
                "mean": round(statistics.mean(latencies), 2),
                "p50": round(percentile(latencies, 0.50), 2),
                "p95": round(percentile(latencies, 0.95), 2),
                "p99": round(percentile(latencies, 0.99), 2),
                "max": max(latencies),
            },
        }

    report = {
        "test": "controlled_read_only_command_map_api_load",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "base_url": BASE_URL,
        "concurrency_per_endpoint_per_round": CONCURRENCY,
        "rounds": ROUNDS,
        "total_requests": len(results),
        "wall_time_ms": wall_ms,
        "throughput_rps": round(len(results) / (wall_ms / 1000), 2),
        "all_responses_valid": all(item["status"] == 200 and item["shape_valid"] for item in results),
        "by_endpoint": by_endpoint,
        "failures": [item for item in results if item["status"] != 200 or not item["shape_valid"]][:10],
        "safety_boundary": "This simulation only issues GET requests to existing map and weather endpoints. It creates no SOS, actions, notifications, assignments, dispatches, or audit mutations.",
    }
    OUTPUT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

# Operator-run harness. Example: python3 tests/map_drawer_load_simulation.py
