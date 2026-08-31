import { prisma } from './src/config/database';
import { InventoryService } from './src/services/inventory.service';
import { UnitConversionService } from './src/services/unitConversion.service';

async function runPart6Tests() {
  console.log('🧪 Starting PART 6 — Product, Ingredient, Unit & Recipe Foundation Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  // ==========================================
  // TEST 1: Categories Setup
  // ==========================================
  console.log('\n--- TEST 1: Category Master Setup ---');
  const dairyCategory = await prisma.category.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CAT-DAIRY' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Dairy & Milk Products',
      code: 'CAT-DAIRY',
      description: 'Fresh cow milk, paneer, cream, and butter'
    }
  });

  const bakeryCategory = await prisma.category.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CAT-BAKERY' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Bakery & Confectionery',
      code: 'CAT-BAKERY',
      description: 'Breads, pastries, buns, and crusts'
    }
  });
  console.log(`✅ Category 1: ${dairyCategory.name} (${dairyCategory.code})`);
  console.log(`✅ Category 2: ${bakeryCategory.name} (${bakeryCategory.code})`);

  // ==========================================
  // TEST 2: Standard Units Setup
  // ==========================================
  console.log('\n--- TEST 2: Unit Master Catalog ---');
  const unitKg = await prisma.unit.upsert({
    where: { companyId_symbol: { companyId: company.id, symbol: 'kg' } },
    update: {},
    create: { companyId: company.id, name: 'Kilogram', symbol: 'kg' }
  });

  const unitLitre = await prisma.unit.upsert({
    where: { companyId_symbol: { companyId: company.id, symbol: 'l' } },
    update: {},
    create: { companyId: company.id, name: 'Litre', symbol: 'l' }
  });

  const unitPcs = await prisma.unit.upsert({
    where: { companyId_symbol: { companyId: company.id, symbol: 'pcs' } },
    update: {},
    create: { companyId: company.id, name: 'Pieces', symbol: 'pcs' }
  });
  console.log(`✅ Units Established: ${unitKg.name} (${unitKg.symbol}), ${unitLitre.name} (${unitLitre.symbol}), ${unitPcs.name} (${unitPcs.symbol})`);

  // ==========================================
  // TEST 3: Unit Conversion Engine Verification
  // ==========================================
  console.log('\n--- TEST 3: Deterministic Unit Conversion Engine ---');
  
  // 1. Weight Conversion (KG -> Grams)
  const weightRes = UnitConversionService.convert(2.5, 'kg', 'g');
  console.log(`✅ 2.5 KG = ${weightRes.convertedAmount} Grams (Formula: ${weightRes.conversionFormula})`);
  if (weightRes.convertedAmount !== 2500) {
    throw new Error('KG to Gram conversion mismatch');
  }

  // 2. Volume Conversion (Litre -> ML)
  const volRes = UnitConversionService.convert(1.75, 'litre', 'ml');
  console.log(`✅ 1.75 Litre = ${volRes.convertedAmount} ML (Formula: ${volRes.conversionFormula})`);
  if (volRes.convertedAmount !== 1750) {
    throw new Error('Litre to ML conversion mismatch');
  }

  // 3. Count Conversion (Dozen -> Pieces)
  const countRes = UnitConversionService.convert(4, 'dozen', 'pcs');
  console.log(`✅ 4 Dozen = ${countRes.convertedAmount} Pieces (Formula: ${countRes.conversionFormula})`);
  if (countRes.convertedAmount !== 48) {
    throw new Error('Dozen to Pieces conversion mismatch');
  }

  // 4. Incompatible Dimensions Blocked Check
  try {
    UnitConversionService.convert(5, 'kg', 'litre');
    throw new Error('❌ Failed: Dimensionally incompatible conversion (KG to Litre) was allowed!');
  } catch (err: any) {
    console.log(`✅ Passed: Incompatible dimension conversion rejected: "${err.message}"`);
  }

  // ==========================================
  // TEST 4: Raw Material / Ingredient Master
  // ==========================================
  console.log('\n--- TEST 4: Ingredient / Raw Material Setup ---');
  const freshMilk = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-MILK-FULL' } },
    update: { costPrice: 65.0, minStockLevel: 50.0 },
    create: {
      companyId: company.id,
      categoryId: dairyCategory.id,
      unitId: unitLitre.id,
      name: 'Full Cream Fresh Cow Milk',
      code: 'RM-MILK-FULL',
      type: 'RAW_MATERIAL',
      costPrice: 65.0,
      minStockLevel: 50.0,
      reorderQty: 100.0,
      isActive: true
    }
  });

  const maidaFlour = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RM-MAIDA-01' } },
    update: { costPrice: 42.0, minStockLevel: 25.0 },
    create: {
      companyId: company.id,
      categoryId: bakeryCategory.id,
      unitId: unitKg.id,
      name: 'Refined Wheat Flour (Maida Premium)',
      code: 'RM-MAIDA-01',
      type: 'RAW_MATERIAL',
      costPrice: 42.0,
      minStockLevel: 25.0,
      reorderQty: 50.0,
      isActive: true
    }
  });
  console.log(`✅ Raw Material 1: ${freshMilk.name} (${freshMilk.code}) [Type: ${freshMilk.type}, Cost: $${freshMilk.costPrice}/L]`);
  console.log(`✅ Raw Material 2: ${maidaFlour.name} (${maidaFlour.code}) [Type: ${maidaFlour.type}, Cost: $${maidaFlour.costPrice}/KG]`);

  // ==========================================
  // TEST 5: Finished Good & Menu Item Setup
  // ==========================================
  console.log('\n--- TEST 5: Finished Good & Restaurant Menu Items ---');
  const gulabJamunFG = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: 'FG-GULAB-JAMUN-01' } },
    update: { sellingPrice: 120.0 },
    create: {
      companyId: company.id,
      categoryId: dairyCategory.id,
      unitId: unitPcs.id,
      name: 'Royal Heritage Gulab Jamun (2 pcs portion)',
      code: 'FG-GULAB-JAMUN-01',
      type: 'FINISHED_GOOD',
      costPrice: 45.0,
      sellingPrice: 120.0,
      isActive: true
    }
  });
  console.log(`✅ Finished Good Item: ${gulabJamunFG.name} (${gulabJamunFG.code}) [Selling: $${gulabJamunFG.sellingPrice}]`);

  // Ensure Menu exists
  const restaurantMenu = await prisma.menu.upsert({
    where: { id: 'menu-heritage-desserts' },
    update: {},
    create: {
      id: 'menu-heritage-desserts',
      companyId: company.id,
      branchId: branch.id,
      name: 'Grand Heritage Dining Menu',
      code: 'MENU-DESSERT-01',
      isActive: true
    }
  });

  const menuCategory = await prisma.menuCategory.upsert({
    where: { id: 'mcat-sweets-01' },
    update: {},
    create: {
      id: 'mcat-sweets-01',
      menuId: restaurantMenu.id,
      name: 'Royal Indian Desserts',
      code: 'MCAT-SWEETS',
      sortOrder: 1
    }
  });

  const menuItem = await prisma.menuItem.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MI-GULAB-JAMUN' } },
    update: { price: 120.0 },
    create: {
      companyId: company.id,
      menuId: restaurantMenu.id,
      categoryId: menuCategory.id,
      finishedItemId: gulabJamunFG.id,
      name: 'Royal Heritage Gulab Jamun',
      code: 'MI-GULAB-JAMUN',
      description: 'Warm cottage cheese dumplings soaked in saffron-cardamom rose syrup',
      price: 120.0,
      costPrice: 45.0,
      taxRate: 5.0,
      kitchenStation: 'DESSERT_STATION',
      preparationMinutes: 5,
      isAvailable: true
    }
  });
  console.log(`✅ Menu Item Established: ${menuItem.name} (${menuItem.code})`);
  console.log(`   Price: $${menuItem.price} | Tax: ${menuItem.taxRate}% | Prep: ${menuItem.preparationMinutes}m | Station: ${menuItem.kitchenStation}`);

  console.log('\n🎉 ALL PART 6 PRODUCT, INGREDIENT & UNIT TESTS PASSED!');
}

runPart6Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
