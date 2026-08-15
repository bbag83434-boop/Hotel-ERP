import { prisma } from './src/config/database';
import { PurchaseService } from './src/services/purchase.service';
import { InventoryService } from './src/services/inventory.service';
import { Prisma } from '@prisma/client';

async function runPart15Tests() {
  console.log('🧪 Starting PART 15 — Quality Control (QC) & Supplier Returns Test Suite...');

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

  const supplier = await prisma.supplier.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!supplier) throw new Error('Supplier missing');

  const milkItem = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'RM-MILK-FULL' }
  });
  if (!milkItem) throw new Error('Milk raw material missing');

  // ==========================================
  // TEST 1: Partial Acceptance QC Inspection
  // ==========================================
  console.log('\n--- TEST 1: Partial Acceptance QC Inspection (Packaging/Damage Check) ---');
  
  const initialStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  });
  const milkStockBefore = initialStock ? initialStock.quantity : new Prisma.Decimal(0);

  // Delivered 50 Litres: 40 Litres Passed QC @ 3°C, 10 Litres Failed QC due to cracked crate leakage
  const partialQCGrn = await PurchaseService.createGoodsReceiveNote({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    supplierId: supplier.id,
    invoiceNumber: `INV-QC-PARTIAL-${Date.now()}`,
    invoiceAmount: 2600.0, // 40 L accepted @ $65 = $2,600
    receiverId: user.id,
    notes: 'QC Inspection: 1 crate of 10L damaged during transit, rejected at dock',
    items: [
      {
        itemId: milkItem.id,
        receivedQty: 50.0,
        acceptedQty: 40.0, // Only 40L accepted
        rejectedQty: 10.0, // 10L rejected
        unitPrice: 65.0,
        batchNumber: 'LOT-MILK-QC-01',
        expiryDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        qcStatus: 'PASSED',
        qcNotes: 'Temp: 3°C (OK). 10L rejected due to torn seals and carton crushing.'
      }
    ]
  });

  console.log(`✅ GRN with Partial QC Created: #${partialQCGrn.grnNumber} (Status: ${partialQCGrn.status})`);
  
  // Verify that ONLY accepted quantity (40L) was added to usable warehouse stock
  const milkStockAfter = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  });
  const expectedStock = milkStockBefore.plus(new Prisma.Decimal(40.0));
  console.log(`✅ Usable Stock Balance: ${milkStockAfter?.quantity} L (Expected: ${expectedStock})`);

  if (!milkStockAfter?.quantity.equals(expectedStock)) {
    throw new Error(`Stock mismatch: Rejected stock was improperly added! Expected ${expectedStock}, got ${milkStockAfter?.quantity}`);
  }

  // Verify stock ledger movement shows exactly +40L (never +50L)
  const ledgerEntry = await prisma.stockLedger.findFirst({
    where: { referenceId: partialQCGrn.id, itemId: milkItem.id }
  });
  console.log(`✅ StockLedger Inward Movement: +${ledgerEntry?.changeQty} L (Expected: +40)`);
  if (!ledgerEntry?.changeQty.equals(new Prisma.Decimal(40.0))) {
    throw new Error(`Ledger changeQty mismatch: Expected +40, got ${ledgerEntry?.changeQty}`);
  }

  // ==========================================
  // TEST 2: Complete QC Rejection (100% Rejected Stock)
  // ==========================================
  console.log('\n--- TEST 2: Total QC Rejection (Temperature Violation / Spoiled Delivery) ---');
  
  const stockBeforeFail = (await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  }))?.quantity || new Prisma.Decimal(0);

  // Delivered 100 Litres at 18°C (Cold chain failure -> 100% Rejected, 0 Accepted)
  const failedQCGrn = await PurchaseService.createGoodsReceiveNote({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    supplierId: supplier.id,
    invoiceNumber: `INV-QC-FAILED-${Date.now()}`,
    invoiceAmount: 0,
    receiverId: user.id,
    notes: 'CRITICAL QC REJECTION: Milk delivered at 18°C (Max limit 4°C). Entire shipment turned away.',
    items: [
      {
        itemId: milkItem.id,
        receivedQty: 100.0,
        acceptedQty: 0.0,  // 0 Accepted
        rejectedQty: 100.0, // 100 Rejected
        unitPrice: 65.0,
        batchNumber: 'LOT-MILK-HOT-01',
        qcStatus: 'FAILED',
        qcNotes: 'Temperature measured 18.2°C at dock. Souring smell detected. Entire load rejected.'
      }
    ]
  });

  console.log(`✅ Total QC Rejection GRN Created: #${failedQCGrn.grnNumber}`);
  
  // Verify 0 stock was added to warehouse
  const stockAfterFail = (await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  }))?.quantity || new Prisma.Decimal(0);
  console.log(`✅ Stock Balance after 100% Rejection: ${stockAfterFail} L (Unchanged: ${stockBeforeFail})`);

  if (!stockAfterFail.equals(stockBeforeFail)) {
    throw new Error('Rejected shipment leaked into warehouse stock!');
  }

  // ==========================================
  // TEST 3: Post-Receiving Supplier Return & Debit Note
  // ==========================================
  console.log('\n--- TEST 3: Supplier Return & AP Debit Note Generation ---');
  
  // Return 15 Litres from stored inventory to supplier due to hidden quality defects
  const returnRes = await PurchaseService.returnGoodsToSupplier({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: warehouse.id,
    supplierId: supplier.id,
    reason: 'Latent fat separation observed during boiling',
    actorId: user.id,
    items: [
      {
        itemId: milkItem.id,
        returnQty: 15.0,
        unitCost: 65.0,
        batchNumber: 'LOT-MILK-QC-01',
        reason: 'Fat separation defect'
      }
    ]
  });

  console.log(`✅ Supplier Return Processed: Debit Note #${returnRes.debitNoteNumber}`);
  console.log(`   Debit Amount: $${returnRes.totalReturnAmount}`);
  console.log(`   Supplier:     ${returnRes.supplierName}`);

  // Verify stock was decremented by 15L
  const stockAfterReturn = (await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: warehouse.id, itemId: milkItem.id } }
  }))?.quantity;
  const expectedAfterReturn = stockAfterFail.minus(new Prisma.Decimal(15.0));
  console.log(`✅ Warehouse Stock after Return: ${stockAfterReturn} L (Expected: ${expectedAfterReturn})`);

  if (!stockAfterReturn?.equals(expectedAfterReturn)) {
    throw new Error(`Stock decrement mismatch on return: Expected ${expectedAfterReturn}, got ${stockAfterReturn}`);
  }

  // Verify Supplier Ledger has DEBIT note
  const debitEntry = await prisma.supplierLedger.findFirst({
    where: { referenceId: returnRes.debitNoteNumber, transactionType: 'RETURN' }
  });
  console.log(`✅ Supplier Ledger Debit Note: $${debitEntry?.debit} (Description: ${debitEntry?.description})`);
  if (!debitEntry || Number(debitEntry.debit) !== 975.0) { // 15L * $65 = $975
    throw new Error('Supplier ledger was not debited with the return amount');
  }

  console.log('\n🎉 ALL PART 15 QUALITY CONTROL & SUPPLIER RETURNS TESTS PASSED!');
}

runPart15Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
