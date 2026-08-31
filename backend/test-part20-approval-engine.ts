import { prisma } from './src/config/database';
import { AuthService } from './src/services/auth.service';
import { ApprovalService } from './src/services/approval.service';

async function runPart20Tests() {
  console.log('🧪 Starting PART 20 — Configurable Approval Engine Test Suite...');

  // 1. Setup
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const loginRes = await AuthService.login('admin@hotel-erp.com', 'Admin@123456');
  const user = loginRes.user;

  console.log(`✅ Authenticated User: ${user.email} (${user.role.name})`);

  // ==========================================
  // TEST 1: Configurable Approval Rules Matrix
  // ==========================================
  console.log('\n--- TEST 1: Configurable Multi-Tier Approval Rules ---');
  
  // Clean up any existing test rules for EXPENSE
  await prisma.approvalRule.deleteMany({
    where: { companyId: company.id, transactionType: 'EXPENSE' }
  });

  // Step 1 Rule: Expense >= ₹5,000 requires Branch Manager
  const rule1 = await ApprovalService.createApprovalRule(
    company.id,
    {
      branchId: branch.id,
      transactionType: 'EXPENSE',
      minAmount: 5000,
      requiredRole: 'BRANCH_MANAGER',
      stepNumber: 1
    },
    user.id
  );
  console.log(`✅ Rule 1 Created: Expense >= ₹5,000 -> Step 1: ${rule1.requiredRole} (ID: ${rule1.id})`);

  // Step 2 Rule: Expense >= ₹25,000 requires Super Admin
  const rule2 = await ApprovalService.createApprovalRule(
    company.id,
    {
      branchId: branch.id,
      transactionType: 'EXPENSE',
      minAmount: 25000,
      requiredRole: 'SUPER_ADMIN',
      stepNumber: 2
    },
    user.id
  );
  console.log(`✅ Rule 2 Created: Expense >= ₹25,000 -> Step 2: ${rule2.requiredRole} (ID: ${rule2.id})`);

  // ==========================================
  // TEST 2: Threshold Evaluation (Pass vs Trigger)
  // ==========================================
  console.log('\n--- TEST 2: Threshold Evaluation & Auto-Triggering ---');

  // Case A: Small expense ₹2,500 (below threshold) -> No approval required
  const evalSmall = await ApprovalService.evaluateAndTriggerApproval(
    company.id,
    {
      branchId: branch.id,
      transactionType: 'EXPENSE',
      referenceId: 'EXP-TEST-001',
      amount: 2500,
      title: 'Office Stationary Expense'
    },
    user.id
  );
  console.log(`✅ Small Expense (₹2,500): Requires Approval = ${evalSmall.requiresApproval}`);
  if (evalSmall.requiresApproval !== false) {
    throw new Error('Small transaction should not require approval');
  }

  // Case B: Large expense ₹30,000 (exceeds Tier 2 threshold) -> Triggers 2-Step Approval
  const evalLarge = await ApprovalService.evaluateAndTriggerApproval(
    company.id,
    {
      branchId: branch.id,
      transactionType: 'EXPENSE',
      referenceId: 'EXP-TEST-002',
      amount: 30000,
      title: 'Commercial Kitchen Oven Repair'
    },
    user.id
  );
  console.log(`✅ Large Expense (₹30,000): Requires Approval = ${evalLarge.requiresApproval}, Request #${evalLarge.approvalRequest?.requestNumber}, Total Steps = ${evalLarge.approvalRequest?.totalSteps}`);
  if (evalLarge.requiresApproval !== true || !evalLarge.approvalRequest || evalLarge.approvalRequest.totalSteps !== 2) {
    throw new Error('Large transaction multi-tier approval evaluation failed');
  }

  const requestId = evalLarge.approvalRequest.id;

  // ==========================================
  // TEST 3: Multi-Step Sequential Authorization Flow
  // ==========================================
  console.log('\n--- TEST 3: Multi-Step Sequential Authorization Flow ---');

  // Step 1: Branch Manager Approves
  const step1Res = await ApprovalService.actOnApproval(
    company.id,
    requestId,
    {
      action: 'APPROVED',
      comment: 'Verified invoice with technician. Proceed to finance signoff.'
    },
    user.id,
    'BRANCH_MANAGER'
  );
  console.log(`✅ Step 1 Executed: Current Step = ${step1Res.currentStep}/${step1Res.totalSteps}, Status = ${step1Res.status}`);
  if (step1Res.currentStep !== 2 || step1Res.status !== 'PENDING') {
    throw new Error('Step 1 advancement assertion failed');
  }

  // Step 2: Super Admin Approves (Final Tier)
  const step2Res = await ApprovalService.actOnApproval(
    company.id,
    requestId,
    {
      action: 'APPROVED',
      comment: 'Approved by Managing Director. Disbursement authorized.'
    },
    user.id,
    'SUPER_ADMIN'
  );
  console.log(`✅ Step 2 Finalized: Current Step = ${step2Res.currentStep}/${step2Res.totalSteps}, Final Status = ${step2Res.status}`);
  if (step2Res.status !== 'APPROVED') {
    throw new Error('Final approval assertion failed');
  }

  // ==========================================
  // TEST 4: Rejection Handling & Audit Trail
  // ==========================================
  console.log('\n--- TEST 4: Rejection Handling & Action Logging ---');

  // Create another large expense and reject it
  const rejectReq = await ApprovalService.createApprovalRequest(
    company.id,
    {
      branchId: branch.id,
      transactionType: 'EXPENSE',
      referenceId: 'EXP-TEST-003',
      amount: 15000,
      title: 'Unauthorized Luxury Decor Item'
    },
    user.id
  );

  const rejectedRes = await ApprovalService.actOnApproval(
    company.id,
    rejectReq.id,
    {
      action: 'REJECTED',
      comment: 'Budget ceiling exceeded for miscellaneous decor. Rejected.'
    },
    user.id,
    'BRANCH_MANAGER'
  );
  console.log(`✅ Request #${rejectReq.requestNumber} Status: ${rejectedRes.status}`);
  if (rejectedRes.status !== 'REJECTED') {
    throw new Error('Rejection assertion failed');
  }

  // Verify Action History
  const actions = await prisma.approvalAction.findMany({
    where: { approvalRequestId: rejectReq.id }
  });
  console.log(`✅ Action log recorded: ${actions.length} action(s), Comment: "${actions[0]?.comment}"`);

  // ==========================================
  // TEST 5: Approval Summary & Metrics Aggregation
  // ==========================================
  console.log('\n--- TEST 5: Executive Approval Metrics ---');
  const summary = await ApprovalService.getApprovalSummary(company.id, branch.id);
  console.log(`✅ Approval Summary:`);
  console.log(`   - Pending Requests:  ${summary.pendingCount}`);
  console.log(`   - Approved Requests: ${summary.approvedCount}`);
  console.log(`   - Rejected Requests: ${summary.rejectedCount}`);
  console.log(`   - Active Rules:      ${summary.totalRules}`);

  console.log('\n🎉 ALL PART 20 APPROVAL ENGINE TESTS PASSED!');
}

runPart20Tests()
  .catch((err) => {
    console.error('❌ PART 20 Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
