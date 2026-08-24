import os
import sys
from sqlalchemy import text
from app.core.database import engine

def migrate_vendor_items():
    print("=== MIGRATING PART 2: VENDOR-ITEM MAPPINGS & GRANULAR PERMISSIONS ===")
    with engine.begin() as conn:
        # 1. Ensure supplier_items table exists
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS supplier_items (
            id VARCHAR(36) PRIMARY KEY,
            "companyId" VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            "supplierId" VARCHAR(36) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            "itemId" VARCHAR(36) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            "supplierItemCode" VARCHAR(100),
            "supplierItemName" VARCHAR(255),
            "purchaseUnitId" VARCHAR(36) REFERENCES units(id) ON DELETE SET NULL,
            "purchasePrice" NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
            "conversionRate" NUMERIC(14, 4) NOT NULL DEFAULT 1.0000,
            "leadTimeDays" INT NOT NULL DEFAULT 1,
            "isPreferred" BOOLEAN NOT NULL DEFAULT FALSE,
            "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
            "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_company_supplier_item UNIQUE ("companyId", "supplierId", "itemId")
        );

        CREATE INDEX IF NOT EXISTS idx_supplier_item_supplier ON supplier_items ("companyId", "supplierId");
        CREATE INDEX IF NOT EXISTS idx_supplier_item_item ON supplier_items ("companyId", "itemId");
        CREATE INDEX IF NOT EXISTS idx_supplier_item_active ON supplier_items ("companyId", "isActive");
        """))

        # 2. Ensure permissions and role_permissions tables exist
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS permissions (
            id VARCHAR(36) PRIMARY KEY,
            code VARCHAR(100) UNIQUE NOT NULL,
            module VARCHAR(100) NOT NULL,
            action VARCHAR(100) NOT NULL,
            description VARCHAR(255),
            "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
            id VARCHAR(36) PRIMARY KEY,
            "roleId" VARCHAR(36) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            "permissionId" VARCHAR(36) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_role_permission UNIQUE ("roleId", "permissionId")
        );

        CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions ("roleId");
        CREATE INDEX IF NOT EXISTS idx_role_perms_perm ON role_permissions ("permissionId");
        """))
    print("=== PART 2 VENDOR-ITEMS & PERMISSIONS MIGRATION COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    migrate_vendor_items()
