import os
import sys
from sqlalchemy import text
from app.core.database import engine

def migrate_part3():
    print("Running Part 3 Stock, Recipes & Ledger DDL Migration against Neon PostgreSQL...")
    with engine.begin() as conn:
        # 1. Update recipes table
        conn.execute(text("""
            ALTER TABLE recipes 
                ADD COLUMN IF NOT EXISTS version INT DEFAULT 1 NOT NULL,
                ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
                ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP WITHOUT TIME ZONE,
                ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN DEFAULT TRUE NOT NULL;
        """))
        conn.execute(text("""
            ALTER TABLE recipes DROP CONSTRAINT IF EXISTS "recipes_companyId_code_key";
            DROP INDEX IF EXISTS "recipes_companyId_code_key";
            CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_company_code_version ON recipes ("companyId", code, version);
            CREATE INDEX IF NOT EXISTS idx_recipe_version_effective ON recipes ("companyId", "finishedItemId", "isCurrent", "effectiveDate");
        """))
        
        # 2. Update recipe_items table
        conn.execute(text("""
            ALTER TABLE recipe_items 
                ADD COLUMN IF NOT EXISTS "grossQuantity" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
                ADD COLUMN IF NOT EXISTS "usableYield" NUMERIC(6, 2) DEFAULT 100.00 NOT NULL,
                ADD COLUMN IF NOT EXISTS "wastePercentage" NUMERIC(6, 2) DEFAULT 0.00 NOT NULL;
        """))

        # 3. Update stock_ledgers table
        conn.execute(text("""
            ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'REVERSAL';
        """))
        conn.execute(text("""
            ALTER TABLE stock_ledgers 
                ADD COLUMN IF NOT EXISTS "companyId" VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(36) REFERENCES branches(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS "unitId" VARCHAR(36) REFERENCES units(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS "reversalReferenceId" VARCHAR(36),
                ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "isEmergencyOverride" BOOLEAN DEFAULT FALSE NOT NULL;
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_stock_ledger_comp_branch ON stock_ledgers ("companyId", "branchId");
            CREATE INDEX IF NOT EXISTS idx_stock_ledger_reversal ON stock_ledgers ("reversalReferenceId");
            CREATE INDEX IF NOT EXISTS idx_stock_ledger_idempotency ON stock_ledgers ("idempotencyKey");
        """))

        # 4. Ensure stock_counts table exists for physical inventory audit & reconciliation
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS stock_counts (
                id VARCHAR(36) PRIMARY KEY,
                "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                "branchId" VARCHAR(36) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                "warehouseId" VARCHAR(36) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
                "countNumber" VARCHAR(50) NOT NULL,
                "countDate" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
                status VARCHAR(50) DEFAULT 'IN_PROGRESS' NOT NULL,
                "totalSystemValuation" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
                "totalPhysicalValuation" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
                "totalVarianceValuation" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
                "countedById" VARCHAR(36) REFERENCES users(id),
                "approvedById" VARCHAR(36) REFERENCES users(id),
                "approvedAt" TIMESTAMP WITHOUT TIME ZONE,
                notes TEXT,
                "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
                "updatedAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stock_count_items (
                id VARCHAR(36) PRIMARY KEY,
                "stockCountId" VARCHAR(36) NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
                "itemId" VARCHAR(36) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                "systemQty" NUMERIC(14, 4) NOT NULL,
                "countedQty" NUMERIC(14, 4) NOT NULL,
                "varianceQty" NUMERIC(14, 4) NOT NULL,
                "unitCost" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
                "varianceValue" NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
                "reasonCode" VARCHAR(100),
                notes TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_stock_count_branch ON stock_counts ("companyId", "branchId", "countDate");
            CREATE INDEX IF NOT EXISTS idx_stock_count_items ON stock_count_items ("stockCountId", "itemId");
        """))

    print("Migration for Part 3 completed successfully!")

if __name__ == "__main__":
    migrate_part3()
