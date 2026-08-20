import os
import sys
from sqlalchemy import text
from app.core.database import engine

def migrate_wastage():
    print("=== MIGRATING PART 9: WASTAGE MANAGEMENT TABLES ===")
    raw_conn = engine.raw_connection()
    raw_conn.autocommit = True
    cur = raw_conn.cursor()
    try:
        cur.execute("ALTER TYPE \"StockMovementType\" ADD VALUE IF NOT EXISTS 'WASTAGE';")
        print("  [OK] Added 'WASTAGE' to StockMovementType enum in PostgreSQL")
    except Exception as e:
        print(f"  [INFO] Enum alteration note: {e}")
    finally:
        cur.close()
        raw_conn.close()

    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS wastage_entries (
            id VARCHAR(36) PRIMARY KEY,
            "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            "branchId" VARCHAR(36) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
            "kitchenWarehouseId" VARCHAR(36) NOT NULL REFERENCES warehouses(id),
            "entryNumber" VARCHAR(50) NOT NULL,
            "entryDate" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            "totalCost" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
            "totalItemsCount" INTEGER NOT NULL DEFAULT 0,
            "requiresApproval" BOOLEAN NOT NULL DEFAULT FALSE,
            "reportedById" VARCHAR(36) NOT NULL REFERENCES users(id),
            "approvedById" VARCHAR(36) REFERENCES users(id),
            "approvedAt" TIMESTAMP WITHOUT TIME ZONE,
            "rejectionReason" VARCHAR(500),
            notes TEXT,
            "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_wastage_company_branch ON wastage_entries ("companyId", "branchId");
        CREATE INDEX IF NOT EXISTS idx_wastage_entry_number ON wastage_entries ("entryNumber");
        CREATE INDEX IF NOT EXISTS idx_wastage_entry_date ON wastage_entries ("entryDate");
        CREATE INDEX IF NOT EXISTS idx_wastage_status ON wastage_entries (status);

        CREATE TABLE IF NOT EXISTS wastage_items (
            id VARCHAR(36) PRIMARY KEY,
            "wastageEntryId" VARCHAR(36) NOT NULL REFERENCES wastage_entries(id) ON DELETE CASCADE,
            "itemId" VARCHAR(36) NOT NULL REFERENCES items(id),
            "unitId" VARCHAR(36) REFERENCES units(id),
            quantity NUMERIC(14, 4) NOT NULL,
            "unitCost" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
            "totalCost" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
            "reasonCode" VARCHAR(50) NOT NULL DEFAULT 'EXPIRED',
            "batchNumber" VARCHAR(50),
            notes VARCHAR(255),
            "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_wastage_items_entry ON wastage_items ("wastageEntryId");
        CREATE INDEX IF NOT EXISTS idx_wastage_items_item ON wastage_items ("itemId");
        CREATE INDEX IF NOT EXISTS idx_wastage_items_reason ON wastage_items ("reasonCode");
        """))
    print("=== MIGRATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    migrate_wastage()
