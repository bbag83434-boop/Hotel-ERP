"""
PART 4 MIGRATION — Procurement Receiving & Multi-Outlet Transfer
Run once against Neon PostgreSQL. Idempotent (IF NOT EXISTS / IF EXISTS guards).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.sync_database_url, echo=True)

DDL_STEPS = [
    # ──────────────────────────────────────────────────────────────────────────
    # 1. GoodsReceiveNote — add damaged_qty, short_qty, delivery_reference,
    #    approved_by_id, approved_at, idempotency_key
    # ──────────────────────────────────────────────────────────────────────────
    """ALTER TABLE goods_receive_notes
       ADD COLUMN IF NOT EXISTS "damagedQty"       NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "shortQty"         NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "deliveryReference" VARCHAR(100)   NULL,
       ADD COLUMN IF NOT EXISTS "approvedById"     VARCHAR(36)    NULL REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "approvedAt"       TIMESTAMP      NULL,
       ADD COLUMN IF NOT EXISTS "idempotencyKey"   VARCHAR(255)   NULL
    """,

    # ──────────────────────────────────────────────────────────────────────────
    # 2. GoodsReceiveItem — add damaged_qty, short_qty, shortage_reason_code
    # ──────────────────────────────────────────────────────────────────────────
    """ALTER TABLE goods_receive_items
       ADD COLUMN IF NOT EXISTS "damagedQty"           NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "shortQty"             NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "shortageReasonCode"   VARCHAR(50)    NULL
    """,

    # ──────────────────────────────────────────────────────────────────────────
    # 3. PurchaseOrderItem — add approved_qty (buyer can adjust without
    #    overwriting orderedQty)
    # ──────────────────────────────────────────────────────────────────────────
    """ALTER TABLE purchase_order_items
       ADD COLUMN IF NOT EXISTS "approvedQty" NUMERIC(14,4) NULL
    """,

    # ──────────────────────────────────────────────────────────────────────────
    # 4. StockTransfer status — extend the existing TransferStatus Postgres enum
    #    to include all 7 Part 4 statuses.
    #    PostgreSQL requires ADD VALUE outside a transaction block.
    # ──────────────────────────────────────────────────────────────────────────
    """ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'REQUESTED'""",
    """ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'APPROVED'""",
    """ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED'""",
    """ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT'""",
    """ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_RECEIVED'""",
    """ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'FULLY_RECEIVED'""",
    """ALTER TYPE "TransferStatus" ADD VALUE IF NOT EXISTS 'RECONCILED'""",

    # ──────────────────────────────────────────────────────────────────────────
    # 5. StockTransfer — add full audit + outlet columns
    # ──────────────────────────────────────────────────────────────────────────
    """ALTER TABLE stock_transfers
       ADD COLUMN IF NOT EXISTS "sourceBranchId"      VARCHAR(36)    NULL REFERENCES branches(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "destinationBranchId" VARCHAR(36)    NULL REFERENCES branches(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "requestedById"       VARCHAR(36)    NULL REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "approvedById"        VARCHAR(36)    NULL REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "approvedAt"          TIMESTAMP      NULL,
       ADD COLUMN IF NOT EXISTS "dispatchedById"      VARCHAR(36)    NULL REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "dispatchedAt"        TIMESTAMP      NULL,
       ADD COLUMN IF NOT EXISTS "dispatchNotes"       TEXT           NULL,
       ADD COLUMN IF NOT EXISTS "receivedById"        VARCHAR(36)    NULL REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "receivedAt"          TIMESTAMP      NULL,
       ADD COLUMN IF NOT EXISTS "reconciledById"      VARCHAR(36)    NULL REFERENCES users(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS "reconciledAt"        TIMESTAMP      NULL,
       ADD COLUMN IF NOT EXISTS "expectedDeliveryDate" TIMESTAMP     NULL,
       ADD COLUMN IF NOT EXISTS "idempotencyKey"      VARCHAR(255)   NULL,
       ADD COLUMN IF NOT EXISTS "rejectionReason"     VARCHAR(500)   NULL
    """,

    # ──────────────────────────────────────────────────────────────────────────
    # 6. StockTransferItem — add dispatched/accepted/damaged/short columns +
    #    batch/expiry preservation
    # ──────────────────────────────────────────────────────────────────────────
    """ALTER TABLE stock_transfer_items
       ADD COLUMN IF NOT EXISTS "requestedQty"      NUMERIC(14,4)  NULL,
       ADD COLUMN IF NOT EXISTS "dispatchedQty"     NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "acceptedQty"       NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "damagedQty"        NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "shortQty"          NUMERIC(14,4)  NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS "shortageReasonCode" VARCHAR(50)   NULL,
       ADD COLUMN IF NOT EXISTS "batchNumber"       VARCHAR(100)   NULL,
       ADD COLUMN IF NOT EXISTS "expiryDate"        TIMESTAMP      NULL
    """,

    # ──────────────────────────────────────────────────────────────────────────
    # 7. Indexes
    # ──────────────────────────────────────────────────────────────────────────
    """CREATE INDEX IF NOT EXISTS idx_grn_idempotency
       ON goods_receive_notes("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL""",

    """CREATE INDEX IF NOT EXISTS idx_grn_po_status
       ON goods_receive_notes("poId", status)""",

    """CREATE INDEX IF NOT EXISTS idx_transfer_source_dest
       ON stock_transfers("sourceBranchId", "destinationBranchId")""",

    """CREATE INDEX IF NOT EXISTS idx_transfer_status
       ON stock_transfers(status)""",

    """CREATE INDEX IF NOT EXISTS idx_transfer_expected_delivery
       ON stock_transfers("expectedDeliveryDate") WHERE status IN ('DISPATCHED','IN_TRANSIT')""",

    """CREATE INDEX IF NOT EXISTS idx_transfer_item_transfer
       ON stock_transfer_items("transferId")""",

    # ──────────────────────────────────────────────────────────────────────────
    # 8. Create IN_TRANSIT virtual warehouse for each existing company (if not
    #    exists). Uses a deterministic approach: insert only if no warehouse
    #    named 'IN_TRANSIT' exists for that company's head-office branch.
    # ──────────────────────────────────────────────────────────────────────────
    """
    INSERT INTO warehouses (id, "companyId", "branchId", name, code, "isCentral", "isActive", "createdAt", "updatedAt")
    SELECT
        gen_random_uuid()::text,
        c.id,
        b.id,
        'IN_TRANSIT',
        'WH-INTRANSIT',
        false,
        true,
        NOW(),
        NOW()
    FROM companies c
    JOIN branches b ON b."companyId" = c.id
    WHERE b.type::text IN ('HEAD_OFFICE','CENTRAL_STORE')
      AND NOT EXISTS (
          SELECT 1 FROM warehouses w2
          WHERE w2."companyId" = c.id
            AND w2.code = 'WH-INTRANSIT'
      )
    LIMIT 10
    """,
]

def run():
    with engine.connect() as conn:
        for i, ddl in enumerate(DDL_STEPS, 1):
            stmt = ddl.strip()
            # ADD VALUE must run outside explicit transaction
            if "ADD VALUE" in stmt:
                conn.execute(text("COMMIT"))
            try:
                conn.execute(text(stmt))
                conn.execute(text("COMMIT"))
                print(f"[{i}/{len(DDL_STEPS)}] OK")
            except Exception as e:
                err = str(e)
                if "already exists" in err.lower() or "duplicate" in err.lower():
                    print(f"[{i}/{len(DDL_STEPS)}] SKIP (already exists): {err[:80]}")
                    conn.execute(text("ROLLBACK"))
                else:
                    print(f"[{i}/{len(DDL_STEPS)}] ERROR: {err}")
                    conn.execute(text("ROLLBACK"))
                    raise

    print("\n=== PART 4 MIGRATION COMPLETE ===")

if __name__ == "__main__":
    run()
