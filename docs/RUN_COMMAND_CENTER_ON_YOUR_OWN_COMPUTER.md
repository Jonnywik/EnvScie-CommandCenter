# Run the Code for Resilience Command Center on Your Own Computer

This guide explains how to run the **LGU Command Center dashboard** on your own Windows, macOS, or Linux computer. You do not need the Manus computer, a temporary cloud URL, or a Manus account.

> **Important operating boundary.** The easiest path below starts the project in its intentional **demo mode**. Demo mode is suitable for study, interface review, training, and controlled development. It is **not** a certified live emergency service. Do not use it to publish real public warnings, direct responders, collect real resident SOS records, or represent that emergency transport is active until the LGU governance, provider, security, privacy, field-validation, and drill requirements have been completed.

---

## 1. What You Will Run

| Component | What it does | Local address in demo mode |
|---|---|---|
| FastAPI backend | Provides dashboard data, demo alerts, SOS workflow APIs, routing, and realtime endpoints. | `http://127.0.0.1:8000` |
| Next.js Command Center | Provides the web dashboard that dispatchers and coordinators use in a browser. | `http://127.0.0.1:3000` |
| Optional PostGIS database | Required only when you move beyond demo mode and load validated GIS/operational data. | `127.0.0.1:5432` by default |

For the first run, start only the backend and dashboard. **Do not start PostGIS and do not set `DEMO_MODE=false`** unless you are intentionally completing the database and data-readiness work described later in this guide.

---

## 2. Install the Required Software

Install the following before cloning the project.

| Software | Why you need it | Check command |
|---|---|---|
| Git | Downloads and updates the project source. | `git --version` |
| Node.js with Corepack | Runs the Next.js dashboard and provides `pnpm`. Use the version supported by the project branch; the current project was validated with Node.js 22. | `node --version` and `corepack --version` |
| Python 3.11 or later | Runs the FastAPI backend. | `python3 --version` on macOS/Linux, or `py --version` on Windows |
| A modern browser | Opens the dashboard. | Chrome, Edge, Firefox, or Safari |
| Docker Desktop or Docker Engine (optional) | Runs local PostGIS only when you are ready for non-demo database work. | `docker --version` and `docker compose version` |

Download trusted installers from [Node.js](https://nodejs.org/), [Python](https://www.python.org/downloads/), [Git](https://git-scm.com/downloads), and [Docker](https://www.docker.com/products/docker-desktop/) as appropriate for your operating system.

> On Windows, use **Windows Terminal/PowerShell**. On macOS and Linux, use **Terminal**. Keep the backend and frontend running in separate terminal windows.

---

## 3. Download the Project

Open a terminal, choose a folder where you keep projects, then run:

```bash
git clone https://github.com/Jonnywik/EnvScie-CommandCenter.git
cd EnvScie-CommandCenter
```

Confirm that the main folders are present:

```bash
ls
```

You should see at least `backend`, `frontend`, `mobile`, `db`, `docs`, and `docker-compose.yml`.

To update your local copy later, stop all running project services first, then run:

```bash
git pull origin main
```

If Git reports local changes you want to keep, do **not** force an update. Commit or copy your work first.

---

# Part A — Recommended First Run: Local Demo Mode

## 4. Start the Backend

### 4.1 Create a Python virtual environment

From the project root, enter the backend folder.

```bash
cd backend
```

Run the command for your operating system.

| Operating system | Create virtual environment | Activate it |
|---|---|---|
| macOS / Linux | `python3 -m venv .venv` | `source .venv/bin/activate` |
| Windows PowerShell | `py -m venv .venv` | `.\.venv\Scripts\Activate.ps1` |
| Windows Command Prompt | `py -m venv .venv` | `.venv\Scripts\activate.bat` |

When activation succeeds, your terminal normally begins with `(.venv)`.

### 4.2 Install Python dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 4.3 Create your local development configuration

Create a file named `.env` from the included template.

| Operating system | Command |
|---|---|
| macOS / Linux | `cp .env.example .env` |
| Windows PowerShell | `Copy-Item .env.example .env` |
| Windows Command Prompt | `copy .env.example .env` |

For the recommended first run, leave the following values unchanged:

```text
ENVIRONMENT=development
DEMO_MODE=true
CORS_ORIGINS=http://localhost:3000
```

Do **not** place a real SMS, push-notification, or provider credential in this file for a demo run. The template uses intentionally non-live placeholder values.

### 4.4 Run the backend

In the same terminal, run:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Leave this terminal open. It is normal to see startup logs. The service is ready when it reports that Uvicorn is running on port 8000.

### 4.5 Verify backend health

Open a second terminal or use your browser and visit:

```text
http://127.0.0.1:8000/v1/health
```

You should receive a small JSON response confirming health. You can also test from a terminal:

```bash
curl http://127.0.0.1:8000/v1/health
```

If the command cannot connect, return to the backend terminal and read the first error shown there. Common fixes appear in Section 9.

---

## 5. Start the Command Center Dashboard

Open a **new** terminal. Do not stop the backend terminal.

### 5.1 Enter the frontend folder and enable pnpm

```bash
cd /path/to/EnvScie-CommandCenter/frontend
```

Replace `/path/to/EnvScie-CommandCenter` with the actual project location. For example, if you cloned into your home folder on macOS/Linux:

```bash
cd ~/EnvScie-CommandCenter/frontend
```

Then enable Corepack and install dashboard dependencies:

```bash
corepack enable
pnpm install
```

### 5.2 Start the development dashboard

Run:

```bash
API_PROXY_TARGET=http://127.0.0.1:8000 pnpm dev -- --port 3000
```

The dashboard’s `/api/...` requests are forwarded to the local FastAPI backend. The current configuration defaults to `http://127.0.0.1:8000`, but setting `API_PROXY_TARGET` explicitly makes the connection clear and avoids confusion if you later use another backend address.

On Windows PowerShell, run:

```powershell
$env:API_PROXY_TARGET="http://127.0.0.1:8000"; pnpm dev -- --port 3000
```

On Windows Command Prompt, run:

```bat
set API_PROXY_TARGET=http://127.0.0.1:8000 && pnpm dev -- --port 3000
```

### 5.3 Open the dashboard

Open this address in your own browser:

```text
http://127.0.0.1:3000
```

The Command Center should display its normal styled interface. It is not a Manus-only URL; it runs on your computer.

---

## 6. Verify That the Dashboard Is Connected

Use this short checklist after both terminals are running.

| Check | Expected result | If it fails |
|---|---|---|
| `http://127.0.0.1:8000/v1/health` | Backend returns JSON. | Fix backend startup first. |
| `http://127.0.0.1:3000` | Command Center loads with its tactical styling. | Check frontend terminal and Section 9. |
| Dashboard summary/cards | Demo information loads rather than a connection error. | Confirm backend is still on port 8000. |
| Command Map | Map/demo layers render without layout escape. | Refresh once; inspect browser console only if issue persists. |
| Live SOS / Incidents | Demo queue and training interactions appear. | Keep `DEMO_MODE=true`; do not enter real personal cases. |

Run automated checks whenever you pull changes or change code:

```bash
# From repository root, with backend virtual environment active
python -m pytest -q backend/tests

# In another terminal, from frontend
pnpm test
pnpm build
```

The backend test command uses synthetic/demo paths; it does not send a real SMS or push notification.

---

# Part B — Run a Production-Like Dashboard Process Locally

Use this when you want to test the optimized dashboard build on your own computer. This is still **not** a green light for live emergency use.

1. Stop the development dashboard with `Ctrl+C` in its frontend terminal.
2. From `frontend`, build the project with the correct backend target:

```bash
API_PROXY_TARGET=http://127.0.0.1:8000 pnpm build
API_PROXY_TARGET=http://127.0.0.1:8000 pnpm start -- -p 3000
```

On Windows PowerShell:

```powershell
$env:API_PROXY_TARGET="http://127.0.0.1:8000"; pnpm build
$env:API_PROXY_TARGET="http://127.0.0.1:8000"; pnpm start -- -p 3000
```

3. Open `http://127.0.0.1:3000` again.

> **Important:** Every time you run `pnpm build`, stop any older `pnpm start` process and start it again. An old Next.js production process can serve HTML that points to files replaced by a newer build, which can cause unstyled browser-default buttons or missing JavaScript/CSS assets.

---

# Part C — Optional: PostGIS Mode

Only follow this section after the LGU has validated municipal hazard zones, evacuation centers, road data, service accounts, authentication, and operating procedures. PostGIS mode is **not** needed to view or develop the demo dashboard.

## 7. Start Local PostGIS

### 7.1 Prepare production-style environment values

From the repository root, create `.env.production` from `.env.production.example`:

| Operating system | Command |
|---|---|
| macOS / Linux | `cp .env.production.example .env.production` |
| Windows PowerShell | `Copy-Item .env.production.example .env.production` |
| Windows Command Prompt | `copy .env.production.example .env.production` |

Edit `.env.production` with your own strong local database password and required configuration values. Do not commit this file. Do not reuse placeholder secrets in a real deployment.

### 7.2 Start only PostGIS for backend development

```bash
docker compose --env-file .env.production up -d postgis
docker compose --env-file .env.production ps
```

Wait until the `postgis` service is healthy, then set the backend `.env` values appropriately, including:

```text
DEMO_MODE=false
DATABASE_URL=postgresql+asyncpg://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5432/YOUR_DATABASE
```

The initial SQL scripts in `db/` initialize the database. Confirm all required migrations and approved data imports before using a non-demo backend. Do not load unverified hazards, evacuation centers, roads, hotline numbers, or resident data.

## 8. Optional Full-Stack Docker Run

The root `docker-compose.yml` can run PostGIS, the API, and the dashboard together. This is useful for a reproducible local environment, but it requires a fully completed `.env.production` and Docker.

```bash
docker compose --env-file .env.production up --build -d
docker compose --env-file .env.production ps
```

Then open:

```text
http://127.0.0.1:3000
```

View logs if a service does not become healthy:

```bash
docker compose --env-file .env.production logs -f api
docker compose --env-file .env.production logs -f web
```

Stop the stack:

```bash
docker compose --env-file .env.production down
```

Do not use the Docker path with real emergency operations until the production controls in `docs/PRODUCTION_DEPLOYMENT_INFRASTRUCTURE_PREREQUISITES.md`, the governance charter, and provider activation plan have been completed and formally approved.

---

# 9. Troubleshooting

| Symptom | Likely cause | Safe fix |
|---|---|---|
| `python` or `python3` not found | Python is not installed or not on the terminal path. | Install Python, close and reopen the terminal, then use `py` on Windows or `python3` on macOS/Linux. |
| `pnpm` not found | Corepack is disabled or Node.js is missing. | Run `corepack enable`; if it still fails, reinstall the supported Node.js version. |
| Port 8000 or 3000 is already in use | Another service is listening on that port. | Stop the old process, or intentionally use a different port and update the matching URL/`API_PROXY_TARGET`. |
| Dashboard loads but cards show API errors | FastAPI is stopped, on a different port, or proxy target is wrong. | Confirm `http://127.0.0.1:8000/v1/health`, then restart dashboard with the correct `API_PROXY_TARGET`. |
| Page appears unstyled with plain browser buttons | A stale `next start` process is running after a newer build. | Stop the old production dashboard with `Ctrl+C`, run `pnpm build`, then start a fresh `pnpm start -- -p 3000`. |
| Browser blocks API calls due to CORS | Dashboard origin differs from `CORS_ORIGINS`. | In local demo mode, use the documented `http://localhost:3000` origin, then restart FastAPI after changing `.env`. |
| Database connection error in non-demo mode | PostGIS is stopped, URL/password is incorrect, or schema/data work is incomplete. | Return to `DEMO_MODE=true` for UI work, or inspect `docker compose ... ps` and validate `.env.production`. |
| Docker Compose demands variables | Compose intentionally requires `.env.production` values. | Copy the template, set strong local values, and never commit real credentials. |
| Frontend install fails | Incorrect Node version or interrupted dependency download. | Verify `node --version`, delete only `frontend/node_modules` if needed, then rerun `pnpm install`. |

### Check which process uses a port

| Operating system | Port 3000 check |
|---|---|
| macOS / Linux | `lsof -nP -iTCP:3000 -sTCP:LISTEN` |
| Windows PowerShell | `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue` |
| Windows Command Prompt | `netstat -ano | findstr :3000` |

Only stop processes you recognize. On Windows, use the PID from `netstat` with `taskkill /PID <PID> /F` only after confirming it is the old dashboard process.

---

# 10. How to Stop Everything Safely

For the two-terminal demo setup, press **Ctrl+C** once in the frontend terminal and once in the backend terminal. Then deactivate the Python environment if desired:

```bash
deactivate
```

For Docker, use:

```bash
docker compose --env-file .env.production down
```

Stopping the local demo does not delete your project files. Docker volumes are retained unless you add destructive volume-removal flags; do not remove data volumes unless you intend to reset the local database.

---

# 11. Local Network and Public Internet Safety

The commands in this guide intentionally bind the backend to `127.0.0.1`, so it is visible only on your own computer. This is the safest default.

If you later need another device on the same office network to view a training demo, treat that as a separate controlled setup: bind only to a trusted LAN interface, set the exact allowed dashboard origin, use named accounts, and do not expose the ports directly to the public internet. A home router port-forward, public tunnel, or public IP should not be used for the Command Center until authentication, role control, HTTPS, secret management, data protection, monitoring, backups, incident response, provider approvals, and LGU operating authority are in place.

---

# 12. Before Any Live LGU Use

Running software locally proves only that the software can start. It does **not** prove the municipality is operationally ready. Before live use, complete the LGU charter/SOP adoption, named duty roster, barangay validation, real account ownership, data protection review, verified GIS/center/hotline data, monitored backup and recovery, real carrier/provider testing, staff training, supervised drills, and written go/no-go approval.

Useful project documents:

| Document | Use |
|---|---|
| `docs/PRODUCTION_DEPLOYMENT_INFRASTRUCTURE_PREREQUISITES.md` | Production environment and infrastructure gates. |
| `docs/BALANGIGA_COMMAND_CENTER_CHARTER_AND_SOPS_DRAFT.md` | Draft authority, alert, dispatch, audit, and privacy rules for legal/LGU review. |
| `docs/BALANGIGA_LIVE_NOTIFICATION_AND_SMS_GATEWAY_ACTIVATION_PLAN.md` | Staged plan for real APNs, FCM, and verified SMS gateway activation. |
| `docs/BALANGIGA_COMMAND_CENTER_ALERT_PUBLICATION_TRAINING_CURRICULUM.md` | Training program for dispatchers and barangay focal persons. |
| `docs/COMMAND_CENTER_NON_TECHNICAL_GUIDE.md` | Plain-language Command Center operator guide. |

## Quick Reference: The Simplest Safe Demo Run

```bash
# Terminal 1
cd EnvScie-CommandCenter/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2
cd EnvScie-CommandCenter/frontend
corepack enable
pnpm install
API_PROXY_TARGET=http://127.0.0.1:8000 pnpm dev -- --port 3000
```

Then visit **http://127.0.0.1:3000** in your own browser.
