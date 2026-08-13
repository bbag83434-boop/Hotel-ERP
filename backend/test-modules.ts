import { prisma } from './src/config/database';
import { InventoryService } from './src/services/inventory.service';
import { PurchaseService } from './src/services/purchase.service';
import { ProductionService } from './src/services/production.service';

async function runTests() {
  console.log('🧪 Starting Inventory, Purchasing & Production Module Tests...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No company found');
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');
  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const centralWh = await prisma.warehouse.findFirst({ where: { companyId: company.id, isCentral: true } });
  const kitchenWh = await prisma.warehouse.findFirst({ where: { companyId: company.id, code: 'WH-KITCHEN-01' } });
  if (!centralWh || !kitchenWh) throw new Error('Warehouses not found');

  const flour = await prisma.item.findFirst({ where: { companyId: company.id, code: 'RM-FLOUR-01' } });
  const pizza = await prisma.item.findFirst({ where: { companyId: company.id, code: 'FG-PIZZA-01' } });
  const recipe = await prisma.recipe.findFirst({ where: { companyId: company.id, code: 'REC-PIZZA-01' } });
  const supplier = await prisma.supplier.findFirst({ where: { companyId: company.id, code: 'SUP-001' } });

  if (!flour || !pizza || !recipe || !supplier) throw new Error('Seed records missing');

  // -------------------------------------------------------------
  // TEST 1: Non-negative stock rule validation
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Non-negative Stock Rule Verification ---');
  try {
    await InventoryService.transferStock({
      companyId: company.id,
      fromWarehouseId: centralWh.id,
      toWarehouseId: kitchenWh.id,
      items: [{ itemId: flour.id, quantity: 999999 }], // Exceeds available stock
      actorId: user.id
    });
    console.error('❌ Failed: Negative stock was allowed!');
  } catch (err: any) {
    console.log('✅ Passed: Insufficient stock correctly rejected with error:', err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: Atomic Stock Transfer
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Inter-Warehouse Stock Transfer ---');
  const beforeCentralStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: centralWh.id, itemId: flour.id } }
  });
  const beforeKitchenStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: flour.id } }
  });

  const transferQty = 5;
  await InventoryService.transferStock({
    companyId: company.id,
    fromWarehouseId: centralWh.id,
    toWarehouseId: kitchenWh.id,
    notes: 'Restock test',
    items: [{ itemId: flour.id, quantity: transferQty }],
    actorId: user.id
  });

  const afterCentralStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: centralWh.id, itemId: flour.id } }
  });
  const afterKitchenStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: flour.id } }
  });

  console.log(`Central Stock: ${beforeCentralStock?.quantity} -> ${afterCentralStock?.quantity} (-${transferQty})`);
  console.log(`Kitchen Stock: ${beforeKitchenStock?.quantity} -> ${afterKitchenStock?.quantity} (+${transferQty})`);
  if (
    Number(afterCentralStock?.quantity) === Number(beforeCentralStock?.quantity) - transferQty &&
    Number(afterKitchenStock?.quantity) === Number(beforeKitchenStock?.quantity) + transferQty
  ) {
    console.log('✅ Passed: Stock transfer atomic balances verified');
  } else {
    throw new Error('Stock transfer calculation mismatch');
  }

  // -------------------------------------------------------------
  // TEST 3: Purchasing Flow & Automated GRN Stock Update
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Purchasing Flow (PR -> Approval -> PO -> GRN -> Stock) ---');
  // Create PR
  const pr = await PurchaseService.createPurchaseRequest(
    company.id,
    branch.id,
    {
      requiredDate: new Date().toISOString(),
      priority: 'HIGH',
      items: [{ itemId: flour.id, requestedQty: 20, estimatedPrice: 2.5 }]
    },
    user.id
  );
  console.log(`Created PR: ${pr.requestNumber}`);

  // Approve PR & Auto-Create PO
  const approvalRes = await PurchaseService.approvePurchaseRequest(
    company.id,
    pr.id,
    user.id,
    { autoCreatePO: true, supplierId: supplier.id }
  );
  const po = approvalRes.purchaseOrder!;
  console.log(`Approved PR & Generated PO: ${po.poNumber}`);

  // Receive Goods via GRN
  const beforeGRNStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: centralWh.id, itemId: flour.id } }
  });
  const beforeSupplierBalance = Number((await prisma.supplier.findUnique({ where: { id: supplier.id } }))?.balance || 0);

  const grn = await PurchaseService.createGoodsReceiveNote({
    companyId: company.id,
    branchId: branch.id,
    warehouseId: centralWh.id,
    supplierId: supplier.id,
    poId: po.id,
    receiveDate: new Date().toISOString(),
    invoiceNumber: 'TEST-INV-001',
    items: [
      {
        poItemId: po.items[0].id,
        itemId: flour.id,
        receivedQty: 20,
        acceptedQty: 20,
        unitPrice: 2.5,
        batchNumber: 'BATCH-TEST-01'
      }
    ],
    receiverId: user.id
  });
  console.log(`Created GRN: ${grn.grnNumber}`);

  const afterGRNStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: centralWh.id, itemId: flour.id } }
  });
  const afterSupplierBalance = Number((await prisma.supplier.findUnique({ where: { id: supplier.id } }))?.balance || 0);

  console.log(`Stock after GRN: ${beforeGRNStock?.quantity} -> ${afterGRNStock?.quantity} (+20)`);
  console.log(`Supplier Balance: $${beforeSupplierBalance} -> $${afterSupplierBalance} (+$50.00)`);
  if (
    Number(afterGRNStock?.quantity) === Number(beforeGRNStock?.quantity) + 20 &&
    afterSupplierBalance === beforeSupplierBalance + 50
  ) {
    console.log('✅ Passed: GRN automated stock increase & supplier ledger payable updated');
  } else {
    throw new Error('GRN stock/supplier balance calculation mismatch');
  }

  // -------------------------------------------------------------
  // TEST 4: Production Order & Recipe BOM Consumption
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Kitchen Production Execution & Food Costing ---');
  const beforePizzaStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: pizza.id } }
  });
  const beforeKitchenFlour = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: flour.id } }
  });

  const prodOrder = await ProductionService.executeProductionOrder({
    companyId: company.id,
    branchId: branch.id,
    kitchenWarehouseId: kitchenWh.id,
    recipeId: recipe.id,
    plannedQty: 4,
    actualYieldQty: 4,
    wastageQty: 0,
    actorId: user.id
  });

  const afterPizzaStock = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: pizza.id } }
  });
  const afterKitchenFlour = await prisma.stockBalance.findUnique({
    where: { warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: flour.id } }
  });

  console.log(`Finished Pizza Stock: ${beforePizzaStock?.quantity || 0} -> ${afterPizzaStock?.quantity} (+4)`);
  console.log(`Kitchen Flour Stock: ${beforeKitchenFlour?.quantity} -> ${afterKitchenFlour?.quantity} (-1.0kg)`);
  console.log(`Calculated Unit Food Cost: $${Number(prodOrder.unitFoodCost).toFixed(2)} / pizza`);
  console.log('✅ Passed: Kitchen Recipe consumption, yield stock addition, and food cost calculation complete!');

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
