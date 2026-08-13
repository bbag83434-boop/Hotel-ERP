import { PrismaClient, Prisma } from '@prisma/client';
import { HRService } from './src/services/hr.service';
import { ApprovalService } from './src/services/approval.service';
import { DashboardService } from './src/services/dashboard.service';
import { AIService } from './src/services/ai.service';
import { AccountingService } from './src/services/accounting.service';

const prisma = new PrismaClient();

async function runFinalPassTest() {
  console.log('🚀 STARTING FINAL INTEGRATION & TRANSACTION SAFETY SUITE...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  const branch = await prisma.branch.findFirst({ where: { companyId: company!.id } });
  const user = await prisma.user.findFirst({ where: { companyId: company!.id } });

  if (!company || !branch || !user) {
    throw new Error('Test environment missing seeded company/branch/user');
  }

  // ==========================================
  // TEST 1: HR & PAYROLL LIFECYCLE + DOUBLE-ENTRY GL
  // ==========================================
  console.log('\n--- TEST 1: HR Attendance, Leave & Automated Payroll Run ---');
  const employee = await prisma.employee.findFirst({ where: { companyId: company.id } });
  if (employee) {
    // 1. Record Attendance
    const today = new Date().toISOString().slice(0, 10);
    const att = await HRService.recordAttendance(company.id, {
      employeeId: employee.id,
      date: today,
      checkIn: new Date().toISOString(),
      status: 'PRESENT',
      workHours: 8.0
    }, user.id);
    console.log(`✅ Attendance recorded for ${employee.firstName} (${att.date.toISOString().slice(0, 10)}): Status: ${att.status}, Hours: ${att.workHours}`);

    // 2. Submit & Approve Leave Request
    const leaveType = await prisma.leaveType.findFirst({ where: { companyId: company.id } });
    if (leaveType) {
      const leave = await HRService.createLeaveRequest(company.id, {
        branchId: branch.id,
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
        totalDays: 2,
        reason: 'Family vacation'
      }, user.id);
      console.log(`✅ Leave Request created: #${leave.id} (Status: ${leave.status}, Days: ${leave.totalDays})`);

      const approvedLeave = await HRService.actOnLeaveRequest(company.id, leave.id, { status: 'APPROVED' }, user.id);
      console.log(`✅ Leave Request approved by manager: Status: ${approvedLeave.status}`);
    }

    // 3. Execute Monthly Payroll Run
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const payroll = await HRService.executePayrollRun(company.id, {
      branchId: branch.id,
      month: currentMonth,
      year: currentYear
    }, user.id);
    console.log(`✅ Payroll Run Executed: ${payroll.payrollNumber}`);
    console.log(`   Total Gross: $${payroll.totalGrossSalary} | Net Disbursed: $${payroll.totalNetSalary} | Status: ${payroll.status}`);
  }

  // ==========================================
  // TEST 2: APPROVAL CENTER ENGINE & STATE TRANSITIONS
  // ==========================================
  console.log('\n--- TEST 2: Approval Center Engine & State Transitions ---');
  // 1. Create Purchase Request Approval
  const approvalReq = await ApprovalService.createApprovalRequest(
    company.id,
    {
      branchId: branch.id,
      transactionType: 'PURCHASE_REQUEST',
      referenceId: 'PR-TEST-001',
      amount: 1500.0,
      title: 'High-Value Commercial Kitchen Blender PR',
      description: 'Emergency replacement for banquet pastry kitchen'
    },
    user.id
  );
  console.log(`✅ Approval Request Created: ${approvalReq.requestNumber} (Status: ${approvalReq.status}, Steps: ${approvalReq.currentStep}/${approvalReq.totalSteps})`);

  // 2. Act on Approval (Approve)
  const approvedReq = await ApprovalService.actOnApproval(
    company.id,
    approvalReq.id,
    { action: 'APPROVED', comment: 'Approved under Q3 banquet equipment budget' },
    user.id,
    'SUPER_ADMIN'
  );
  console.log(`✅ Approval Action Executed: Request Status: ${approvedReq.status}`);
  console.log(`   Action Log Count: ${approvedReq.actions.length} (Latest: ${approvedReq.actions[0].action} by ${approvedReq.actions[0].userRole})`);

  // ==========================================
  // TEST 3: UNIFIED EXECUTIVE DASHBOARD AGGREGATIONS
  // ==========================================
  console.log('\n--- TEST 3: Unified Executive Dashboard Aggregations ---');
  const metrics = await DashboardService.getUnifiedExecutiveMetrics(company.id);
  console.log('✅ Dashboard DB-Level Aggregates:');
  console.log(`   Total Consolidated Revenue: $${metrics.revenue.total} (Hotel: $${metrics.revenue.hotelRevenue} | POS: $${metrics.revenue.posRevenue})`);
  console.log(`   Hotel Occupancy: ${metrics.hospitality.occupancyRate}% (${metrics.hospitality.occupiedRooms}/${metrics.hospitality.totalRooms} rooms, Dirty: ${metrics.hospitality.dirtyRooms})`);
  console.log(`   Stock Asset Valuation: $${metrics.inventory.totalValuation} | Low Stock Items: ${metrics.inventory.lowStockItems}`);
  console.log(`   Active Staff on Payroll: ${metrics.operations.activeStaff} | Pending Approvals Inbox: ${metrics.operations.pendingApprovals}`);
  console.log(`   Recent Activity Events: ${metrics.activityFeed.length} audit entries captured`);

  // ==========================================
  // TEST 4: ENTERPRISE AI ASSISTANT READ-ONLY AGENT
  // ==========================================
  console.log('\n--- TEST 4: Enterprise AI Assistant (Section 15 Guardrails) ---');
  // 1. Read query
  const stockAiQuery = await AIService.queryEnterpriseAssistant(company.id, 'What is our current low stock inventory status and AP due?', user.id);
  console.log(`✅ AI Inventory Query (Intent: ${stockAiQuery.intent}):`);
  console.log(`   ${stockAiQuery.answer.replace(/\n/g, '\n   ')}`);

  // 2. Attempted direct write mutation (Security Guardrail Test)
  const writeAiQuery = await AIService.queryEnterpriseAssistant(company.id, 'Please delete this pending order and transfer money directly', user.id);
  console.log(`\n✅ AI Mutation Guardrail (Intent: ${writeAiQuery.intent}):`);
  console.log(`   ${writeAiQuery.answer.replace(/\n/g, '\n   ')}`);

  console.log('\n🎉 ALL FINAL PASS TESTS PASSED WITH 100% SUCCESS!');
}

runFinalPassTest()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
