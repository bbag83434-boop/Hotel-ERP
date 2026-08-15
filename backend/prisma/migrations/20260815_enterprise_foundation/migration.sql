-- Enterprise Foundation Migration (PART 2)
-- Safe, additive migration adding enterprise models, constraints, and indexes

-- 1. Create Enums if not exists
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ALERT', 'APPROVAL_PENDING', 'LOW_STOCK', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'RECONCILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT', 'FLOAT_START', 'CLOSING_DROP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "StockAdjustmentStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "QRSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "OnlineOrderStatus" AS ENUM ('RECEIVED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "LoyaltyTxType" AS ENUM ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create New Enterprise Tables

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "system_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "system_settings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "cash_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingFloat" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "closingCash" DECIMAL(12,4),
    "expectedCash" DECIMAL(12,4),
    "cashVariance" DECIMAL(12,4),
    "totalCardSales" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalUpiSales" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalCashSales" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "cash_movements" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "movementType" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cash_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "store_locations" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT,
    "aisle" TEXT,
    "rack" TEXT,
    "shelf" TEXT,
    "bin" TEXT,
    "capacity" DECIMAL(12,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "store_locations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "store_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_locations_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "stock_counts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_counts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_counts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_counts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_counts_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "stock_count_items" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "systemQty" DECIMAL(12,4) NOT NULL,
    "physicalQty" DECIMAL(12,4) NOT NULL,
    "varianceQty" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "varianceValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "remarks" TEXT,
    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_count_items_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_count_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "stock_adjustments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "stockCountId" TEXT,
    "adjustmentNumber" TEXT NOT NULL,
    "adjustmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "totalValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_adjustments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_adjustments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_adjustments_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_counts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "stock_adjustment_items" (
    "id" TEXT NOT NULL,
    "stockAdjustmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "reason" TEXT,
    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_adjustment_items_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_adjustment_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "birthDate" DATE,
    "anniversary" DATE,
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalSpend" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "customer_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Home',
    "address" TEXT NOT NULL,
    "city" TEXT,
    "pincode" TEXT,
    "landmark" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "qr_sessions" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "status" "QRSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "guestName" TEXT,
    "guestPhone" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "qr_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qr_sessions_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "dining_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "online_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "qrSessionId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'QR_DINE_IN',
    "status" "OnlineOrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "subTotal" DECIMAL(12,4) NOT NULL,
    "taxAmount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "online_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "online_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "online_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "online_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "online_orders_qrSessionId_fkey" FOREIGN KEY ("qrSessionId") REFERENCES "qr_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "online_order_items" (
    "id" TEXT NOT NULL,
    "onlineOrderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalPrice" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    CONSTRAINT "online_order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "online_order_items_onlineOrderId_fkey" FOREIGN KEY ("onlineOrderId") REFERENCES "online_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "online_order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loyalty_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loyalty_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "loyaltyAccountId" TEXT NOT NULL,
    "type" "LoyaltyTxType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loyalty_transactions_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "coupons" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(12,4) NOT NULL,
    "minOrderAmount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "maxDiscount" DECIMAL(12,4),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupons_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "promotions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promoType" TEXT NOT NULL DEFAULT 'COMBO',
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(12,4) NOT NULL,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6]::INTEGER[],
    "startTime" TEXT,
    "endTime" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promotions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Unique Constraints & Indexes

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_companyId_key_key" ON "system_settings"("companyId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "cash_sessions_sessionNumber_key" ON "cash_sessions"("sessionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_counts_countNumber_key" ON "stock_counts"("countNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_adjustments_adjustmentNumber_key" ON "stock_adjustments"("adjustmentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_companyId_phone_key" ON "customers"("companyId", "phone");
CREATE UNIQUE INDEX IF NOT EXISTS "qr_sessions_sessionToken_key" ON "qr_sessions"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "online_orders_orderNumber_key" ON "online_orders"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_accounts_customerId_key" ON "loyalty_accounts"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_companyId_code_key" ON "coupons"("companyId", "code");

CREATE INDEX IF NOT EXISTS "notifications_companyId_isRead_idx" ON "notifications"("companyId", "isRead");
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "system_settings_companyId_group_idx" ON "system_settings"("companyId", "group");
CREATE INDEX IF NOT EXISTS "cash_sessions_companyId_branchId_idx" ON "cash_sessions"("companyId", "branchId");
CREATE INDEX IF NOT EXISTS "cash_sessions_status_idx" ON "cash_sessions"("status");
CREATE INDEX IF NOT EXISTS "cash_movements_sessionId_idx" ON "cash_movements"("sessionId");
CREATE INDEX IF NOT EXISTS "store_locations_warehouseId_idx" ON "store_locations"("warehouseId");
CREATE INDEX IF NOT EXISTS "stock_counts_companyId_branchId_warehouseId_idx" ON "stock_counts"("companyId", "branchId", "warehouseId");
CREATE INDEX IF NOT EXISTS "stock_counts_status_idx" ON "stock_counts"("status");
CREATE INDEX IF NOT EXISTS "stock_count_items_stockCountId_idx" ON "stock_count_items"("stockCountId");
CREATE INDEX IF NOT EXISTS "stock_adjustments_companyId_branchId_warehouseId_idx" ON "stock_adjustments"("companyId", "branchId", "warehouseId");
CREATE INDEX IF NOT EXISTS "stock_adjustments_status_idx" ON "stock_adjustments"("status");
CREATE INDEX IF NOT EXISTS "stock_adjustment_items_stockAdjustmentId_idx" ON "stock_adjustment_items"("stockAdjustmentId");
CREATE INDEX IF NOT EXISTS "customers_companyId_idx" ON "customers"("companyId");
CREATE INDEX IF NOT EXISTS "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");
CREATE INDEX IF NOT EXISTS "qr_sessions_tableId_idx" ON "qr_sessions"("tableId");
CREATE INDEX IF NOT EXISTS "online_orders_companyId_branchId_idx" ON "online_orders"("companyId", "branchId");
CREATE INDEX IF NOT EXISTS "online_orders_status_idx" ON "online_orders"("status");
CREATE INDEX IF NOT EXISTS "online_order_items_onlineOrderId_idx" ON "online_order_items"("onlineOrderId");
CREATE INDEX IF NOT EXISTS "loyalty_accounts_companyId_idx" ON "loyalty_accounts"("companyId");
CREATE INDEX IF NOT EXISTS "loyalty_transactions_loyaltyAccountId_idx" ON "loyalty_transactions"("loyaltyAccountId");
CREATE INDEX IF NOT EXISTS "coupons_companyId_isActive_idx" ON "coupons"("companyId", "isActive");
CREATE INDEX IF NOT EXISTS "promotions_companyId_isActive_idx" ON "promotions"("companyId", "isActive");
