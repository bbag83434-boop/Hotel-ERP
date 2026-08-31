import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from sqlalchemy import text

def run_smart_requirement_migration():
    print("Running Outlet Smart Requirement migration...")
    db = SessionLocal()
    try:
        commands = [
            """
            CREATE TABLE IF NOT EXISTS branch_requirement_configs (
                id VARCHAR(36) PRIMARY KEY,
                "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                "branchId" VARCHAR(36) NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
                "preparationTime" VARCHAR(10) DEFAULT '16:00' NOT NULL,
                "isAutoEnabled" BOOLEAN DEFAULT TRUE NOT NULL,
                "leadTimeDays" INT DEFAULT 1 NOT NULL,
                "safetyBufferPercent" NUMERIC(5, 2) DEFAULT 10.00 NOT NULL,
                "lastGeneratedDate" DATE,
                "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
                "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS smart_requirement_drafts (
                id VARCHAR(36) PRIMARY KEY,
                "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                "branchId" VARCHAR(36) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                "draftDate" DATE NOT NULL,
                status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL,
                "generatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
                "confirmedAt" TIMESTAMP,
                "confirmedById" VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
                "purchaseRequestId" VARCHAR(36) REFERENCES purchase_requests(id) ON DELETE SET NULL,
                notes TEXT,
                "auditSummary" TEXT,
                "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
                "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS smart_requirement_items (
                id VARCHAR(36) PRIMARY KEY,
                "draftId" VARCHAR(36) NOT NULL REFERENCES smart_requirement_drafts(id) ON DELETE CASCADE,
                "itemId" VARCHAR(36) NOT NULL REFERENCES items(id),
                "supplierId" VARCHAR(36) REFERENCES suppliers(id) ON DELETE SET NULL,
                "currentStock" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                "minStock" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                "targetStock" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                "pendingIncoming" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                "dailyConsumption" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                "shortQty" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                "systemSuggestedQty" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                "finalOrderQty" NUMERIC(14, 4) DEFAULT 0 NOT NULL,
                priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
                "isUserModified" BOOLEAN DEFAULT FALSE NOT NULL,
                "isManuallyAdded" BOOLEAN DEFAULT FALSE NOT NULL,
                reason TEXT,
                notes VARCHAR(255),
                "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
                "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
            );
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_draft_branch_date ON smart_requirement_drafts ("branchId", "draftDate");
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_draft_items_draft ON smart_requirement_items ("draftId");
            """
        ]
        for cmd in commands:
            db.execute(text(cmd))
        db.commit()
        print("[OK] Smart Requirement schema migration completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"[FAIL] Smart Requirement migration failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_smart_requirement_migration()
