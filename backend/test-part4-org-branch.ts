import { prisma } from './src/config/database';
import { UserService } from './src/services/user.service';
import { InventoryService } from './src/services/inventory.service';
import { HRService } from './src/services/hr.service';
import { hashPassword } from './src/utils/password.utils';

async function runPart4Tests() {
  console.log('🧪 Starting PART 4 — Organization, Branch, Warehouse & Staff Test Suite...');

  // ==========================================
  // TEST 1: Company & Branch Hierarchy
  // ==========================================
  console.log('\n--- TEST 1: Multi-Branch Organization Hierarchy ---');
  const company = await prisma.company.upsert({
    where: { code: 'CMP-GRAND-PALACE' },
    update: {},
    create: {
      name: 'Grand Heritage Resort & Palace',
      code: 'CMP-GRAND-PALACE',
      address: 'Palace Road, Heritage City, India',
      isActive: true
    }
  });
  console.log(`✅ Company Verified: ${company.name} (${company.code})`);

  // Create/Confirm Outlets
  const hqBranch = await prisma.branch.upsert({
    where: { code: 'BR-HQ-01' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Main HQ & Resort',
      code: 'BR-HQ-01',
      type: 'HYBRID',
      isActive: true
    }
  });

  const outletA = await prisma.branch.upsert({
    where: { code: 'BR-OUTLET-A' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Downtown Palace Dining',
      code: 'BR-OUTLET-A',
      type: 'RESTAURANT',
      isActive: true
    }
  });

  const outletB = await prisma.branch.upsert({
    where: { code: 'BR-OUTLET-B' },
    update: {},
    create: {
      companyId: company.id,
      name: 'Heritage Sweet & Bakery Shop',
      code: 'BR-OUTLET-B',
      type: 'RESTAURANT',
      isActive: true
    }
  });
  console.log(`✅ Outlets Established: ${hqBranch.name}, ${outletA.name}, ${outletB.name}`);

  // ==========================================
  // TEST 2: Warehouses & Central Kitchen
  // ==========================================
  console.log('\n--- TEST 2: Multi-Warehouse & Central Kitchen Architecture ---');
  const centralWh = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'WH-CENTRAL-MAIN' } },
    update: { isCentral: true },
    create: {
      companyId: company.id,
      branchId: hqBranch.id,
      name: 'Central Provisioning Warehouse',
      code: 'WH-CENTRAL-MAIN',
      isCentral: true,
      isActive: true
    }
  });

  const outletAWh = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'WH-OUTLET-A-STORE' } },
    update: {},
    create: {
      companyId: company.id,
      branchId: outletA.id,
      name: 'Outlet A Kitchen Store',
      code: 'WH-OUTLET-A-STORE',
      isCentral: false,
      isActive: true
    }
  });
  console.log(`✅ Central Warehouse: ${centralWh.name} (isCentral: ${centralWh.isCentral})`);
  console.log(`✅ Outlet A Warehouse: ${outletAWh.name} (Branch: ${outletA.code})`);

  // ==========================================
  // TEST 3: Departments & Department Heads
  // ==========================================
  console.log('\n--- TEST 3: Department Scoping ---');
  const kitchenDept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: 'DEPT-KITCHEN' } },
    update: {},
    create: {
      companyId: company.id,
      branchId: hqBranch.id,
      name: 'Culinary & Central Kitchen',
      code: 'DEPT-KITCHEN',
      isActive: true
    }
  });
  console.log(`✅ Department Verified: ${kitchenDept.name} (${kitchenDept.code})`);

  // ==========================================
  // TEST 4: Staff & User Assignment to Specific Outlets
  // ==========================================
  console.log('\n--- TEST 4: User & Staff Assignment with RBAC ---');
  const staffRole = await prisma.role.findFirst({ where: { name: 'STAFF' } }) ||
    await prisma.role.findFirst({ where: { name: 'MANAGER' } });
  if (!staffRole) throw new Error('STAFF or MANAGER role missing');

  const passwordHash = await hashPassword('StaffPassword@2026');

  // Create Staff User for Outlet A ONLY
  const outletAUser = await prisma.user.upsert({
    where: { email: 'staff_outlet_a@apex-erp.local' },
    update: { passwordHash, isActive: true },
    create: {
      email: 'staff_outlet_a@apex-erp.local',
      username: 'staff_outlet_a',
      passwordHash,
      firstName: 'Chef',
      lastName: 'OutletA',
      companyId: company.id,
      roleId: staffRole.id,
      isActive: true
    }
  });

  // Assign Outlet A User exclusively to Outlet A
  await UserService.assignUserBranches(
    outletAUser.id,
    [outletA.id],
    outletA.id,
    'SYSTEM',
    '127.0.0.1',
    'TestSuite'
  );

  const assignedBranches = await prisma.userBranch.findMany({
    where: { userId: outletAUser.id },
    include: { branch: true }
  });

  console.log(`✅ User ${outletAUser.email} assigned to ${assignedBranches.length} branch(es):`);
  assignedBranches.forEach((ub) => {
    console.log(`   - ${ub.branch.name} (${ub.branch.code}) [Default: ${ub.isDefault}]`);
  });

  if (assignedBranches.length !== 1 || assignedBranches[0].branchId !== outletA.id) {
    throw new Error('UserBranch assignment failed');
  }

  // ==========================================
  // TEST 5: Outlet Isolation Enforcement Check
  // ==========================================
  console.log('\n--- TEST 5: Multi-Tenant Outlet Isolation Verification ---');
  
  // Verify that Outlet A User is NOT authorized for Outlet B
  const isAuthorizedForOutletB = await prisma.userBranch.findUnique({
    where: {
      userId_branchId: {
        userId: outletAUser.id,
        branchId: outletB.id
      }
    }
  });

  if (isAuthorizedForOutletB) {
    throw new Error('❌ Isolation Failed: User was authorized for unauthorized Outlet B!');
  }
  console.log(`✅ Passed: User "${outletAUser.username}" is strictly blocked from Outlet B (${outletB.code})`);

  // ==========================================
  // TEST 6: Employee Profile Linkage
  // ==========================================
  console.log('\n--- TEST 6: Employee Profile Scoping ---');
  const employee = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-OUTLET-A-01' },
    update: { userId: outletAUser.id },
    create: {
      companyId: company.id,
      branchId: outletA.id,
      departmentId: kitchenDept.id,
      userId: outletAUser.id,
      employeeCode: 'EMP-OUTLET-A-01',
      firstName: 'Chef',
      lastName: 'OutletA',
      designation: 'Head Chef',
      basicSalary: 35000.0,
      status: 'ACTIVE'
    }
  });
  console.log(`✅ Employee Profile Linked: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`);
  console.log(`   Branch: ${employee.branchId} | Department: ${employee.departmentId} | Salary: $${employee.basicSalary}`);

  console.log('\n🎉 ALL PART 4 ORGANIZATION & OUTLET ISOLATION TESTS PASSED!');
}

runPart4Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
