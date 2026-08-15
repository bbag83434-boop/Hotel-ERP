import { prisma } from './src/config/database';
import { ProductionService } from './src/services/production.service';
import { Prisma } from '@prisma/client';

async function runPart7Tests() {
  console.log('🧪 Starting PART 7 — Recipe / BOM Engine Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  // ==========================================
  // TEST 1: Raw Material Ingredients Setup
  // ==========================================
  console.log('\n--- TEST 1: Raw Ingredients Setup ---');
  const unitKg = await prisma.unit.findFirst({ where: { companyId: company.id, symbol: 'kg' } });
  const unitLitre = await prisma.unit.findFirst({ where: { companyId: company.id, symbol: 'l' } });
  const unitPcs = await prisma.unit.findFirst({ where: { companyId: company.id, symbol: 'pcs' } });
  const category = await prisma.category.findFirst({ where: { companyId: company.id } });

  if (!unitKg || !unitLitre || !unitPcs || !category) {
    throw new Error('Required unit or category master missing');
  }

  const mawa = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-MAWA-01' } },
    update: { costPrice: 320.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Fresh Cow Milk Mawa (Khoya)',
      code: 'RM-MAWA-01',
      type: 'RAW_MATERIAL',
      costPrice: 320.0, // 320 / kg
      isActive: true
    }
  });

  const paneer = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-PANEER-CRUMB' } },
    update: { costPrice: 280.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Fresh Crumbled Paneer (Chenna)',
      code: 'RM-PANEER-CRUMB',
      type: 'RAW_MATERIAL',
      costPrice: 280.0, // 280 / kg
      isActive: true
    }
  });

  const sugar = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-SUGAR-FINE' } },
    update: { costPrice: 45.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Refined Granulated Cane Sugar',
      code: 'RM-SUGAR-FINE',
      type: 'RAW_MATERIAL',
      costPrice: 45.0, // 45 / kg
      isActive: true
    }
  });

  const ghee = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-DESI-GHEE' } },
    update: { costPrice: 650.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Pure Cow Desi Ghee',
      code: 'RM-DESI-GHEE',
      type: 'RAW_MATERIAL',
      costPrice: 650.0, // 650 / kg
      isActive: true
    }
  });

  console.log(`✅ Raw Ingredients: Mawa ($${mawa.costPrice}/kg), Paneer ($${paneer.costPrice}/kg), Sugar ($${sugar.costPrice}/kg), Ghee ($${ghee.costPrice}/kg)`);

  // ==========================================
  // TEST 2: Sub-Recipe 1 — Dough Base (Semi-Finished Good)
  // ==========================================
  console.log('\n--- TEST 2: Sub-Recipe 1 — Dough Base (Semi-Finished Good) ---');
  const doughItem = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'SFG-GJ-DOUGH-01' } },
    update: { costPrice: 300.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Gulab Jamun Dough Batch Base (Semi-Finished)',
      code: 'SFG-GJ-DOUGH-01',
      type: 'SEMI_FINISHED',
      costPrice: 300.0,
      isActive: true
    }
  });

  // Create Sub-Recipe for Dough: 0.8 kg Mawa + 0.2 kg Paneer = 1 kg Dough
  const doughRecipe = await prisma.recipe.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RCP-DOUGH-01' } },
    update: {},
    create: {
      companyId: company.id,
      finishedItemId: doughItem.id,
      name: 'Gulab Jamun Dough Base Sub-Recipe',
      code: 'RCP-DOUGH-01',
      description: 'Hand-kneaded mawa and fresh chenna base',
      yieldQty: 1.0,
      preparationMinutes: 20,
      instructions: 'Knead mawa and chenna until completely smooth without lumps'
    }
  });

  // Assign ingredients to Dough recipe
  await prisma.recipeItem.deleteMany({ where: { recipeId: doughRecipe.id } });
  await prisma.recipeItem.createMany({
    data: [
      {
        recipeId: doughRecipe.id,
        rawItemId: mawa.id,
        unitId: unitKg.id,
        quantity: new Prisma.Decimal(0.8), // 0.8 * 320 = 256
        costContribution: new Prisma.Decimal(256.0)
      },
      {
        recipeId: doughRecipe.id,
        rawItemId: paneer.id,
        unitId: unitKg.id,
        quantity: new Prisma.Decimal(0.2), // 0.2 * 280 = 56
        costContribution: new Prisma.Decimal(56.0)
      }
    ]
  });

  const doughRecipeDetails = await ProductionService.getRecipeById(company.id, doughRecipe.id);
  console.log(`✅ Sub-Recipe 1 Created: ${doughRecipe.name}`);
  console.log(`   Estimated Batch Cost: $${doughRecipeDetails.estimatedTotalCost} (Unit Cost: $${doughRecipeDetails.estimatedUnitCost}/kg)`);
  
  if (Number(doughRecipeDetails.estimatedTotalCost) !== 312.0) {
    throw new Error(`Dough sub-recipe cost calculation mismatch: Expected 312, got ${doughRecipeDetails.estimatedTotalCost}`);
  }

  // Update Dough item costPrice to match calculated BOM cost
  await prisma.item.update({
    where: { id: doughItem.id },
    data: { costPrice: doughRecipeDetails.estimatedUnitCost }
  });

  // ==========================================
  // TEST 3: Sub-Recipe 2 — Saffron Sugar Syrup (Semi-Finished Good)
  // ==========================================
  console.log('\n--- TEST 3: Sub-Recipe 2 — Sugar Syrup (Semi-Finished Good) ---');
  const syrupItem = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'SFG-SYRUP-01' } },
    update: { costPrice: 45.0 },
    create: {
      companyId: company.id,
      categoryId: category.id,
      unitId: unitKg.id,
      name: 'Cardamom Saffron Sugar Syrup (Semi-Finished)',
      code: 'SFG-SYRUP-01',
      type: 'SEMI_FINISHED',
      costPrice: 45.0,
      isActive: true
    }
  });

  const syrupRecipe = await prisma.recipe.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RCP-SYRUP-01' } },
    update: {},
    create: {
      companyId: company.id,
      finishedItemId: syrupItem.id,
      name: 'Cardamom Saffron Sugar Syrup Sub-Recipe',
      code: 'RCP-SYRUP-01',
      description: 'Single-thread aromatic sugar syrup',
      yieldQty: 1.5, // 1 kg sugar + water = 1.5 kg syrup yield
      preparationMinutes: 15,
      instructions: 'Boil sugar and water until 1-string consistency. Add crushed cardamom.'
    }
  });

  await prisma.recipeItem.deleteMany({ where: { recipeId: syrupRecipe.id } });
  await prisma.recipeItem.createMany({
    data: [
      {
        recipeId: syrupRecipe.id,
        rawItemId: sugar.id,
        unitId: unitKg.id,
        quantity: new Prisma.Decimal(1.0), // 1.0 * 45 = 45
        costContribution: new Prisma.Decimal(45.0)
      }
    ]
  });

  const syrupRecipeDetails = await ProductionService.getRecipeById(company.id, syrupRecipe.id);
  console.log(`✅ Sub-Recipe 2 Created: ${syrupRecipe.name}`);
  console.log(`   Estimated Batch Cost: $${syrupRecipeDetails.estimatedTotalCost} (Unit Cost: $${syrupRecipeDetails.estimatedUnitCost}/kg for yield ${syrupRecipe.yieldQty}kg)`);

  const expectedSyrupUnitCost = 45.0 / 1.5; // 30 / kg
  if (Number(syrupRecipeDetails.estimatedUnitCost) !== expectedSyrupUnitCost) {
    throw new Error(`Syrup unit cost mismatch: Expected ${expectedSyrupUnitCost}, got ${syrupRecipeDetails.estimatedUnitCost}`);
  }

  await prisma.item.update({
    where: { id: syrupItem.id },
    data: { costPrice: syrupRecipeDetails.estimatedUnitCost }
  });

  // ==========================================
  // TEST 4: Master Finished Good Multi-Level Recipe
  // ==========================================
  console.log('\n--- TEST 4: Master Multi-Level Recipe (BOM Roll-Up) ---');
  const masterGulabJamun = await prisma.item.findFirst({
    where: { companyId: company.id, code: 'FG-GULAB-JAMUN-01' }
  });
  if (!masterGulabJamun) throw new Error('Finished good item missing');

  // Master Recipe: Produces 20 portions (40 pieces) of Gulab Jamun
  // Ingredients:
  // - 0.5 kg Dough Base (Sub-recipe item: 0.5 * 312 = 156.0)
  // - 0.75 kg Sugar Syrup (Sub-recipe item: 0.75 * 30 = 22.5)
  // - 0.1 kg Desi Ghee (Raw Ingredient consumed in frying: 0.1 * 650 = 65.0)
  // Total Master Batch Cost = 156.0 + 22.5 + 65.0 = $243.50 for 20 portions = $12.175 / portion

  const masterRecipe = await prisma.recipe.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RCP-GULAB-JAMUN-MASTER' } },
    update: {},
    create: {
      companyId: company.id,
      finishedItemId: masterGulabJamun.id,
      name: 'Royal Heritage Gulab Jamun Master Recipe',
      code: 'RCP-GULAB-JAMUN-MASTER',
      description: 'Signature 2-piece royal portion with rabri garnish option',
      yieldQty: 20.0, // 20 portions
      preparationMinutes: 45,
      instructions: 'Shape balls from dough base, fry in pure desi ghee at 140C until golden brown, soak in warm cardamom syrup.'
    }
  });

  await prisma.recipeItem.deleteMany({ where: { recipeId: masterRecipe.id } });
  await prisma.recipeItem.createMany({
    data: [
      {
        recipeId: masterRecipe.id,
        rawItemId: doughItem.id, // Sub-recipe semi-finished item
        unitId: unitKg.id,
        quantity: new Prisma.Decimal(0.5),
        costContribution: new Prisma.Decimal(156.0)
      },
      {
        recipeId: masterRecipe.id,
        rawItemId: syrupItem.id, // Sub-recipe semi-finished item
        unitId: unitKg.id,
        quantity: new Prisma.Decimal(0.75),
        costContribution: new Prisma.Decimal(22.5)
      },
      {
        recipeId: masterRecipe.id,
        rawItemId: ghee.id, // Raw material
        unitId: unitKg.id,
        quantity: new Prisma.Decimal(0.1),
        costContribution: new Prisma.Decimal(65.0)
      }
    ]
  });

  const masterDetails = await ProductionService.getRecipeById(company.id, masterRecipe.id);
  console.log(`✅ Master Recipe Created: ${masterRecipe.name}`);
  console.log(`   Total Batch Raw Cost: $${masterDetails.estimatedTotalCost}`);
  console.log(`   Yield Portions:        ${masterRecipe.yieldQty} portions`);
  console.log(`   Food Cost Per Portion: $${masterDetails.estimatedUnitCost}`);

  const expectedBatchTotal = 156.0 + 22.5 + 65.0; // 243.5
  if (Math.abs(Number(masterDetails.estimatedTotalCost) - expectedBatchTotal) > 0.01) {
    throw new Error(`Master recipe total cost mismatch: Expected ${expectedBatchTotal}, got ${masterDetails.estimatedTotalCost}`);
  }

  const expectedUnitCost = expectedBatchTotal / 20.0; // 12.175
  if (Math.abs(Number(masterDetails.estimatedUnitCost) - expectedUnitCost) > 0.01) {
    throw new Error(`Master unit cost mismatch: Expected ${expectedUnitCost}, got ${masterDetails.estimatedUnitCost}`);
  }

  // Update finished item cost price
  await prisma.item.update({
    where: { id: masterGulabJamun.id },
    data: { costPrice: masterDetails.estimatedUnitCost }
  });

  // Link master recipe to MenuItem
  await prisma.menuItem.updateMany({
    where: { companyId: company.id, code: 'MI-GULAB-JAMUN' },
    data: {
      recipeId: masterRecipe.id,
      costPrice: masterDetails.estimatedUnitCost
    }
  });

  console.log(`✅ MenuItem "MI-GULAB-JAMUN" linked to Master Recipe #${masterRecipe.code} (Cost: $${masterDetails.estimatedUnitCost})`);

  console.log('\n🎉 ALL PART 7 RECIPE / BOM ENGINE TESTS PASSED!');
}

runPart7Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
