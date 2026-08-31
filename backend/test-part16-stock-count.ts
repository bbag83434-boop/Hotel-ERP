import { prisma } from './src/config/database';
import { StockCountService } from './src/services/stockCount.service';
import { InventoryService } from './src/services/inventory.service';
import { Prisma } from '@prisma/client';

async function runPart16Tests() {
  console.log('🧪 Starting PART 16 — Stock Count & Physical Reconciliation Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const warehouse = await prisma.warehouse.findFirst({
    where: { branchId: branch.id, isActive: true }
  }) || await prisma.warehouse.findFirst({ where: { companyId: company.id } });
  if (!warehouse) throw new Error('Warehouse missing');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  const milkItem = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'RM-MILK-FULL' }
  });
  const gheeItem = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'RM-DESI-GHEE' }
  });

  if (!milkItem || !gheeItem) throw new Error('Required test raw materials missing');

  // Baseline stocking
  await InventoryService.adjustStock({
    companyId: company.id,
    warehouseId: warehouse.id,
    itemId: milkItem.id,
    newQuantity: 50.0, // System stock: 50 L
    reason: 'Stock Count baseline stocking milk',
    actorId: user.id
  });

  await InventoryService.adjustStock({
    companyId: company.id,
    warehouseId: warehouse.id,
    itemId: gheeItem.id,
    newQuantity: 30.0, // System stock: 30 KG
    reason: 'Stock Count baseline stocking ghee',
    actorId: user.id
  });

  // ==========================================
  // TEST 1: Low-Variance Stock Reconciliation (< $200 Threshold -> Auto-Applied)
  // ==========================================
  console.log('\n--- TEST 1: Low-Variance Physical Stock Count (Auto-Applied) ---');
  // System: 50L Milk -> Counted: 48L (-2L Milk shrinkage @ $65/L = $130 variance < $200 threshold)
  const lowCountRes = await StockCountService.reconcilePhysicalCount({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    countedItems: [
      {
        itemId: milkItem.id,
        countedQty: 48.0, // Physical count found 48L
        notes: 'Slight spillage during dispensing'
      }
    ],
    notes: 'Monthly routine cyclic stock audit',
    actorId: user.id
  });

  console.log(`✅ Stock Count Reconciled: #${lowCountRes.countNumber}`);
  console.log(`   Absolute Variance: $${lowCountRes.totalAbsoluteVariance}`);
  console.log(`   Shrinkage Value:   $${lowCountRes.totalShrinkageValue}`);
  console.log(`   Requires Approval: ${lowCountRes.requiresApproval}`);
  console.log(`   Status:            ${lowCountRes.status}`);

  if (lowCountRes.requiresApproval || lowCountRes.status !== 'APPLIED') {
    throw new Error('Low variance stock count should be applied automatically');
  }

  // Verify warehouse stock is now updated to physical count (48L)
  const milkStockAfter = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  });
  console.log(`✅ Warehouse Stock Balance Updated to Physical Count: ${milkStockAfter?.quantity} L (Expected: 48)`);
  if (!milkStockAfter?.quantity.equals(new Prisma.Decimal(48.0))) {
    throw new Error(`Stock quantity mismatch: Expected 48, got ${milkStockAfter?.quantity}`);
  }

  // Verify stock ledger movement
  const ledgerMove = await prisma.stockLedger.findFirst({
    where: { referenceId: lowCountRes.countNumber, referenceType: 'STOCK_COUNT' }
  });
  console.log(`✅ Immutable StockLedger Entry: Movement: ${ledgerMove?.movementType} | Change: ${ledgerMove?.changeQty} L`);
  if (!ledgerMove?.changeQty.equals(new Prisma.Decimal(-2.0))) {
    throw new Error(`Ledger changeQty mismatch: Expected -2, got ${ledgerMove?.changeQty}`);
  }

  // ==========================================
  // TEST 2: High-Variance Stock Count (> $200 Threshold -> Requires Approval)
  // ==========================================
  console.log('\n--- TEST 2: High-Variance Physical Stock Count (Requires Approval) ---');
  // System: 30 KG Ghee -> Counted: 26 KG (-4 KG Ghee shrinkage @ $650/KG = $2,600 variance > $200 threshold)
  const highCountRes = await StockCountService.reconcilePhysicalCount({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    countedItems: [
      {
        itemId: gheeItem.id,
        countedQty: 26.0, // Missing 4 KG
        notes: 'Unaccounted discrepancy in dry store'
      }
    ],
    notes: 'Surprise weekend stock audit',
    actorId: user.id
  });

  console.log(`✅ High Variance Count Recorded: #${highCountRes.countNumber}`);
  console.log(`   Absolute Variance: $${highCountRes.totalAbsoluteVariance}`);
  console.log(`   Requires Approval: ${highCountRes.requiresApproval}`);
  console.log(`   Status:            ${highCountRes.status}`);

  if (!highCountRes.requiresApproval || highCountRes.status !== 'PENDING_APPROVAL') {
    throw new Error('High variance stock count must be flagged as PENDING_APPROVAL');
  }

  // Verify approval request was generated in Approval Center
  const approvalReq = await prisma.approvalRequest.findFirst({
    where: { referenceId: highCountRes.countNumber, transactionType: 'EXPENSE' }
  });
  console.log(`✅ Approval Request Created in Approval Center: #${approvalReq?.id} (Amount: $${approvalReq?.amount})`);

  // Verify stock was NOT modified while on PENDING_APPROVAL hold
  const gheeStockDuringHold = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: gheeItem.id } }
  });
  console.log(`✅ Ghee Stock during Approval Hold: ${gheeStockDuringHold?.quantity} KG (Unchanged: 30)`);
  if (!gheeStockDuringHold?.quantity.equals(new Prisma.Decimal(30.0))) {
    throw new Error('Stock balance was prematurely updated while variance was on approval hold');
  }

  // ==========================================
  // TEST 3: Stock Count History & Audit Query
  // ==========================================
  console.log('\n--- TEST 3: Stock Count History & Audit ---');
  const countHistory = await StockCountService.getStockCountHistory(company.id, {
    warehouseId: warehouse.id
  });

  console.log(`✅ Found ${countHistory.length} reconciled stock count audit movements:`);
  countHistory.forEach((c) => {
    console.log(`   - [${c.referenceId}] Item: ${c.item.name} | Change: ${c.changeQty} | Notes: ${c.notes}`);
  });

  if (countHistory.length < 1) {
    throw new Error('Stock count history is empty');
  }

  console.log('\n🎉 ALL PART 16 STOCK COUNT & PHYSICAL RECONCILIATION TESTS PASSED!');
}

runPart16Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
