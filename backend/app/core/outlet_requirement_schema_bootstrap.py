import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Outlet Requirement supply-routing schema bootstrap.
#
# PART 2 — Outlet Requirement:
#   * The Item Master carries a supply routing (`supplySource`) that tells the
#     system where each item is supplied from (e.g. CENTRAL_STORE,
#     DESSERT_KITCHEN, RAW_MATERIAL_SUPPLY, DAILY_OUTLET_SUPPLY).
#   * Purchase Request items snapshot `unit` and the auto-determined
#     `supplySource` at requirement-creation time so the requirement retains
#     them even if the Item Master routing changes later.
#
# This reuses the existing `purchase_requests` / `purchase_request_items`
# entities (no duplicate Purchase Request logic) and never touches stock.
# Idempotent; safe to re-run on every startup.
# ---------------------------------------------------------------------------


def ensure_outlet_requirement_schema() -> None:
    """Ensure Item Master supply routing + Outlet Requirement snapshots exist."""
    with engine.begin() as conn:
        try:
            conn.execute(text(
                'ALTER TABLE items ADD COLUMN IF NOT EXISTS "supplySource" VARCHAR(30) '
                "NOT NULL DEFAULT 'CENTRAL_STORE'"
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('items.supplySource migration skipped: %s', exc)

        try:
            conn.execute(text(
                'ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS "unit" VARCHAR(20) NULL'
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('purchase_request_items.unit migration skipped: %s', exc)

        try:
            conn.execute(text(
                'ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS "supplySource" VARCHAR(30) NULL'
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('purchase_request_items.supplySource migration skipped: %s', exc)

        try:
            # Backfill any existing requirement lines from the Item Master routing.
            conn.execute(text(
                'UPDATE purchase_request_items AS pri '
                "SET \"supplySource\" = COALESCE(it.\"supplySource\", 'CENTRAL_STORE') "
                'FROM items AS it '
                'WHERE pri."itemId" = it.id AND pri."supplySource" IS NULL'
            ))
            conn.execute(text(
                'CREATE INDEX IF NOT EXISTS ix_items_supplySource ON items ("supplySource")'
            ))
            conn.execute(text(
                'CREATE INDEX IF NOT EXISTS ix_purchase_request_items_supplySource '
                'ON purchase_request_items ("supplySource")'
            ))
        except Exception as exc:  # pragma: no cover
            logger.warning('outlet requirement supply backfill/index skipped: %s', exc)