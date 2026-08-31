import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Project Setup Master Data schema bootstrap.
#
# Idempotently adds the active/inactive flag columns to the existing master
# tables (categories, units). Logged for every startup; safe to re-run.
# ---------------------------------------------------------------------------

def ensure_master_data_schema() -> None:
    """Ensure Project Setup master-data tables/columns exist (idempotent)."""
    with engine.begin() as conn:
        try:
            conn.execute(text(
                'ALTER TABLE categories ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE'
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('categories.isActive migration skipped: %s', exc)

        try:
            conn.execute(text(
                'ALTER TABLE units ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE'
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('units.isActive migration skipped: %s', exc)

        try:
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_categories_company_active ON categories ("companyId", "isActive")'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_units_company_active ON units ("companyId", "isActive")'))
        except Exception as exc:  # pragma: no cover
            logger.warning('master data index create skipped: %s', exc)