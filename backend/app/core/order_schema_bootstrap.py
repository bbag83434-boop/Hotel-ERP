"""Small, idempotent compatibility migration for the order-channel additions.

Alembic remains the source of truth. This bootstrap only prevents an older deployed
schema from breaking the application before the normal migration job is run.
"""
from sqlalchemy import text
from app.core.database import engine


def ensure_order_columns() -> None:
    statements = [
        'ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS "source" VARCHAR(20) NOT NULL DEFAULT \'MANUAL\'',
        'ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS "externalOrderId" VARCHAR(100)',
        'ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS "customerName" VARCHAR(255)',
        'ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS "customerPhone" VARCHAR(50)',
        'CREATE INDEX IF NOT EXISTS ix_restaurant_orders_source ON restaurant_orders ("source")',
        'CREATE INDEX IF NOT EXISTS ix_restaurant_orders_externalOrderId ON restaurant_orders ("externalOrderId")',
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_orders_source_external ON restaurant_orders ("companyId", "source", "externalOrderId") WHERE "externalOrderId" IS NOT NULL',
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
