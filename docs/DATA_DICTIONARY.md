# HOTEL-ERP DATA DICTIONARY & ENTITY SPECIFICATION
**Version:** 2.0.0  
**Database:** Neon PostgreSQL  
**ORM:** SQLAlchemy 2.0  

---

## 1. CORE ENTITY SCHEMAS

### 1.1 Organization Domain
- **`companies`**: Top-level multi-tenant enterprise entity (`id`, `name`, `code`, `email`, `phone`, `address`, `logoUrl`, `isActive`).
- **`branches`**: Physical/logical operating units (`id`, `companyId`, `name`, `code`, `type` [HEAD_OFFICE, CENTRAL_STORE, DESSERT_KITCHEN, RESTAURANT, RESTAURANT_OUTLET, HOTEL, HYBRID], `isActive`).
- **`departments`**: Sub-units within branch or company (`id`, `companyId`, `branchId`, `name`, `code`, `isActive`).
- **`warehouses`**: Stock-holding locations (`id`, `companyId`, `branchId`, `name`, `code`, `isCentral`, `isActive`).
- **`store_locations`**: Specific bin/rack/shelf locations inside a warehouse (`id`, `warehouseId`, `itemId`, `aisle`, `rack`, `shelf`, `bin`, `capacity`).

### 1.2 User & RBAC Domain
- **`users`**: System users (`id`, `companyId`, `roleId`, `email`, `username`, `passwordHash`, `firstName`, `lastName`, `phone`, `avatarUrl`, `isActive`, `refreshToken`, `lastLoginAt`).
- **`roles`**: Security roles (`id`, `name`, `description`, `isSystem`).
- **`permissions`**: Granular permission nodes (`id`, `code`, `module`, `action`, `description`).
- **`role_permissions`**: Role-to-Permission mapping (`id`, `roleId`, `permissionId`).
- **`user_branches`**: User-to-Branch assignment mapping (`id`, `userId`, `branchId`, `isDefault`).

### 1.3 Inventory & Stock Domain
- **`categories`**: Item classification (`id`, `companyId`, `name`, `code`, `description`).
- **`units`**: Measurement units (`id`, `companyId`, `name`, `symbol`).
- **`unit_conversions`**: Multi-unit factors (`id`, `companyId`, `fromUnitId`, `toUnitId`, `conversionFactor`).
- **`items`**: Catalog master items (`id`, `companyId`, `categoryId`, `unitId`, `supplierId`, `name`, `code`, `barcode`, `type` [RAW_MATERIAL, FINISHED_GOOD, SEMI_FINISHED, PACKAGING, ASSET], `costPrice`, `sellingPrice`, `minStockLevel`, `reorderQty`, `isActive`).
- **`stock_balances`**: Real-time warehouse item quantities (`id`, `warehouseId`, `itemId`, `quantity`, `minStockLevel`, `reorderQty`, `updatedAt`).
- **`stock_batches`**: Lot/batch numbers with expiry dates (`id`, `warehouse_id`, `item_id`, `batch_number`, `quantity`, `unit_cost`, `expiry_date`, `mfg_date`, `is_active`).
- **`stock_ledgers`**: Immutable double-entry stock movement log (`id`, `warehouseId`, `itemId`, `batchNumber`, `expiryDate`, `movementType` [GRN, PRODUCTION_IN, PRODUCTION_OUT, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT, RETURN, POS_SALE, WASTAGE], `changeQty`, `balanceQty`, `unitCost`, `totalCost`, `referenceType`, `referenceId`, `createdById`).
- **`stock_transfers`**: Inter-warehouse stock transfer headers (`id`, `companyId`, `fromWarehouseId`, `toWarehouseId`, `transferNumber`, `status` [PENDING, COMPLETED, CANCELLED], `transferDate`, `notes`, `createdById`).
- **`stock_transfer_items`**: Transfer line items (`id`, `transferId`, `itemId`, `requestedQty`, `transferredQty`, `unitCost`, `notes`).
- **`stock_counts`**: Physical stock audit count headers (`id`, `companyId`, `warehouseId`, `countNumber`, `status` [DRAFT, IN_PROGRESS, SUBMITTED, APPROVED, ADJUSTED, CANCELLED], `countDate`, `notes`, `conductedById`, `approvedById`).
- **`stock_count_items`**: Physical stock audit line items (`id`, `stockCountId`, `itemId`, `systemQty`, `countedQty`, `varianceQty`, `unitCost`, `varianceValue`, `notes`).

### 1.4 Procurement Domain
- **`suppliers`**: Approved vendor directory (`id`, `companyId`, `name`, `code`, `contactPerson`, `phone`, `whatsappNumber`, `email`, `address`, `taxNumber`, `paymentTerms`, `isActive`).
- **`purchase_requests`**: Branch purchase requisitions (`id`, `companyId`, `branchId`, `requestNumber`, `requestedById`, `requiredDate`, `status` [DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, ORDERED, CANCELLED], `priority` [LOW, MEDIUM, HIGH, URGENT], `notes`, `approvedById`, `approvedAt`, `rejectionReason`).
- **`purchase_request_items`**: PR line items (`id`, `requestId`, `itemId`, `supplierId`, `requestedQty`, `estimatedPrice`, `notes`).
- **`purchase_orders`**: Central consolidated purchase orders (`id`, `companyId`, `branchId`, `supplierId`, `poNumber`, `status` [DRAFT, PENDING_APPROVAL, APPROVED, WHATSAPP_OPENED, SENT_MANUALLY, ISSUED, PARTIALLY_RECEIVED, RECEIVED, REJECTED, CANCELLED], `orderDate`, `expectedDeliveryDate`, `totalAmount`, `taxAmount`, `discountAmount`, `netAmount`, `notes`, `approvedById`, `approvedAt`, `whatsappOpenedAt`, `whatsappNumber`, `allocations`).
- **`purchase_order_items`**: PO line items (`id`, `poId`, `itemId`, `orderedQty`, `receivedQty`, `unitPrice`, `totalPrice`, `notes`, `allocations`).
- **`goods_receive_notes`**: Goods Receipt Notes / GRN (`id`, `companyId`, `branchId`, `warehouseId`, `supplierId`, `poId`, `grnNumber`, `receiveDate`, `invoiceNumber`, `totalAmount`, `status` [PENDING_APPROVAL, APPROVED, RECEIVED, QC_PASSED, QC_FAILED, REJECTED], `notes`, `receivedById`).
- **`goods_receive_items`**: GRN line items (`id`, `grnId`, `poItemId`, `itemId`, `receivedQty`, `acceptedQty`, `rejectedQty`, `unitPrice`, `totalPrice`, `batchNumber`, `expiryDate`, `qcStatus`, `qcNotes`).

### 1.5 Smart Requirement Domain
- **`branch_requirement_configs`**: Auto-requirement rules per outlet (`id`, `companyId`, `branchId`, `preparationTime`, `isAutoEnabled`, `leadTimeDays`, `safetyBufferPercent`, `lastGeneratedDate`).
- **`smart_requirement_drafts`**: Generated requirement draft header (`id`, `companyId`, `branchId`, `draftDate`, `status`, `generatedAt`, `confirmedAt`, `confirmedById`, `purchaseRequestId`, `notes`, `auditSummary`).
- **`smart_requirement_items`**: Itemized requirements with short quantities (`id`, `draftId`, `itemId`, `supplierId`, `currentStock`, `minStock`, `targetStock`, `pendingIncoming`, `dailyConsumption`, `shortQty`, `systemSuggestedQty`, `finalOrderQty`, `priority`, `isUserModified`, `isManuallyAdded`, `reason`, `notes`).

### 1.6 Production & Recipe Domain
- **`recipes`**: Bill of Materials / Recipe definitions (`id`, `companyId`, `finishedItemId`, `name`, `code`, `description`, `yieldQty`, `preparationMinutes`, `instructions`, `isActive`).
- **`recipe_items`**: Recipe raw material ingredients (`id`, `recipeId`, `rawItemId`, `unitId`, `quantity`, `costContribution`, `notes`).
- **`production_orders`**: Kitchen production batch runs (`id`, `companyId`, `branchId`, `kitchenWarehouseId`, `recipeId`, `orderNumber`, `plannedQty`, `actualYieldQty`, `wastageQty`, `status` [DRAFT, IN_PROGRESS, COMPLETED, CANCELLED], `plannedDate`, `completedDate`, `totalRawCost`, `unitFoodCost`, `notes`, `createdById`).
- **`production_consumptions`**: Actual ingredient consumption per production run (`id`, `productionOrderId`, `rawItemId`, `standardQty`, `actualConsumedQty`, `unitCost`, `totalCost`).

### 1.7 Wastage Domain
- **`wastage_entries`**: Food waste and scrap headers (`id`, `companyId`, `branchId`, `kitchenWarehouseId`, `entryNumber`, `entryDate`, `status` [DRAFT, PENDING_APPROVAL, APPROVED, REJECTED], `totalCost`, `totalItemsCount`, `requiresApproval`, `reportedById`, `approvedById`, `approvedAt`, `rejectionReason`, `notes`).
- **`wastage_items`**: Wastage item breakdown (`id`, `wastageEntryId`, `itemId`, `unitId`, `quantity`, `unitCost`, `totalCost`, `reasonCode` [EXPIRED, PREPARATION_LOSS, BURNT_DROPPED, QUALITY_ISSUE, STORAGE_FAILURE, CUSTOMER_RETURN, OTHER], `batchNumber`, `notes`).

### 1.8 Bi-Monthly Closing Domain
- **`outlet_closing_records`**: Period closing audit record (`id`, `companyId`, `branchId`, `periodType` [FIRST_HALF, SECOND_HALF], `year`, `month`, `startDate`, `endDate`, `status` [DRAFT, SUBMITTED, VERIFIED, FINALIZED_LOCKED, REJECTED], `openingValuation`, `totalPurchases`, `closingPhysicalValuation`, `calculatedConsumption`, `theoreticalFoodCost`, `actualFoodCost`, `varianceAmount`, `variancePercentage`, `notes`, `submittedById`, `submittedAt`, `verifiedById`, `verifiedAt`, `finalizedAt`).
- **`closing_stock_items`**: Closing valuation per SKU (`id`, `closingRecordId`, `itemId`, `unitId`, `openingQty`, `receivedQty`, `theoreticalClosingQty`, `physicalClosingQty`, `varianceQty`, `unitCost`, `totalValuation`, `notes`).
- **`food_cost_calculations`**: Food cost variance breakdown by category (`id`, `closingRecordId`, `categoryId`, `salesRevenue`, `theoreticalCost`, `actualCost`, `theoreticalCostPct`, `actualCostPct`, `varianceCost`, `variancePct`).

### 1.9 HR & Payroll Domain
- **`staff`**: Employee master (`id`, `companyId`, `branchId`, `userId`, `employeeCode`, `firstName`, `lastName`, `email`, `phone`, `designation`, `department`, `joiningDate`, `baseSalary`, `hourlyRate`, `status`, `isActive`).
- **`attendances`**: Daily clock-in/clock-out records (`id`, `companyId`, `branchId`, `staffId`, `date`, `checkIn`, `checkOut`, `hoursWorked`, `overtimeHours`, `status` [PRESENT, ABSENT, HALF_DAY, LATE, ON_LEAVE], `notes`).
- **`payrolls`**: Monthly payroll summaries (`id`, `companyId`, `branchId`, `month`, `year`, `startDate`, `endDate`, `totalGross`, `totalDeductions`, `totalNet`, `status` [DRAFT, REVIEWED, APPROVED, PAID], `processedBy`, `notes`).
- **`payroll_items`**: Staff payroll breakdown (`id`, `payrollId`, `staffId`, `basePay`, `overtimePay`, `allowances`, `deductions`, `netPay`, `daysPresent`, `daysAbsent`, `notes`).
- **`hr_shifts`**: Shift schedules (`id`, `companyId`, `branchId`, `name`, `code`, `startTime`, `endTime`, `gracePeriodMins`, `isActive`).
- **`hr_leave_types`**: Leave allocations (`id`, `companyId`, `name`, `code`, `daysAllowed`, `isPaid`).
- **`hr_leave_requests`**: Leave applications (`id`, `companyId`, `branchId`, `employeeId`, `leaveTypeId`, `startDate`, `endDate`, `totalDays`, `reason`, `status`, `approvedById`, `approvedAt`, `rejectionReason`).

### 1.10 Reports & Analytics Domain
- **`report_snapshots`**: Static report output archives (`id`, `companyId`, `branchId`, `reportType`, `periodStart`, `periodEnd`, `generatedAt`, `generatedById`, `title`, `metrics` [JSON], `summaryText`).
- **`report_schedules`**: Scheduled recurring reporting jobs (`id`, `companyId`, `branchId`, `reportType`, `frequency` [DAILY, WEEKLY, BI_WEEKLY, MONTHLY], `recipients` [JSON], `isActive`, `lastRunAt`, `nextRunAt`).

### 1.11 Audit & Idempotency Domain
- **`audit_logs`**: Immutable event audit stream (`id`, `userId`, `action`, `entity`, `entityId`, `details`, `ipAddress`, `userAgent`, `createdAt`).
- **`idempotency_records`**: Idempotent request replay prevention (`id`, `key`, `userId`, `companyId`, `branchId`, `endpoint`, `requestHash`, `responseStatus`, `responseBody`, `expiresAt`).
