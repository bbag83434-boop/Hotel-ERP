from app.core.config import Settings


def test_production_requires_real_jwt_secrets():
    s = Settings(ENVIRONMENT="production", JWT_ACCESS_SECRET="", JWT_REFRESH_SECRET="")
    assert s.security_ready is False


def test_production_accepts_non_default_jwt_secrets():
    s = Settings(ENVIRONMENT="production", JWT_ACCESS_SECRET="a" * 48, JWT_REFRESH_SECRET="b" * 48)
    assert s.security_ready is True
