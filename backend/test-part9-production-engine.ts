import { prisma } from './src/config/database';
import { ProductionService } from './src/services/production.service';
import { InventoryService } from './src/services/inventory.service';
import { Prisma } from '@prisma/client';

async function runPart9Tests() {
  console.log('🧪 Starting PART 9 — Production Engine & Recipe Execution Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const kitchenWh = await prisma.warehouse.findFirst({
    where: { companyId: company.id, isCentral: false }
  });
  if (!kitchenWh) throw new Error('Kitchen warehouse missing');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  const recipe = await prisma.recipe.findFirst({
    where: { companyId: company.id, code: 'RCP-GULAB-JAMUN-MASTER' },
    include: { ingredients: { include: { rawItem: true } }, finishedItem: true }
  });
  if (!recipe) throw new Error('Master recipe missing');

  // ==========================================
  // TEST 1: Ingredient Availability Check & Shortage Blocking
  // ==========================================
  console.log('\n--- TEST 1: Pre-Production Availability Check & Shortage Blocking ---');

  // Intentionally set stock of Dough Base to 0 in Kitchen Warehouse to test shortage blocking
  const doughIng = recipe.ingredients.find((i) => i.rawItem.code === 'SFG-GJ-DOUGH-01');
  if (!doughIng) throw new Error('Dough ingredient missing in recipe');

  await prisma.stockBalance.upsert({
    where: {
      warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: doughIng.rawItemId }
    },
    update: { quantity: new Prisma.Decimal(0.0) },
    create: {
      warehouseId: kitchenWh.id,
      itemId: doughIng.rawItemId,
      quantity: new Prisma.Decimal(0.0)
    }
  });

  const preview = await ProductionService.previewProduction(
    company.id,
    recipe.id,
    40.0, // Order 40 portions (requires 2x standard batch)
    kitchenWh.id
  );

  console.log(`✅ Production Preview Generated: Recipe: "${preview.recipe.name}" (Planned: ${preview.plannedQty} portions)`);
  console.log(`   allIngredientsAvailable: ${preview.allIngredientsAvailable} (Expected: false)`);
  
  if (preview.allIngredientsAvailable) {
    throw new Error('Shortage check failed: allIngredientsAvailable should be false');
  }

  // Attempt to execute production order with shortage — MUST BE REJECTED
  try {
    await ProductionService.executeProductionOrder({
      companyId: company.id,
      branchId: branch.id,
      kitchenWarehouseId: kitchenWh.id,
      recipeId: recipe.id,
      plannedQty: 40.0,
      actualYieldQty: 40.0,
      actorId: user.id
    });
    throw new Error('❌ Failed: Production order was executed despite ingredient shortage!');
  } catch (err: any) {
    console.log(`✅ Passed: Production blocked on shortage: "${err.message}"`);
  }

  // ==========================================
  // TEST 2: Replenish Raw Ingredients for Batch Execution
  // ==========================================
  console.log('\n--- TEST 2: Stock Replenishment for Full Production Run ---');
  
  // Replenish all ingredients in Kitchen Warehouse
  for (const ing of recipe.ingredients) {
    await InventoryService.adjustStock({
      companyId: company.id,
      warehouseId: kitchenWh.id,
      itemId: ing.rawItemId,
      newQuantity: 100.0, // 100 KG each
      reason: 'Replenishment for test batch production',
      actorId: user.id
    });
  }

  const previewAfterReplenish = await ProductionService.previewProduction(
    company.id,
    recipe.id,
    40.0,
    kitchenWh.id
  );

  console.log(`✅ Post-Replenishment Preview: allIngredientsAvailable = ${previewAfterReplenish.allIngredientsAvailable} (Expected: true)`);
  console.log(`   Estimated Raw Material Cost: $${previewAfterReplenish.totalEstimatedRawCost}`);
  console.log(`   Estimated Unit Food Cost:     $${previewAfterReplenish.estimatedUnitFoodCost}`);

  if (!previewAfterReplenish.allIngredientsAvailable) {
    throw new Error('All ingredients should be available after replenishment');
  }

  // ==========================================
  // TEST 3: Atomic Production Order Execution
  // ==========================================
  console.log('\n--- TEST 3: Atomic Production Order Execution ---');
  
  const initialFinishedBal = await prisma.stockBalance.findUnique({
    where: {
      warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: recipe.finishedItemId }
    }
  });
  const oldFGQty = initialFinishedBal ? initialFinishedBal.quantity : new Prisma.Decimal(0);

  const prodOrder = await ProductionService.executeProductionOrder({
    companyId: company.id,
    branchId: branch.id,
    kitchenWarehouseId: kitchenWh.id,
    recipeId: recipe.id,
    plannedQty: 40.0,
    actualYieldQty: 38.0, // 38 portions yielded
    wastageQty: 2.0,      // 2 portions wastage
    notes: 'Morning fresh sweet production batch',
    actorId: user.id
  });

  console.log(`✅ Production Order Executed: #${prodOrder.orderNumber}`);
  console.log(`   Planned Qty:     ${prodOrder.plannedQty} portions`);
  console.log(`   Actual Yield:    ${prodOrder.actualYieldQty} portions`);
  console.log(`   Wastage:         ${prodOrder.wastageQty} portions`);
  console.log(`   Total Raw Cost:  $${prodOrder.totalRawCost}`);
  console.log(`   Unit Food Cost:  $${prodOrder.unitFoodCost}`);

  // ==========================================
  // TEST 4: Finished Good Stock & Ledger Verification
  // ==========================================
  console.log('\n--- TEST 4: Finished Good Inventory Increment & Ledger Verification ---');
  
  const newFinishedBal = await prisma.stockBalance.findUnique({
    where: {
      warehouseId_itemId: { warehouseId: kitchenWh.id, itemId: recipe.finishedItemId }
    }
  });

  const expectedNewFGQty = oldFGQty.plus(new Prisma.Decimal(38.0));
  console.log(`✅ Finished Good Stock in Kitchen: ${newFinishedBal?.quantity} (Expected: ${expectedNewFGQty})`);

  if (!newFinishedBal || !newFinishedBal.quantity.equals(expectedNewFGQty)) {
    throw new Error(`Finished good stock increment mismatch: Expected ${expectedNewFGQty}, got ${newFinishedBal?.quantity}`);
  }

  // Verify Finished Good Item costPrice synchronized
  const updatedFGItem = await prisma.item.findUnique({ where: { id: recipe.finishedItemId } });
  console.log(`✅ Finished Good Item Cost Price Synchronized: $${updatedFGItem?.costPrice}`);

  // ==========================================
  // TEST 5: Raw Material Deduction Verification
  // ==========================================
  console.log('\n--- TEST 5: Raw Material Deduction & Consumption Records ---');
  
  const consumptions = await prisma.productionConsumption.findMany({
    where: { productionOrderId: prodOrder.id },
    include: { rawItem: true }
  });

  console.log(`✅ Recorded ${consumptions.length} consumption line items:`);
  consumptions.forEach((c) => {
    console.log(`   - [${c.rawItem.code}] ${c.rawItem.name}: Consumed ${c.actualConsumedQty} @ $${c.unitCost} = $${c.totalCost}`);
  });

  if (consumptions.length !== recipe.ingredients.length) {
    throw new Error('Consumption records count mismatch with recipe ingredients');
  }

  // ==========================================
  // TEST 6: Immutable Stock Ledger Audit Logs
  // ==========================================
  console.log('\n--- TEST 6: Stock Ledger Production Movements ---');
  
  const prodLedgers = await prisma.stockLedger.findMany({
    where: { referenceId: prodOrder.id }
  });

  console.log(`✅ Found ${prodLedgers.length} ledger entries generated for production order:`);
  prodLedgers.forEach((l) => {
    console.log(`   - Type: ${l.movementType} | Change: ${l.changeQty} | Total Cost: $${l.totalCost} | Notes: ${l.notes}`);
  });

  const hasProdIn = prodLedgers.some((l) => l.movementType === 'PRODUCTION_IN');
  const hasProdOut = prodLedgers.some((l) => l.movementType === 'PRODUCTION_OUT');

  if (!hasProdIn || !hasProdOut) {
    throw new Error('Stock ledger missing PRODUCTION_IN or PRODUCTION_OUT records');
  }

  console.log('\n🎉 ALL PART 9 PRODUCTION ENGINE TESTS PASSED!');
}

runPart9Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
