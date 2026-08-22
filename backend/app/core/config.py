import logging
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    app_name: str = "Code for Resilience API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://cfr:cfr@localhost:5432/cfr"
    sms_gateway_shared_secret: str = "change-me"
    sms_max_age_seconds: int = 24 * 60 * 60
    auth_secret: str = "dev-only-change-me"
    access_token_ttl_seconds: int = 8 * 60 * 60
    alert_feed_timeout_seconds: float = 8.0
    alert_stale_after_seconds: int = 15 * 60
    alert_feed_url: str | None = None
    alert_feed_source_name: str = "PAGASA"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    demo_mode: bool = True
    sms_provider_url: str | None = None
    sms_provider_api_key: str | None = None
    sms_sender_id: str = "BALANGIGA-DRRM"
    push_provider_url: str | None = None
    push_provider_api_key: str | None = None
    notification_retry_max: int = 3
    notification_demo_delay_seconds: float = 2.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_runtime_safety(self):
        if not self.demo_mode:
            if self.sms_provider_url is None and self.push_provider_url is None:
                logger.warning("No SMS_PROVIDER_URL or PUSH_PROVIDER_URL configured; assignment notifications will be recorded as failed until a provider is configured.")
            if self.sms_gateway_shared_secret in {"", "change-me"}:
                raise ValueError("SMS_GATEWAY_SHARED_SECRET must be configured when DEMO_MODE=false")
            if self.auth_secret in {"", "dev-only-change-me"}:
                raise ValueError("AUTH_SECRET must be configured when DEMO_MODE=false")
            if self.environment.lower() == "production" and self.cors_origins.strip() == "*":
                raise ValueError("CORS_ORIGINS cannot be wildcard in production")
            if self.notification_retry_max < 1 or self.notification_retry_max > 10:
                raise ValueError("NOTIFICATION_RETRY_MAX must be between 1 and 10")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
