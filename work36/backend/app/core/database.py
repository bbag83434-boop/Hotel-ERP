from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import Generator
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# SQLAlchemy 2.0 Engine
engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=not settings.is_production,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_database_connection() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        logger.info("✅ Connected to Neon PostgreSQL Database successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False
