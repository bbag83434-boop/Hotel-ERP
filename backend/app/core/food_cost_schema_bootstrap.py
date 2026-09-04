import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)


def ensure_food_cost_schema() -> None:
    """Idempotently create Food Cost tables if they do not exist.

    This runs at every backend startup. If the tables already exist (e.g.
    created via alembic), the ``CREATE TABLE IF NOT EXISTS`` statements are
    no-ops, making the function safe to re-run in production.
    """
    with engine.begin() as conn:
        # ---- food_cost_configs ----
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS "food_cost_configs" (
                "id" VARCHAR(36) NOT NULL,
                "companyId" VARCHAR(36) NOT NULL,
                "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
                "effectiveDate" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                "version" INTEGER NOT NULL DEFAULT 1,
                "createdById" VARCHAR(36) NULL,
                "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("id"),
                FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE,
                FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL
            )
        """))

        # ---- food_cost_cost_heads ----
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS "food_cost_cost_heads" (
                "id" VARCHAR(36) NOT NULL,
                "configId" VARCHAR(36) NOT NULL,
                "name" VARCHAR(100) NOT NULL,
                "description" VARCHAR(255) NULL,
                "percentage" NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
                "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
                "displayOrder" INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("id"),
                FOREIGN KEY ("configId") REFERENCES "food_cost_configs" ("id") ON DELETE CASCADE
            )
        """))

        # ---- food_cost_markup_options ----
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS "food_cost_markup_options" (
                "id" VARCHAR(36) NOT NULL,
                "configId" VARCHAR(36) NOT NULL,
                "percentage" NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
                "label" VARCHAR(20) NOT NULL,
                "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
                "displayOrder" INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("id"),
                FOREIGN KEY ("configId") REFERENCES "food_cost_configs" ("id") ON DELETE CASCADE,
                CONSTRAINT "uq_markup_config_pct" UNIQUE ("configId", "percentage")
            )
        """))

        # ---- food_cost_snapshots ----
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS "food_cost_snapshots" (
                "id" VARCHAR(36) NOT NULL,
                "companyId" VARCHAR(36) NOT NULL,
                "branchId" VARCHAR(36) NULL,
                "configId" VARCHAR(36) NULL,
                "calculationDate" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                "effectiveDate" TIMESTAMP WITHOUT TIME ZONE NULL,
                "ingredientCost" NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
                "managementCostTotal" NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
                "managementCostPercentage" NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
                "totalCost" NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
                "selectedMarkupPercentage" NUMERIC(10,4) NULL,
                "finalSellingCost" NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
                "ingredientLines" TEXT NOT NULL,
                "idempotencyKey" VARCHAR(255) NULL,
                "notes" VARCHAR(500) NULL,
                "createdById" VARCHAR(36) NULL,
                "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("id"),
                FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE,
                FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE SET NULL,
                FOREIGN KEY ("configId") REFERENCES "food_cost_configs" ("id") ON DELETE SET NULL,
                FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL,
                CONSTRAINT "uq_snapshot_idempotency" UNIQUE ("idempotencyKey")
            )
        """))

        # Indexes
        conn.execute(text('CREATE INDEX IF NOT EXISTS "idx_food_cost_config_company_active" ON "food_cost_configs" ("companyId", "isActive")'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS "idx_food_cost_config_company_version" ON "food_cost_configs" ("companyId", "version")'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS "idx_cost_head_config" ON "food_cost_cost_heads" ("configId")'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS "idx_markup_config_active" ON "food_cost_markup_options" ("configId", "isActive")'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS "idx_snapshot_company_date" ON "food_cost_snapshots" ("companyId", "calculationDate")'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS "idx_snapshot_idempotency" ON "food_cost_snapshots" ("idempotencyKey")'))

    logger.info("Food Cost schema bootstrap complete")
