import asyncio
import time
from datetime import datetime, timezone
import httpx

BACKEND_URL = "http://127.0.0.1:8000"

async def send_sos(client: httpx.AsyncClient, index: int) -> dict:
    start_time = time.perf_counter()
    payload = {
        "device_public_id": f"stress-device-{index % 10}",
        "emergency_type": "flood" if index % 2 == 0 else "medical",
        "message": f"Stress test simultaneous SOS incident #{index + 1}",
        "latitude": 11.115 + (index * 0.0001),
        "longitude": 125.395 + (index * 0.0001),
        "accuracy_meters": 15.0,
        "client_occurred_at": datetime.now(timezone.utc).isoformat(),
        "channel": "sms"
    }
    try:
        response = await client.post(f"{BACKEND_URL}/v1/sos", json=payload, timeout=10.0)
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        return {
            "index": index + 1,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "success": response.status_code in (200, 201),
            "error": None if response.status_code in (200, 201) else response.text
        }
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        return {
            "index": index + 1,
            "status_code": 0,
            "duration_ms": duration_ms,
            "success": False,
            "error": str(exc)
        }

async def main() -> None:
    print("Starting simulated 100 simultaneous SOS requests stress test against Code for Resilience backend...")
    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=120, max_keepalive_connections=20)) as client:
        # Verify backend health first
        try:
            health = await client.get(f"{BACKEND_URL}/v1/health", timeout=5.0)
            print(f"Backend health status: {health.status_code} {health.json()}")
        except Exception as exc:
            print(f"ERROR: Backend health check failed: {exc}")
            return

        # Fetch baseline summary count
        base_summary = await client.get(f"{BACKEND_URL}/v1/dashboard/summary")
        base_untriaged = 0
        if base_summary.status_code == 200:
            base_untriaged = base_summary.json().get("metrics", {}).get("untriaged_sos", 0)

        total_requests = 100
        start_global = time.perf_counter()
        tasks = [send_sos(client, i) for i in range(total_requests)]
        results = await asyncio.gather(*tasks)
        total_duration = time.perf_counter() - start_global

    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]
    durations = sorted([r["duration_ms"] for r in results])

    p50 = durations[len(durations) // 2] if durations else 0
    p95 = durations[int(len(durations) * 0.95)] if durations else 0
    p99 = durations[int(len(durations) * 0.99)] if durations else 0
    avg_duration = sum(durations) / len(durations) if durations else 0
    throughput = total_requests / total_duration if total_duration > 0 else 0

    print("\n--- STRESS TEST RESULTS ---")
    print(f"Total Requests: {total_requests}")
    print(f"Successful Requests: {len(successes)}")
    print(f"Failed Requests: {len(failures)}")
    print(f"Total Duration: {total_duration:.3f} seconds")
    print(f"Throughput: {throughput:.2f} req/sec")
    print(f"Latency Avg: {avg_duration:.2f} ms")
    print(f"Latency P50: {p50:.2f} ms")
    print(f"Latency P95: {p95:.2f} ms")
    print(f"Latency P99: {p99:.2f} ms")

    if failures:
        print("\nFailures encountered:")
        for f in failures[:5]:
            print(f"  Request #{f['index']}: status={f['status_code']}, error={f['error']}")

    # Verify state consistency via dashboard summary
    async with httpx.AsyncClient() as client:
        summary = await client.get(f"{BACKEND_URL}/v1/dashboard/summary")
        if summary.status_code == 200:
            data = summary.json()
            new_untriaged = data.get("metrics", {}).get("untriaged_sos", 0)
            sos_list = data.get("sos", [])
            print(f"\nFinal dashboard untriaged SOS count: {new_untriaged} (baseline: {base_untriaged})")
            print(f"Total SOS items in summary queue: {len(sos_list)}")
        else:
            print(f"\nFailed to fetch dashboard summary: {summary.status_code}")

if __name__ == "__main__":
    asyncio.run(main())
