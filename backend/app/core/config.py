import os
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
    JWT_ACCESS_SECRET: str = os.getenv("JWT_ACCESS_SECRET", "apex_erp_jwt_secret_dev_key_2026")
    JWT_REFRESH_SECRET: str = os.getenv("JWT_REFRESH_SECRET", "apex_erp_jwt_refresh_dev_key_2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

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
