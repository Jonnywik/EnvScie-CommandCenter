import asyncio
import statistics
import time
from datetime import datetime, timezone

import httpx

BACKEND_URL = "http://127.0.0.1:8000"
TOTAL_REQUESTS = 100
BATCH_TAG = f"stress-dispatch-{int(time.time())}"


def percentile(values: list[float], percentile_rank: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int((len(ordered) - 1) * percentile_rank)))
    return ordered[index]


async def create_sos(client: httpx.AsyncClient, index: int) -> dict:
    started = time.perf_counter()
    payload = {
        "device_public_id": f"{BATCH_TAG}-device-{index}",
        "emergency_type": "flood" if index % 2 == 0 else "medical",
        "message": f"{BATCH_TAG} request {index}",
        "latitude": 11.115 + index * 0.00005,
        "longitude": 125.395 + index * 0.00005,
        "accuracy_meters": 15,
        "client_occurred_at": datetime.now(timezone.utc).isoformat(),
        "channel": "sms",
    }
    try:
        response = await client.post(f"{BACKEND_URL}/v1/sos", json=payload, timeout=10)
        return {
            "index": index,
            "id": response.json().get("id") if response.status_code == 201 else None,
            "status": response.status_code,
            "latency_ms": (time.perf_counter() - started) * 1000,
            "error": None if response.status_code == 201 else response.text,
        }
    except Exception as exc:
        return {
            "index": index,
            "id": None,
            "status": 0,
            "latency_ms": (time.perf_counter() - started) * 1000,
            "error": repr(exc),
        }


async def acknowledge_sos(client: httpx.AsyncClient, record: dict) -> dict:
    started = time.perf_counter()
    try:
        response = await client.patch(
            f"{BACKEND_URL}/v1/sos/{record['id']}/status",
            json={"status": "acknowledged", "note": f"{BATCH_TAG} dispatch latency benchmark"},
            timeout=10,
        )
        body = response.json() if response.content else {}
        return {
            "index": record["index"],
            "id": record["id"],
            "status": response.status_code,
            "result_status": body.get("status"),
            "latency_ms": (time.perf_counter() - started) * 1000,
            "error": None if response.status_code == 200 else response.text,
        }
    except Exception as exc:
        return {
            "index": record["index"],
            "id": record["id"],
            "status": 0,
            "result_status": None,
            "latency_ms": (time.perf_counter() - started) * 1000,
            "error": repr(exc),
        }


async def main() -> None:
    print(f"Batch: {BATCH_TAG}")
    limits = httpx.Limits(max_connections=TOTAL_REQUESTS + 20, max_keepalive_connections=20)
    async with httpx.AsyncClient(limits=limits) as client:
        health = await client.get(f"{BACKEND_URL}/v1/health", timeout=5)
        if health.status_code != 200:
            raise SystemExit(f"Backend health check failed: {health.status_code} {health.text}")

        ingest_started = time.perf_counter()
        ingest_results = await asyncio.gather(*(create_sos(client, index) for index in range(TOTAL_REQUESTS)))
        ingest_wall_ms = (time.perf_counter() - ingest_started) * 1000
        created = [item for item in ingest_results if item["status"] == 201 and item["id"]]

        dispatch_started = time.perf_counter()
        dispatch_results = await asyncio.gather(*(acknowledge_sos(client, item) for item in created))
        dispatch_wall_ms = (time.perf_counter() - dispatch_started) * 1000

        summary_response = await client.get(f"{BACKEND_URL}/v1/dashboard/summary", timeout=10)
        summary = summary_response.json() if summary_response.status_code == 200 else {}
        batch_items = [item for item in summary.get("sos", []) if BATCH_TAG in item.get("summary", "")]

    ingest_latencies = [item["latency_ms"] for item in ingest_results]
    dispatch_latencies = [item["latency_ms"] for item in dispatch_results]
    ingest_successes = [item for item in ingest_results if item["status"] == 201]
    dispatch_successes = [item for item in dispatch_results if item["status"] == 200 and item["result_status"] == "acknowledged"]
    batch_received = sum(item.get("status") == "received" for item in batch_items)
    batch_acknowledged = sum(item.get("status") == "acknowledged" for item in batch_items)

    print("\n--- 100-CONCURRENT SOS + DISPATCH RESULTS ---")
    print(f"Ingestion success: {len(ingest_successes)}/{TOTAL_REQUESTS}")
    print(f"Ingestion wall time: {ingest_wall_ms:.2f} ms")
    print(f"Ingestion throughput: {TOTAL_REQUESTS / (ingest_wall_ms / 1000):.2f} req/sec")
    print(f"Ingestion latency avg/p50/p95/p99: {statistics.mean(ingest_latencies):.2f}/{percentile(ingest_latencies, 0.50):.2f}/{percentile(ingest_latencies, 0.95):.2f}/{percentile(ingest_latencies, 0.99):.2f} ms")
    print(f"Dispatch acknowledgement success: {len(dispatch_successes)}/{len(created)}")
    print(f"Dispatch wall time: {dispatch_wall_ms:.2f} ms")
    print(f"Dispatch throughput: {len(created) / (dispatch_wall_ms / 1000):.2f} req/sec" if created else "Dispatch throughput: 0.00 req/sec")
    if dispatch_latencies:
        print(f"Dispatch latency avg/p50/p95/p99: {statistics.mean(dispatch_latencies):.2f}/{percentile(dispatch_latencies, 0.50):.2f}/{percentile(dispatch_latencies, 0.95):.2f}/{percentile(dispatch_latencies, 0.99):.2f} ms")
    print(f"Exact batch in final summary: {len(batch_items)}/{TOTAL_REQUESTS}")
    print(f"Exact batch final statuses: received={batch_received}, acknowledged={batch_acknowledged}")

    failures = [item for item in ingest_results + dispatch_results if item.get("error")]
    if failures:
        print("\nFirst failures:")
        for failure in failures[:5]:
            print(f"  index={failure['index']} status={failure['status']} error={failure['error']}")


if __name__ == "__main__":
    asyncio.run(main())

# This file is an operator-run benchmark, not a pytest test case.
# Run: python3 tests/stress_test_sos_dispatch.py
# It must not be included in the normal unit-test collection because it intentionally mutates demo state.
