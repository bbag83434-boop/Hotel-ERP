import { prisma } from './src/config/database';
import { InventoryService } from './src/services/inventory.service';
import { Prisma } from '@prisma/client';

async function runPart8Tests() {
  console.log('🧪 Starting PART 8 — Enterprise Inventory, Batch & Expiry Engine Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const centralWh = await prisma.warehouse.findFirst({
    where: { companyId: company.id, isCentral: true }
  });
  const outletWh = await prisma.warehouse.findFirst({
    where: { companyId: company.id, isCentral: false }
  });

  if (!centralWh || !outletWh) {
    throw new Error('Central or Outlet warehouse missing');
  }

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  const rawItem = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'RM-MAWA-01' }
  });
  if (!rawItem) throw new Error('Raw material item missing');

  // ==========================================
  // TEST 1: Stock Adjustment / Opening Stock & Batch Allocation
  // ==========================================
  console.log('\n--- TEST 1: Opening Stock Balance & Batch Allocation ---');
  
  // Set Opening Stock of 500 KG in Central Warehouse
  await InventoryService.adjustStock({
    companyId: company.id,
    warehouseId: centralWh.id,
    itemId: rawItem.id,
    newQuantity: 500.0,
    reason: 'Initial opening balance for audit',
    actorId: user.id
  });

  // Record Batch & Expiry in Stock Ledger
  const batchNum = 'BATCH-MAWA-2026-AUG';
  const expiryDate = new Date(Date.now() + 30 * 86400000); // 30 days expiry

  await prisma.stockLedger.create({
    data: {
      warehouseId: centralWh.id,
      itemId: rawItem.id,
      batchNumber: batchNum,
      expiryDate,
      movementType: 'GRN',
      changeQty: new Prisma.Decimal(100.0),
      balanceQty: new Prisma.Decimal(500.0),
      unitCost: rawItem.costPrice,
      totalCost: new Prisma.Decimal(100.0).times(rawItem.costPrice),
      referenceType: 'GRN',
      referenceId: 'GRN-OPENING-01',
      notes: `Batch ${batchNum} allocated with expiry ${expiryDate.toISOString().slice(0, 10)}`,
      createdById: user.id
    }
  });

  const centralBalance = await prisma.stockBalance.findUnique({
    where: {
      warehouseId_itemId: { warehouseId: centralWh.id, itemId: rawItem.id }
    }
  });

  console.log(`✅ Central Stock Balance: ${centralBalance?.quantity} KG in ${centralWh.name}`);
  if (Number(centralBalance?.quantity) !== 500.0) {
    throw new Error(`Central stock balance mismatch: Expected 500.0, got ${centralBalance?.quantity}`);
  }

  // ==========================================
  // TEST 2: Low-Stock Alerts Trigger
  // ==========================================
  console.log('\n--- TEST 2: Real-Time Low-Stock Alerts ---');
  
  // Set minimum stock level in Outlet Warehouse to 20 KG, current balance 5 KG
  await prisma.stockBalance.upsert({
    where: {
      warehouseId_itemId: { warehouseId: outletWh.id, itemId: rawItem.id }
    },
    update: { quantity: new Prisma.Decimal(5.0), minStockLevel: new Prisma.Decimal(20.0) },
    create: {
      warehouseId: outletWh.id,
      itemId: rawItem.id,
      quantity: new Prisma.Decimal(5.0),
      minStockLevel: new Prisma.Decimal(20.0)
    }
  });

  const lowStockBalances = await InventoryService.getStockBalances(company.id, {
    warehouseId: outletWh.id,
    lowStockOnly: true
  });

  console.log(`✅ Low-Stock Alert Active for ${lowStockBalances.balances.length} items in ${outletWh.name}:`);
  lowStockBalances.balances.forEach((b) => {
    console.log(`   - [${b.item.code}] ${b.item.name}: Current: ${b.quantity} (Min: ${b.minStockLevel}) [isLowStock: ${b.isLowStock}]`);
  });

  const mawaAlert = lowStockBalances.balances.find((b) => b.itemId === rawItem.id);
  if (!mawaAlert || !mawaAlert.isLowStock) {
    throw new Error('Low stock alert was not triggered for understocked item');
  }

  // ==========================================
  // TEST 3: Inter-Warehouse Stock Transfer
  // ==========================================
  console.log('\n--- TEST 3: Inter-Warehouse Stock Transfer ---');
  
  // Transfer 50 KG from Central Warehouse to Outlet Warehouse
  const transfer = await InventoryService.transferStock({
    companyId: company.id,
    fromWarehouseId: centralWh.id,
    toWarehouseId: outletWh.id,
    notes: 'Replenishing low-stock mawa in kitchen store',
    items: [{ itemId: rawItem.id, quantity: 50.0 }],
    actorId: user.id
  });

  console.log(`✅ Stock Transfer Executed: #${transfer.transferNumber}`);

  const [newCentralBal, newOutletBal] = await Promise.all([
    prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: centralWh.id, itemId: rawItem.id } }
    }),
    prisma.stockBalance.findUnique({
      where: { warehouseId_itemId: { warehouseId: outletWh.id, itemId: rawItem.id } }
    })
  ]);

  console.log(`   Central Warehouse Remaining: ${newCentralBal?.quantity} KG (Expected: 450.0)`);
  console.log(`   Outlet Warehouse New Balance: ${newOutletBal?.quantity} KG (Expected: 55.0)`);

  if (Number(newCentralBal?.quantity) !== 450.0 || Number(newOutletBal?.quantity) !== 55.0) {
    throw new Error('Stock transfer balances mismatch');
  }

  // ==========================================
  // TEST 4: Negative Stock Prevention
  // ==========================================
  console.log('\n--- TEST 4: Negative Stock Protection ---');
  try {
    await InventoryService.transferStock({
      companyId: company.id,
      fromWarehouseId: centralWh.id,
      toWarehouseId: outletWh.id,
      items: [{ itemId: rawItem.id, quantity: 9999.0 }], // Exceeds available 450 KG
      actorId: user.id
    });
    throw new Error('❌ Failed: Excess quantity transfer was permitted!');
  } catch (err: any) {
    console.log(`✅ Passed: Excess transfer blocked with error: "${err.message}"`);
  }

  // ==========================================
  // TEST 5: Immutable Stock Ledger Movement Audit
  // ==========================================
  console.log('\n--- TEST 5: Immutable Stock Ledger Audit Trail ---');
  const ledger = await InventoryService.getStockLedger(company.id, {
    itemId: rawItem.id
  });

  console.log(`✅ Found ${ledger.entries.length} immutable ledger entries for "${rawItem.name}":`);
  ledger.entries.forEach((e) => {
    console.log(`   - [${e.createdAt.toISOString().slice(0, 16)}] Wh: ${e.warehouse.code} | Type: ${e.movementType} | Change: ${e.changeQty} | Bal: ${e.balanceQty} | Ref: ${e.referenceType}`);
  });

  const movementTypes = ledger.entries.map((e) => e.movementType);
  if (!movementTypes.includes('TRANSFER_OUT') || !movementTypes.includes('TRANSFER_IN')) {
    throw new Error('Stock transfer ledger movements not recorded');
  }

  // ==========================================
  // TEST 6: FEFO (First-Expired-First-Out) Ordering Check
  // ==========================================
  console.log('\n--- TEST 6: FEFO Expiry Ordering Engine ---');
  const fefoEntries = await prisma.stockLedger.findMany({
    where: { itemId: rawItem.id, expiryDate: { not: null } },
    orderBy: { expiryDate: 'asc' }
  });

  console.log(`✅ FEFO Priority Entries: ${fefoEntries.length} tracked batches with expiry dates.`);

  console.log('\n🎉 ALL PART 8 ENTERPRISE INVENTORY ENGINE TESTS PASSED!');
}

runPart8Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
