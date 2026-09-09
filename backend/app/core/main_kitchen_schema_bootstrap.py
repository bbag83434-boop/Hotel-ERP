import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Main Kitchen Requisition schema bootstrap.
#
# The Main Kitchen stage-1 workflow reuses the existing `purchase_requests`
# entity (the canonical requisition table) for internal outlet -> Main Kitchen
# demands. This bootstrap idempotently adds the classification column that lets
# the same table carry both supplier "PURCHASE" indents and "MAIN_KITCHEN"
# demands without creating any duplicate requisition table or item records.
# Safe to re-run on every startup.
# ---------------------------------------------------------------------------


def ensure_main_kitchen_schema() -> None:
    """Ensure purchase_requests carries the requisitionType column (idempotent)."""
    with engine.begin() as conn:
        try:
            conn.execute(text(
                'ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "requisitionType" VARCHAR(30) NOT NULL DEFAULT \'PURCHASE\''
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('purchase_requests.requisitionType migration skipped: %s', exc)

        try:
            conn.execute(text(
                'CREATE INDEX IF NOT EXISTS ix_purchase_requests_company_type ON purchase_requests ("companyId", "requisitionType")'
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('purchase_requests type index create skipped: %s', exc)