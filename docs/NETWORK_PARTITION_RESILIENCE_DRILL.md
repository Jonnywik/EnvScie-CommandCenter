# Local Network-Partition Resilience Drill

## Scope and safety boundary

This drill tested only the local loopback path between the hosted Next.js frontend and the FastAPI backend. A temporary local firewall rule rejected outbound TCP traffic to `127.0.0.1:8000`; the rule was removed automatically after the partition probe. The drill invoked only read-only health and readiness endpoints. It did not create or change SOS, incident, dispatch, notification, communication, resource, route, safety, or audit records.

## Drill results

| Stage | Probe | Observed result | Elapsed time |
| --- | --- | ---: | ---: |
| Baseline | Backend `GET /v1/health` | `200` | 11 ms |
| Baseline | Frontend proxy `GET /api/v1/operations/readiness` | `200` | 11 ms |
| Partition active | Frontend proxy readiness request | `500` | 16 ms |
| Partition active | Direct backend health request | Connection rejected (`000`) | 8 ms |
| Recovery | Backend `GET /v1/health` | `200` | 10 ms |
| Recovery | Frontend proxy readiness request | `200` | 12 ms |

The expected failure boundary was observed: during the local partition the frontend proxy could not reach the backend and produced an immediate server error instead of returning stale success data. After rule removal, both direct and proxied read-only probes recovered without restarting either service. The firewall inspection confirmed that no partition rule remained active; the Next.js and FastAPI processes remained running.

## Integrity evidence

The drill was confined to `GET /v1/health` and `GET /v1/operations/readiness`. It did not issue any mutation request. The restored readiness response remained in demo mode, with the pre-existing release blockers intact. No provider was enabled and no operational data was changed.

## Limitations

This is a useful **local service-path** resilience check, not a complete production disaster-recovery exercise. It does not validate browser offline caching, WebSocket reconnect behavior, database failover, provider callback retry, job scheduler recovery, mobile/SMS fallback, load shedding, regional network failure, backup restoration, or a real LGU production environment.

## Recommended next drills

1. Simulate a browser-to-frontend partition and verify the command-center loading/error state, recovery prompt, and no stale-current-data claim.
2. Simulate WebSocket interruption and reconnection while reading live snapshots; confirm subscription recovery does not duplicate state or actions.
3. In staging, simulate source-provider timeout/rate limit and verify source-specific stale/degraded state, retry bounds, and audit visibility.
4. With an approved non-production database, rehearse database unavailability, queued read recovery, backup restore, and migration rollback.
5. On real supported devices, test offline SOS queue/retry, SMS fallback, battery loss, intermittent signal, and recovery after reconnect.
