import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Kitchen Orders schema bootstrap.
#
# Idempotently creates the `kitchen_orders` table used by the Outlet ->
# Central/Production Kitchen -> Dispatch -> Outlet Receiving flow. Safe to
# re-run on every startup.
# ---------------------------------------------------------------------------

CREATE_KITCHEN_ORDERS_TABLE = """
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id VARCHAR(36) PRIMARY KEY,
    "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    "branchId" VARCHAR(36) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    "itemId" VARCHAR(36) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    "orderNumber" VARCHAR(50) NOT NULL,
    "requestedQty" NUMERIC(14,4) NOT NULL,
    "dispatchedQty" NUMERIC(14,4) NOT NULL DEFAULT 0,
    "receivedQty" NUMERIC(14,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    "requiredDate" TIMESTAMP WITHOUT TIME ZONE,
    notes TEXT,
    "kitchenWarehouseId" VARCHAR(36) REFERENCES warehouses(id) ON DELETE SET NULL,
    "batchNumber" VARCHAR(100),
    "expiryDate" TIMESTAMP WITHOUT TIME ZONE,
    "dispatchedById" VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    "dispatchedAt" TIMESTAMP WITHOUT TIME ZONE,
    "dispatchNotes" TEXT,
    "receivedWarehouseId" VARCHAR(36) REFERENCES warehouses(id) ON DELETE SET NULL,
    "receivedById" VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    "receivedAt" TIMESTAMP WITHOUT TIME ZONE,
    "receiveNotes" TEXT,
    "cancelledById" VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    "cancelledAt" TIMESTAMP WITHOUT TIME ZONE,
    "cancelReason" VARCHAR(500),
    "createdById" VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_kitchen_order_company_num UNIQUE ("companyId", "orderNumber")
)
"""


def ensure_kitchen_order_schema() -> None:
    """Ensure the kitchen_orders table exists (idempotent)."""
    with engine.begin() as conn:
        try:
            conn.execute(text(CREATE_KITCHEN_ORDERS_TABLE))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_kitchen_orders_branch_status ON kitchen_orders ("branchId", status)'))
            conn.execute(text('CREATE INDEX IF NOT EXISTS ix_kitchen_orders_item ON kitchen_orders ("itemId")'))
        except Exception as exc:  # pragma: no cover
            logger.warning('kitchen_orders table bootstrap skipped: %s', exc)