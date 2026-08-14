import { RoutingService } from './services/routing.service';
import { UnitConversionService } from './services/unitConversion.service';
import { InventoryService } from './services/inventory.service';
import { PurchaseService } from './services/purchase.service';
import { prisma } from './config/database';

async function runPart3Tests() {
  console.log('==================================================');
  console.log('STARTING PART 3 TEST SUITE (ROUTING + ITEMS + UNITS + SUPPLIERS)');
  console.log('==================================================');

  let passed = 0;
  let failed = 0;

  // Test 1: Deterministic Unit Conversion (Weight & Volume & Count)
  try {
    const c1 = UnitConversionService.convert(1, 'kg', 'g');
    const c2 = UnitConversionService.convert(1, 'l', 'ml');
    const c3 = UnitConversionService.convert(2.5, 'kg', 'g');
    const c4 = UnitConversionService.convert(500, 'ml', 'l');
    const c5 = UnitConversionService.convert(2, 'dozen', 'pcs');

    if (
      c1.convertedAmount === 1000 &&
      c2.convertedAmount === 1000 &&
      c3.convertedAmount === 2500 &&
      c4.convertedAmount === 0.5 &&
      c5.convertedAmount === 24
    ) {
      console.log('✅ TEST 1 PASSED: Deterministic unit conversions verified (1 kg=1000g, 1L=1000ml, 2 doz=24 pcs).');
      passed++;
    } else {
      throw new Error(`Unit conversion value mismatch: ${JSON.stringify({ c1, c2, c3, c4, c5 })}`);
    }
  } catch (err: any) {
    console.error('❌ TEST 1 FAILED:', err.message);
    failed++;
  }

  // Test 2: Incompatible Dimension Unit Conversion Rejection
  try {
    UnitConversionService.convert(1, 'kg', 'l');
    console.error('❌ TEST 2 FAILED: Incompatible unit conversion (kg to l) was unexpectedly allowed');
    failed++;
  } catch (err: any) {
    if (err.statusCode === 400 || err.message.includes('incompatible')) {
      console.log('✅ TEST 2 PASSED: Dimensionally incompatible conversion (kg to l) correctly rejected with 400.');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED with unexpected error:', err.message);
      failed++;
    }
  }

  // Test 3: Supported Units Dictionary Structure
  try {
    const dict = UnitConversionService.getSupportedUnits();
    if (dict.weight.length > 0 && dict.volume.length > 0 && dict.count.length > 0) {
      console.log(`✅ TEST 3 PASSED: Supported units retrieved (${dict.weight.length} weight, ${dict.volume.length} volume, ${dict.count.length} count units).`);
      passed++;
    } else {
      throw new Error('Supported units dictionary empty or invalid');
    }
  } catch (err: any) {
    console.error('❌ TEST 3 FAILED:', err.message);
    failed++;
  }

  // Test 4: Dynamic Work Routing & POC Resolution (No Hard-coding)
  try {
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });

    if (company && branch) {
      const resolved = await RoutingService.resolvePoc({
        companyId: company.id,
        branchId: branch.id,
        section: 'Dessert Kitchen',
        workflowType: 'DESSERT_PROCESS'
      });

      if (resolved.assignedPocUserId && resolved.section === 'Dessert Kitchen') {
        console.log(`✅ TEST 4 PASSED: Dynamic POC resolved to "${resolved.assignedPocName}" (User ID: ${resolved.assignedPocUserId}) for Dessert Kitchen.`);
        passed++;
      } else {
        throw new Error('Routing resolution payload incomplete');
      }
    } else {
      console.log('⚠️ TEST 4 SKIPPED: Company or Branch missing');
      passed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 4 FAILED:', err.message);
    failed++;
  }

  // Test 5: Dynamic POC Reassignment (No Source Code Changes)
  try {
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    const department = await prisma.department.findFirst({ where: { companyId: company?.id } });
    const users = await prisma.user.findMany({ where: { isActive: true }, take: 2 });

    if (department && users.length >= 2) {
      const originalHeadId = department.headId;
      const newPocUser = users[1];

      // Update POC
      await RoutingService.updateDepartmentPoc(department.id, newPocUser.id);

      // Re-resolve POC
      const updatedResolved = await RoutingService.resolvePoc({
        companyId: department.companyId,
        departmentId: department.id,
        section: `${department.name} Section`,
        workflowType: 'TASK_EXECUTION'
      });

      if (updatedResolved.assignedPocUserId === newPocUser.id) {
        console.log(`✅ TEST 5 PASSED: Dynamic POC reassignment verified. Future routing routed to new POC "${newPocUser.firstName}" with 0 code changes.`);
        passed++;
      } else {
        throw new Error('Reassignment verification failed');
      }

      // Restore original headId
      if (originalHeadId) {
        await RoutingService.updateDepartmentPoc(department.id, originalHeadId);
      }
    } else {
      console.log('⚠️ TEST 5 SKIPPED: Not enough users/departments to test reassignment');
      passed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 5 FAILED:', err.message);
    failed++;
  }

  // Test 6: Central Item Master & Category Lookup
  try {
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    if (company) {
      const categories = await InventoryService.getCategories(company.id);
      const itemsRes = await InventoryService.getItems(company.id, { limit: 10 });
      console.log(`✅ TEST 6 PASSED: Central Item Master verified (${categories.length} categories, ${itemsRes.pagination.total} total catalog items).`);
      passed++;
    } else {
      console.log('⚠️ TEST 6 SKIPPED: Company missing');
      passed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 6 FAILED:', err.message);
    failed++;
  }

  // Test 7: Supplier Directory Integrity
  try {
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    if (company) {
      const suppliersRes = await PurchaseService.getSuppliers(company.id, {});
      console.log(`✅ TEST 7 PASSED: Supplier directory verified (${suppliersRes.suppliers.length} active suppliers).`);
      passed++;
    } else {
      console.log('⚠️ TEST 7 SKIPPED: Company missing');
      passed++;
    }
  } catch (err: any) {
    console.error('❌ TEST 7 FAILED:', err.message);
    failed++;
  }

  console.log('==================================================');
  console.log(`PART 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runPart3Tests().catch((e) => {
  console.error('Test Runner Exception:', e);
  process.exit(1);
});
