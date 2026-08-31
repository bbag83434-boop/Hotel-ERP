import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from sqlalchemy import text

def run_procurement_migration():
    print("Running procurement & WhatsApp consolidation migration...")
    db = SessionLocal()
    try:
        # 1. Add enum values to POStatus
        enum_commands = [
            "ALTER TYPE \"POStatus\" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';",
            "ALTER TYPE \"POStatus\" ADD VALUE IF NOT EXISTS 'APPROVED';",
            "ALTER TYPE \"POStatus\" ADD VALUE IF NOT EXISTS 'WHATSAPP_OPENED';",
            "ALTER TYPE \"POStatus\" ADD VALUE IF NOT EXISTS 'SENT_MANUALLY';",
            "ALTER TYPE \"POStatus\" ADD VALUE IF NOT EXISTS 'REJECTED';",
            "ALTER TYPE \"postatus\" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';",
            "ALTER TYPE \"postatus\" ADD VALUE IF NOT EXISTS 'APPROVED';",
            "ALTER TYPE \"postatus\" ADD VALUE IF NOT EXISTS 'WHATSAPP_OPENED';",
            "ALTER TYPE \"postatus\" ADD VALUE IF NOT EXISTS 'SENT_MANUALLY';",
            "ALTER TYPE \"postatus\" ADD VALUE IF NOT EXISTS 'REJECTED';",
            "ALTER TYPE \"PRStatus\" ADD VALUE IF NOT EXISTS 'CANCELLED';",
            "ALTER TYPE \"prstatus\" ADD VALUE IF NOT EXISTS 'CANCELLED';",
        ]
        for cmd in enum_commands:
            try:
                db.execute(text(cmd))
                db.commit()
            except Exception as e:
                db.rollback()

        # 2. Table columns
        commands = [
            'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "whatsappNumber" VARCHAR(50);',
            'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "contactPerson" VARCHAR(100);',
            'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "taxNumber" VARCHAR(50);',
            'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "paymentTerms" VARCHAR(100);',
            'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "address" VARCHAR(500);',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "branchId" VARCHAR(36);',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "whatsappOpenedAt" TIMESTAMP;',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "whatsappNumber" VARCHAR(50);',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "allocations" TEXT;',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "approvedById" VARCHAR(36);',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP;',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "orderDate" TIMESTAMP DEFAULT NOW();',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "expectedDeliveryDate" TIMESTAMP;',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "totalAmount" NUMERIC(14, 4) DEFAULT 0;',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "taxAmount" NUMERIC(14, 4) DEFAULT 0;',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC(14, 4) DEFAULT 0;',
            'ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "netAmount" NUMERIC(14, 4) DEFAULT 0;',
            'ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS "allocations" TEXT;',
            'ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS "notes" VARCHAR(255);',
            'ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "priority" VARCHAR(50) DEFAULT \'MEDIUM\';',
            'ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "approvedById" VARCHAR(36);',
            'ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP;',
            'ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "rejectionReason" VARCHAR(500);',
            'ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS "supplierId" VARCHAR(36);',
            'ALTER TABLE items ADD COLUMN IF NOT EXISTS "supplierId" VARCHAR(36);',
            'ALTER TABLE items ADD COLUMN IF NOT EXISTS "preferredSupplierId" VARCHAR(36);',
        ]
        for cmd in commands:
            db.execute(text(cmd))
        db.commit()
        print("[OK] Procurement schema migration completed successfully!")
    except Exception as e:
        db.rollback()
        print(f"[FAIL] Procurement migration failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_procurement_migration()
