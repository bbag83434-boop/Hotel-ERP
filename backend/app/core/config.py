import os
import secrets
from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "APEX Multi-Outlet Restaurant ERP"
    VERSION: str = "2.0.0-greenfield"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development"))
    PORT: int = int(os.getenv("PORT", 10000))
    
    # Neon PostgreSQL connection string
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # JWT Secrets
    JWT_ACCESS_SECRET: str = os.getenv("JWT_ACCESS_SECRET") or secrets.token_urlsafe(48)
    JWT_REFRESH_SECRET: str = os.getenv("JWT_REFRESH_SECRET") or secrets.token_urlsafe(48)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # AI Provider Abstraction (keys stay server-side; never expose to frontend)
    AI_DEFAULT_PROVIDER: str = os.getenv("AI_DEFAULT_PROVIDER", "openai")
    AI_PROVIDER_TIMEOUT_SECONDS: int = int(os.getenv("AI_PROVIDER_TIMEOUT_SECONDS", "45"))
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    GEMINI_BASE_URL: str = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
    ANTHROPIC_BASE_URL: str = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
    
    # Telegram Notifications (server-side only)
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_DEFAULT_CHAT_ID: str = os.getenv("TELEGRAM_DEFAULT_CHAT_ID", "")
    TELEGRAM_TIMEOUT_SECONDS: int = int(os.getenv("TELEGRAM_TIMEOUT_SECONDS", "15"))
    TELEGRAM_WEBHOOK_SECRET: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    TELEGRAM_WEBHOOK_PUBLIC_URL: str = os.getenv("TELEGRAM_WEBHOOK_PUBLIC_URL", "")
    TELEGRAM_ALLOWED_CHAT_IDS: str = os.getenv("TELEGRAM_ALLOWED_CHAT_IDS", "")

    # WhatsApp Business Cloud API (server-side only)
    WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
    WHATSAPP_APP_SECRET: str = os.getenv("WHATSAPP_APP_SECRET", "")
    WHATSAPP_WEBHOOK_PUBLIC_URL: str = os.getenv("WHATSAPP_WEBHOOK_PUBLIC_URL", "")
    WHATSAPP_GRAPH_API_VERSION: str = os.getenv("WHATSAPP_GRAPH_API_VERSION", "v23.0")
    WHATSAPP_TIMEOUT_SECONDS: int = int(os.getenv("WHATSAPP_TIMEOUT_SECONDS", "15"))

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def security_ready(self) -> bool:
        if not self.JWT_ACCESS_SECRET or not self.JWT_REFRESH_SECRET:
            return False
        if self.is_production and (self.JWT_ACCESS_SECRET.startswith("apex_erp_") or self.JWT_REFRESH_SECRET.startswith("apex_erp_")):
            return False
        return True

    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    class Config:
        case_sensitive = True
        extra = "allow"

settings = Settings()
