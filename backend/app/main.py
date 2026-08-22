from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.alert_routes import router as alert_router
from app.api.auth_routes import router as auth_router
from app.api.routes import router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Resilient disaster-management API for Balangiga, Eastern Samar.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    # The sandbox browser can rewrite localhost to a temporary private or public
    # preview host. Keep this permissive matcher strictly demo-only; production
    # deployments must use the explicit CORS_ORIGINS allowlist above.
    allow_origin_regex=r"https?://.*" if settings.demo_mode else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(auth_router)
app.include_router(alert_router)
