import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_demo_defaults_remain_runnable():
    settings = Settings()
    assert settings.demo_mode is True


def test_non_demo_rejects_placeholder_secrets():
    with pytest.raises(ValidationError):
        Settings(demo_mode=False)


def test_production_rejects_wildcard_cors():
    with pytest.raises(ValidationError):
        Settings(
            demo_mode=False,
            environment="production",
            auth_secret="a-real-secret-with-enough-entropy",
            sms_gateway_shared_secret="another-real-secret-with-enough-entropy",
            cors_origins="*",
        )
