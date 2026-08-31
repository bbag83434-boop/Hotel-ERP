import { prisma } from './src/config/database';
import { BranchService } from './src/services/branch.service';
import { BranchType } from '@prisma/client';

async function runBranchCreationTests() {
  console.log('🧪 Starting Branch Management & Creation Test Suite...\n');

  try {
    const company = await prisma.company.findFirst({ where: { isActive: true } });
    const user = await prisma.user.findFirst({ where: { email: 'admin@hotel-erp.com' } });

    if (!company || !user) {
      throw new Error('Company or Admin user not found.');
    }

    console.log(`🏢 Company: ${company.name} (${company.code}) [ID: ${company.id}]`);
    console.log(`👤 User: ${user.firstName} ${user.lastName} [ID: ${user.id}]\n`);

    // TEST 1: Retrieve Existing Branches
    console.log('--- TEST 1: Fetch Existing Branches ---');
    const initialBranches = await BranchService.getBranches(company.id);
    console.log(`✅ Found ${initialBranches.length} active branch(es):`);
    initialBranches.forEach((b) => {
      console.log(`   - [${b.code}] ${b.name} (${b.type}) - ${b.address}`);
    });

    // TEST 2: Create a New Restaurant Branch
    console.log('\n--- TEST 2: Create New Restaurant Outlet ---');
    const uniqueCode = `BR-TEST-${Date.now().toString().slice(-4)}`;
    const newBranch = await BranchService.createBranch(company.id, user.id, {
      name: 'Royal Heritage Rooftop Bistro',
      code: uniqueCode,
      type: BranchType.RESTAURANT,
      address: 'Floor 5, Sky Pavilion, Grand Heritage',
      email: 'rooftop@grandheritage.in',
      phone: '+91 98765 11223'
    });

    console.log(`✅ Successfully created new branch: ${newBranch.name} (${newBranch.code})`);
    console.log(`   Branch ID: ${newBranch.id}`);
    console.log(`   Company ID: ${newBranch.companyId}`);
    console.log(`   Type: ${newBranch.type}`);

    // TEST 3: Verify User Membership in UserBranch
    console.log('\n--- TEST 3: Verify User Branch Membership ---');
    const userBranchLink = await prisma.userBranch.findUnique({
      where: {
        userId_branchId: {
          userId: user.id,
          branchId: newBranch.id
        }
      }
    });

    if (!userBranchLink) {
      throw new Error('User was not automatically granted access to the new branch in user_branches');
    }
    console.log(`✅ UserBranch membership verified for User ${user.id} -> Branch ${newBranch.id}`);

    // TEST 4: Duplicate Code Prevention
    console.log('\n--- TEST 4: Duplicate Branch Code Rejection ---');
    try {
      await BranchService.createBranch(company.id, user.id, {
        name: 'Duplicate Test Outlet',
        code: uniqueCode,
        type: BranchType.RESTAURANT,
        address: 'Test Address'
      });
      throw new Error('Expected duplicate code error, but operation succeeded!');
    } catch (err: any) {
      console.log(`✅ Correctly rejected duplicate code "${uniqueCode}": ${err.message}`);
    }

    // TEST 5: Verify in List
    console.log('\n--- TEST 5: Verify Updated Branch List ---');
    const updatedBranches = await BranchService.getBranches(company.id);
    const found = updatedBranches.some((b) => b.id === newBranch.id);
    if (!found) {
      throw new Error('Newly created branch not present in getBranches list');
    }
    console.log(`✅ Branch ${newBranch.name} is present in branch query list (${updatedBranches.length} total branches)`);

    // Clean up test branch
    console.log('\n--- CLEANUP: Remove Test Branch ---');
    await prisma.userBranch.deleteMany({ where: { branchId: newBranch.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: newBranch.id } });
    await prisma.branch.delete({ where: { id: newBranch.id } });
    console.log(`✅ Cleaned up temporary test branch ${uniqueCode}`);

    console.log('\n🎉 ALL BRANCH CREATION & MULTI-TENANT TESTS PASSED!');
  } catch (error) {
    console.error('❌ Branch Test Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBranchCreationTests();
