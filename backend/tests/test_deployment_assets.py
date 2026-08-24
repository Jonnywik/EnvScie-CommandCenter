from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_deployment_assets_keep_secrets_external_and_services_internal() -> None:
    compose = (ROOT / "docker-compose.yml").read_text()
    env_template = (ROOT / ".env.production.example").read_text()
    backend_dockerfile = (ROOT / "backend" / "Dockerfile").read_text()
    frontend_dockerfile = (ROOT / "frontend" / "Dockerfile").read_text()
    next_config = (ROOT / "frontend" / "next.config.js").read_text()

    assert "./db:/docker-entrypoint-initdb.d:ro" in compose
    assert '"3000:3000"' in compose
    assert '"5432:5432"' not in compose
    assert "api:" in compose and "web:" in compose
    assert "AUTH_SECRET: ${AUTH_SECRET:?" in compose
    assert "SMS_GATEWAY_SHARED_SECRET: ${SMS_GATEWAY_SHARED_SECRET:?" in compose
    assert "DEMO_MODE: ${DEMO_MODE:?" in compose

    assert "DEMO_MODE=false" in env_template
    assert "DATABASE_URL=" in env_template
    assert "AUTH_SECRET=" in env_template
    assert "SMS_GATEWAY_SHARED_SECRET=" in env_template
    assert "API_PROXY_TARGET=http://api:8000" in env_template
    assert "deployment-validation" not in env_template

    assert "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}" in backend_dockerfile
    assert "pnpm start -p ${PORT:-3000}" in frontend_dockerfile
    assert "API_PROXY_TARGET" in frontend_dockerfile
    assert "const apiProxyTarget = process.env.API_PROXY_TARGET" in next_config
