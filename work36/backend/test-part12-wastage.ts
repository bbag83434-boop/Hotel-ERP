import { prisma } from './src/config/database';
import { WastageService } from './src/services/wastage.service';
import { InventoryService } from './src/services/inventory.service';
import { Prisma } from '@prisma/client';

async function runPart12Tests() {
  console.log('🧪 Starting PART 12 — Wastage & Loss Control Test Suite...');

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
  const mawaItem = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'RM-MAWA-01' }
  });

  if (!milkItem || !mawaItem) throw new Error('Required test items missing');

  // Stock items in warehouse for testing
  await InventoryService.adjustStock({
    companyId: company.id,
    warehouseId: warehouse.id,
    itemId: milkItem.id,
    newQuantity: 100.0,
    reason: 'Wastage test pre-stocking milk',
    actorId: user.id
  });

  await InventoryService.adjustStock({
    companyId: company.id,
    warehouseId: warehouse.id,
    itemId: mawaItem.id,
    newQuantity: 100.0,
    reason: 'Wastage test pre-stocking mawa',
    actorId: user.id
  });

  // ==========================================
  // TEST 1: Low-Value Wastage (< $500 Threshold -> Auto Applied)
  // ==========================================
  console.log('\n--- TEST 1: Low-Value Wastage Recording (Auto-Applied) ---');
  // 5 Litres of milk spoiled @ $65/L = $325 (Under $500 threshold)
  const initialMilkStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  });
  const milkBefore = initialMilkStock ? initialMilkStock.quantity : new Prisma.Decimal(100.0);

  const lowValWastage = await WastageService.recordWastage({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    wastageType: 'SPOILED',
    reason: 'Milk curdled due to brief refrigerator thermostat spike',
    items: [
      {
        itemId: milkItem.id,
        quantity: 5.0,
        batchNumber: 'BATCH-MILK-AUG-01',
        reason: 'Curdled / Sour taste'
      }
    ],
    actorId: user.id
  });

  console.log(`✅ Wastage Recorded: #${lowValWastage.wastage.adjustmentNumber}`);
  console.log(`   Total Value:        $${lowValWastage.wastage.totalValue}`);
  console.log(`   Requires Approval:  ${lowValWastage.requiresApproval}`);
  console.log(`   Status:             ${lowValWastage.status}`);

  if (lowValWastage.requiresApproval || lowValWastage.status !== 'APPLIED') {
    throw new Error('Low value wastage should be APPLIED automatically without manager approval');
  }

  // Verify stock deduction
  const milkAfter = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  });
  const expectedMilkRemaining = milkBefore.minus(new Prisma.Decimal(5.0));
  console.log(`✅ Milk Stock Decremented: ${milkAfter?.quantity} L (Expected: ${expectedMilkRemaining})`);

  if (!milkAfter?.quantity.equals(expectedMilkRemaining)) {
    throw new Error(`Stock decrement mismatch: Expected ${expectedMilkRemaining}, got ${milkAfter?.quantity}`);
  }

  // ==========================================
  // TEST 2: Stock Ledger & GL Journal Verification
  // ==========================================
  console.log('\n--- TEST 2: Stock Ledger & Double-Entry General Ledger Verification ---');
  
  const wastageLedger = await prisma.stockLedger.findFirst({
    where: {
      referenceId: lowValWastage.wastage.adjustmentNumber,
      referenceType: 'WASTAGE'
    }
  });

  console.log(`✅ StockLedger Movement: Type: ${wastageLedger?.movementType} | Change: ${wastageLedger?.changeQty} | Total Cost: $${wastageLedger?.totalCost}`);
  if (!wastageLedger || Number(wastageLedger.changeQty) !== -5.0) {
    throw new Error('Stock ledger entry for wastage was not recorded properly');
  }

  const glJournal = await prisma.journalEntry.findFirst({
    where: {
      referenceId: lowValWastage.wastage.adjustmentNumber,
      referenceType: 'STOCK_WASTAGE'
    },
    include: { lines: { include: { account: true } } }
  });

  if (glJournal) {
    console.log(`✅ GL Journal Posted: #${glJournal.entryNumber} (Total: $${glJournal.totalDebit})`);
    glJournal.lines.forEach((l) => {
      console.log(`   - [${l.account.code}] ${l.account.name}: Debit $${l.debit} | Credit $${l.credit}`);
    });
    if (!glJournal.totalDebit.equals(glJournal.totalCredit)) {
      throw new Error('GL journal entry is not balanced (Debit != Credit)');
    }
  }

  // ==========================================
  // TEST 3: High-Value Wastage (> $500 Threshold -> Requires Approval)
  // ==========================================
  console.log('\n--- TEST 3: High-Value Wastage Recording (Requires Approval) ---');
  // 5 KG of Mawa @ $320/KG = $1,600 (Exceeds $500 threshold)
  const highValWastage = await WastageService.recordWastage({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    wastageType: 'EXPIRED',
    reason: 'Deep freezer breakdown over weekend spoiled entire sweet mawa crate',
    items: [
      {
        itemId: mawaItem.id,
        quantity: 5.0,
        batchNumber: 'BATCH-MAWA-HIGH-01',
        reason: 'Freezer failure defrost contamination'
      }
    ],
    actorId: user.id
  });

  console.log(`✅ High-Value Wastage Recorded: #${highValWastage.wastage.adjustmentNumber}`);
  console.log(`   Total Value:        $${highValWastage.wastage.totalValue}`);
  console.log(`   Requires Approval:  ${highValWastage.requiresApproval}`);
  console.log(`   Status:             ${highValWastage.status}`);

  if (!highValWastage.requiresApproval || highValWastage.status !== 'PENDING_APPROVAL') {
    throw new Error('High value wastage (> $500) must be flagged as PENDING_APPROVAL');
  }

  // Verify approval request was generated in Approval Center
  const approvalRequest = await prisma.approvalRequest.findFirst({
    where: {
      referenceId: highValWastage.wastage.adjustmentNumber,
      transactionType: 'EXPENSE'
    }
  });

  if (approvalRequest) {
    console.log(`✅ Approval Request Created in Approval Center: #${approvalRequest.id}`);
    console.log(`   Title: ${approvalRequest.title} | Status: ${approvalRequest.status} | Amount: $${approvalRequest.amount}`);
  }

  // ==========================================
  // TEST 4: Query Wastage Records
  // ==========================================
  console.log('\n--- TEST 4: Wastage Log Filtering & Reporting ---');
  const records = await WastageService.getWastageRecords(company.id, {
    warehouseId: warehouse.id
  });

  console.log(`✅ Found ${records.entries.length} wastage entries in ${warehouse.name}:`);
  records.entries.forEach((r) => {
    console.log(`   - [${r.referenceId}] ${r.notes} | Change: ${r.changeQty} | Cost: $${r.totalCost} | Created By: ${r.createdBy.firstName}`);
  });

  if (records.entries.length < 1) {
    throw new Error('Expected at least 1 applied wastage record in history');
  }

  // ==========================================
  // TEST 5: Section 50 Failure Scenarios & Edge Cases
  // ==========================================
  console.log('\n--- TEST 5: Section 50 Failure Scenarios (Insufficient Stock, Zero Qty, Empty Items) ---');
  
  // 5.1 Insufficient Stock Validation
  let insufficientStockFailed = false;
  try {
    await WastageService.recordWastage({
      companyId: company.id,
      branchId: branch.id,
      warehouseId: warehouse.id,
      wastageType: 'DAMAGED',
      reason: 'Attempting to discard 999999 litres of milk',
      items: [{ itemId: milkItem.id, quantity: 999999.0 }],
      actorId: user.id
    });
  } catch (err: any) {
    insufficientStockFailed = true;
    console.log(`✅ Correctly rejected excessive wastage quantity: "${err.message}"`);
  }
  if (!insufficientStockFailed) {
    throw new Error('Excessive wastage quantity should be rejected by backend');
  }

  // 5.2 Invalid Zero / Negative Quantity Validation
  let invalidQtyFailed = false;
  try {
    await WastageService.recordWastage({
      companyId: company.id,
      branchId: branch.id,
      warehouseId: warehouse.id,
      wastageType: 'WRONG_PREPARATION',
      reason: 'Negative quantity test',
      items: [{ itemId: milkItem.id, quantity: -5.0 }],
      actorId: user.id
    });
  } catch (err: any) {
    invalidQtyFailed = true;
    console.log(`✅ Correctly rejected negative wastage quantity: "${err.message}"`);
  }
  if (!invalidQtyFailed) {
    throw new Error('Negative wastage quantity should be rejected');
  }

  // 5.3 Empty Items Validation
  let emptyItemsFailed = false;
  try {
    await WastageService.recordWastage({
      companyId: company.id,
      branchId: branch.id,
      warehouseId: warehouse.id,
      wastageType: 'EXPIRED',
      reason: 'Empty items list',
      items: [],
      actorId: user.id
    });
  } catch (err: any) {
    emptyItemsFailed = true;
    console.log(`✅ Correctly rejected empty wastage item submission: "${err.message}"`);
  }
  if (!emptyItemsFailed) {
    throw new Error('Empty wastage item array should be rejected');
  }

  console.log('\n🎉 ALL PART 12 WASTAGE & LOSS CONTROL TESTS (INCLUDING SECTION 50 CHECKS) PASSED!');
}

runPart12Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
