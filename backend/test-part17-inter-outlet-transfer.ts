import { prisma } from './src/config/database';
import { InventoryService } from './src/services/inventory.service';
import { Prisma } from '@prisma/client';

async function runPart17Tests() {
  console.log('🧪 Starting PART 17 — Multi-Stage Inter-Outlet Stock Transfer Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  if (branches.length < 1) throw new Error('Need at least 1 branch');

  // Setup / Find two distinct warehouses (e.g. Central Warehouse / Main Kitchen and Outlet Store)
  const warehouses = await prisma.warehouse.findMany({ where: { companyId: company.id } });
  if (warehouses.length < 2) {
    // Create secondary warehouse if only one exists
    const secondaryWh = await prisma.warehouse.create({
      data: {
        companyId: company.id,
        branchId: branches[0].id,
        name: 'Express Outlet Secondary Kitchen Store',
        code: `WH-OUTLET-${Date.now()}`,
        isCentral: false
      }
    });
    warehouses.push(secondaryWh);
  }

  const sourceWarehouse = warehouses[0];
  const destWarehouse = warehouses[1];

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  const gheeItem = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'RM-DESI-GHEE' }
  });
  if (!gheeItem) throw new Error('Ghee raw material missing');

  // Baseline stocking in source warehouse: 100 KG Ghee
  await InventoryService.adjustStock({
    companyId: company.id,
    warehouseId: sourceWarehouse.id,
    itemId: gheeItem.id,
    newQuantity: 100.0,
    reason: 'Inter-outlet transfer test baseline source stock',
    actorId: user.id
  });

  const initialDestStock = (await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: destWarehouse.id, itemId: gheeItem.id } }
  }))?.quantity || new Prisma.Decimal(0);

  // ==========================================
  // TEST 1: Transfer Requisition (Destination Requests Stock)
  // ==========================================
  console.log('\n--- TEST 1: Transfer Requisition (Destination Requests 50 KG Ghee) ---');
  
  const reqTransfer = await InventoryService.requestStockTransfer({
    companyId: company.id,
    fromWarehouseId: sourceWarehouse.id,
    toWarehouseId: destWarehouse.id,
    notes: 'Urgent stock replenishment for weekend dinner service',
    actorId: user.id,
    items: [
      {
        itemId: gheeItem.id,
        quantity: 50.0,
        notes: 'Pure Cow Desi Ghee 50 KG'
      }
    ]
  });

  console.log(`✅ Transfer Requisition Created: #${reqTransfer.transferNumber}`);
  console.log(`   From:   ${reqTransfer.fromWarehouse.name}`);
  console.log(`   To:     ${reqTransfer.toWarehouse.name}`);
  console.log(`   Status: ${reqTransfer.status}`);
  console.log(`   Notes:  ${reqTransfer.notes}`);

  if (reqTransfer.status !== 'PENDING') {
    throw new Error(`Expected transfer status PENDING, got ${reqTransfer.status}`);
  }

  // Verify source stock is NOT debited during request stage
  const sourceStockReqStage = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: sourceWarehouse.id, itemId: gheeItem.id } }
  });
  console.log(`✅ Source Stock during Request Stage: ${sourceStockReqStage?.quantity} KG (Unchanged: 100)`);
  if (!sourceStockReqStage?.quantity.equals(new Prisma.Decimal(100.0))) {
    throw new Error('Source stock was prematurely deducted during transfer requisition stage');
  }

  // ==========================================
  // TEST 2: Pick & Dispatch (In-Transit Stage)
  // ==========================================
  console.log('\n--- TEST 2: Pick & Dispatch (In-Transit Stage) ---');
  
  const dispatchedTransfer = await InventoryService.dispatchStockTransfer({
    companyId: company.id,
    transferId: reqTransfer.id,
    actorId: user.id
  });

  console.log(`✅ Stock Transfer Dispatched: #${dispatchedTransfer.transferNumber}`);
  console.log(`   Notes: ${dispatchedTransfer.notes}`);

  // Verify source stock is debited by 50 KG (100 -> 50)
  const sourceStockAfterDispatch = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: sourceWarehouse.id, itemId: gheeItem.id } }
  });
  console.log(`✅ Source Stock after Dispatch: ${sourceStockAfterDispatch?.quantity} KG (Expected: 50)`);
  if (!sourceStockAfterDispatch?.quantity.equals(new Prisma.Decimal(50.0))) {
    throw new Error(`Source stock mismatch after dispatch: Expected 50, got ${sourceStockAfterDispatch?.quantity}`);
  }

  // Verify destination stock has NOT yet received the goods (still in transit)
  const destStockInTransit = (await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: destWarehouse.id, itemId: gheeItem.id } }
  }))?.quantity || new Prisma.Decimal(0);
  console.log(`✅ Destination Stock during In-Transit: ${destStockInTransit} KG (Unchanged: ${initialDestStock})`);
  if (!destStockInTransit.equals(initialDestStock)) {
    throw new Error('Destination stock was prematurely incremented while goods were in transit');
  }

  // Verify TRANSFER_OUT immutable ledger movement
  const dispatchLedger = await prisma.stockLedger.findFirst({
    where: { referenceId: reqTransfer.id, movementType: 'TRANSFER_OUT' }
  });
  console.log(`✅ StockLedger Dispatch Movement: ${dispatchLedger?.movementType} | ${dispatchLedger?.changeQty} KG`);
  if (!dispatchLedger?.changeQty.equals(new Prisma.Decimal(-50.0))) {
    throw new Error(`TRANSFER_OUT changeQty mismatch: Expected -50, got ${dispatchLedger?.changeQty}`);
  }

  // ==========================================
  // TEST 3: Destination Receiving & Reconciliation with Transit Loss
  // ==========================================
  console.log('\n--- TEST 3: Destination Receiving & Reconciliation (48 KG Accepted, 2 KG Transit Damage Loss) ---');
  
  // 50 KG Dispatched -> 48 KG Accepted, 2 KG damaged in transit (tin leakage)
  const receiveRes = await InventoryService.receiveAndReconcileTransfer({
    companyId: company.id,
    transferId: reqTransfer.id,
    notes: 'Received with 1 damaged 2KG tin container',
    actorId: user.id,
    receivedItems: [
      {
        itemId: gheeItem.id,
        acceptedQty: 48.0, // 48 KG Accepted
        transitLossQty: 2.0, // 2 KG Transit Damage Loss @ $650/KG = $1,300
        batchNumber: 'LOT-TRF-001',
        notes: 'Dented container leaked during rough mountain road transit'
      }
    ]
  });

  console.log(`✅ Transfer Reconciled & Completed: #${receiveRes.transfer.transferNumber}`);
  console.log(`   Final Status:       ${receiveRes.status}`);
  console.log(`   Transit Loss Value: $${receiveRes.totalTransitLossValue}`);

  // Verify destination stock received exactly 48 KG
  const destStockFinal = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: destWarehouse.id, itemId: gheeItem.id } }
  });
  const expectedDestFinal = initialDestStock.plus(new Prisma.Decimal(48.0));
  console.log(`✅ Destination Stock after Receiving: ${destStockFinal?.quantity} KG (Expected: ${expectedDestFinal})`);
  if (!destStockFinal?.quantity.equals(expectedDestFinal)) {
    throw new Error(`Destination stock mismatch: Expected ${expectedDestFinal}, got ${destStockFinal?.quantity}`);
  }

  // Verify TRANSFER_IN ledger entry (+48 KG)
  const receiveLedger = await prisma.stockLedger.findFirst({
    where: { referenceId: reqTransfer.id, movementType: 'TRANSFER_IN' }
  });
  console.log(`✅ StockLedger Inward Movement: +${receiveLedger?.changeQty} KG`);
  if (!receiveLedger?.changeQty.equals(new Prisma.Decimal(48.0))) {
    throw new Error(`TRANSFER_IN changeQty mismatch: Expected +48, got ${receiveLedger?.changeQty}`);
  }

  // Verify TRANSIT_LOSS adjustment ledger entry (-2 KG)
  const lossLedger = await prisma.stockLedger.findFirst({
    where: { referenceId: reqTransfer.id, referenceType: 'TRANSIT_LOSS' }
  });
  const expectedLossCost = 2.0 * Number(gheeItem.costPrice);
  if (!lossLedger || Number(lossLedger.totalCost) !== expectedLossCost) {
    throw new Error(`Transit loss ledger cost mismatch: Expected ${expectedLossCost}, got ${lossLedger?.totalCost}`);
  }

  // Verify GL Transit Loss Journal Entry
  const lossJournal = await prisma.journalEntry.findFirst({
    where: { referenceId: reqTransfer.id, referenceType: 'STOCK_TRANSIT_LOSS' }
  });
  console.log(`✅ General Ledger Transit Loss Journal: #${lossJournal?.entryNumber} (Total: $${lossJournal?.totalDebit})`);

  console.log('\n🎉 ALL PART 17 INTER-OUTLET TRANSFER TESTS PASSED!');
}

runPart17Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
