# Code for Resilience SOS Stress-Test Report

## Test scope

A controlled benchmark issued **100 simultaneous SOS creations** against the demo-mode FastAPI backend and then issued **100 simultaneous acknowledgement/dispatch state transitions** for the exact created batch. The test used valid `POST /v1/sos` payloads and the supported `PATCH /v1/sos/{id}/status` transition. This measures API ingestion and command-center acknowledgement latency; it does **not** measure physical responder travel time, SMS carrier delay, or external push-provider delivery time.

## Results

| Metric | Result |
|---|---:|
| SOS requests | 100 |
| SOS ingestion success | 100/100 (100%) |
| Ingestion wall time | 160.52 ms |
| Ingestion throughput | 622.97 requests/sec |
| Ingestion latency average | 84.02 ms |
| Ingestion latency p50 | 79.73 ms |
| Ingestion latency p95 | 143.86 ms |
| Ingestion latency p99 | 150.92 ms |
| Dispatch acknowledgements | 100/100 (100%) |
| Dispatch wall time | 190.61 ms |
| Dispatch throughput | 524.63 transitions/sec |
| Dispatch latency average | 101.84 ms |
| Dispatch latency p50 | 97.53 ms |
| Dispatch latency p95 | 164.97 ms |
| Dispatch latency p99 | 171.14 ms |
| Exact test batch in final summary | 100/100 |
| Final batch statuses | 0 received, 100 acknowledged |

## Interpretation

The demo backend handled the 100-request burst without HTTP failures, request timeouts, or partial state transitions. The p99 API-level acknowledgement latency remained below 200 ms in this sandbox run, and the final dashboard summary contained every test incident with the expected terminal acknowledgement state.

The test demonstrates that the current in-memory demo path is not the throughput bottleneck at this load level. A production capacity claim should not be inferred from this result because live mode introduces database write contention, audit persistence, notification delivery, connection-pool limits, reverse-proxy behavior, and external provider latency.

## Cleanup and follow-up

The FastAPI demo process was restarted after the test. The synthetic batch was absent from the fresh summary, and the clean demo snapshot returned `untriaged_sos: 1`, confirming that the benchmark did not leave load-test incidents in the running demo state.

For production qualification, repeat the benchmark against a staging database with realistic authentication, audit writes, notification fan-out, WebSocket subscribers, and a rate-limited load generator. Add a separate provider-latency benchmark for SMS and push delivery because those timings are not represented by this API transition test.
