# Deployment Handoff — Release Candidate

## Release candidate status

The repository is packaged for a controlled three-service deployment: a public Next.js dashboard, an internal FastAPI service, and a PostGIS database. The dashboard proxies `/api/*` only to the internal API service. The database and API are not published as host ports by the supplied composition; only the web service exposes port `3000` for placement behind an approved TLS reverse proxy.

The release candidate is **deployable to a controlled staging environment**. It is not authorized for live disaster operations until the LGU completes the documented activation gates, including governed identity, database migration history, provider/source approval, privacy/retention policy, recovery evidence, and field-device exercises.

## Included deployment assets

| Asset | Purpose |
| --- | --- |
| `docker-compose.yml` | Connects PostGIS, FastAPI, and Next.js with health checks and internal service routing. |
| `backend/Dockerfile` | Packages FastAPI with the repository’s pinned Python dependencies and `PORT`-aware Uvicorn entrypoint. |
| `frontend/Dockerfile` | Builds and serves the Next.js dashboard with a configurable internal API proxy target. |
| `.env.production.example` | Lists the required non-secret configuration keys; blanks must be supplied by an approved secret manager. |
| `db/001`–`014` | Ordered SQL migration inventory for a fresh controlled database bootstrap or an LGU-approved staged migration plan. |
| `docs/PRODUCTION_RELEASE_GATE_RUNBOOK.md` | Governance and acceptance gates. |
| `docs/PRODUCTION_DEPLOYMENT_INFRASTRUCTURE_PREREQUISITES.md` | Ownership, evidence, infrastructure, and provider requirements. |

## Validation evidence

| Check | Result |
| --- | --- |
| Backend suite, including endpoint integration, observability, privacy, and deployment-asset checks | 49 tests passed. |
| Frontend unit suite | 18 tests passed. |
| Frontend type validation and optimized production build | Passed. |
| Mobile TypeScript validation | Passed. |
| Whitespace validation | Passed. |
| Local container build/compose execution | Not run because this environment has no Docker daemon/CLI. Static deployment-asset checks verify entrypoints, secret placeholders, internal API proxying, and non-exposed database/API service definitions. |

## Staging deployment procedure

1. Assign named owners for platform operations, database administration, DRRMO authority, communications, data stewardship, privacy, and field operations.
2. Provision a staging PostGIS database and a secret manager. Copy `.env.production.example` to an untracked deployment environment file, then populate secrets and the full database DSN through the secret manager. Never commit that file.
3. Review every migration against the staging database. For a new empty database, the composition mounts the ordered `db/` directory into Postgres initialization. For an existing database, use the approved migration ledger and staged migration procedure; do not rely on container initialization scripts.
4. Configure `CORS_ORIGINS` to the exact reviewed dashboard origin, `DEMO_MODE=false`, a non-default `AUTH_SECRET`, and a non-default `SMS_GATEWAY_SHARED_SECRET`. Keep provider/source values empty until the relevant contract and sandbox are approved.
5. Build and start the services on the controlled host using the host’s container platform. Place the `web` service behind the approved TLS reverse proxy and do not publish the `api` or `postgis` service to the public network.
6. Verify `/api/v1/health`, `/api/v1/operations/readiness`, and `/api/v1/operations/service-health` through the dashboard origin. Confirm the readiness endpoint remains blocked until all production evidence is genuinely configured.
7. Run the staging integration matrix, network-partition drill, provider sandbox tests, database restore drill, websocket reconnect test, and privacy/retention review. Record evidence in the LGU release gate.

## Activation guardrails

Do not treat a green container health check as authorization to dispatch a unit, clear a route, release a public warning, mark a facility ready, or infer field safety. The deployed system must retain its existing human-confirmation workflow and explicit decision limits. Do not activate SMS, push, voice, weather, radar, lightning, or external facility providers until the LGU has approved the provider contract, source authority, credential handling, and operational SOP.

## Production handoff decision

The platform team can proceed to **staging deployment preparation** once a controlled host and secret-management path are available. The LGU should approve production activation only after all Gate A–E evidence in the production runbook has been completed and signed by the responsible owners.
