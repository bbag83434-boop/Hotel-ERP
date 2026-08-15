import { prisma } from './src/config/database';
import { HRService } from './src/services/hr.service';
import { Prisma } from '@prisma/client';

async function runPart5Tests() {
  console.log('🧪 Starting PART 5 — HR, Attendance & Payroll Test Suite...');

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new Error('No active company found');

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) throw new Error('No branch found');

  const user = await prisma.user.findFirst({ where: { companyId: company.id } });
  if (!user) throw new Error('No user found');

  // ==========================================
  // TEST 1: Department & Shift Setup
  // ==========================================
  console.log('\n--- TEST 1: Department & Shift Scheduling ---');
  const dept = await prisma.department.upsert({
    where: { companyId_code: { companyId: company.id, code: 'DEPT-HR-TEST' } },
    update: {},
    create: {
      companyId: company.id,
      branchId: branch.id,
      name: 'Hospitality Operations',
      code: 'DEPT-HR-TEST',
      isActive: true
    }
  });

  const shift = await prisma.shift.upsert({
    where: { id: 'shift-morning-01' },
    update: {},
    create: {
      id: 'shift-morning-01',
      companyId: company.id,
      branchId: branch.id,
      name: 'Morning Service Shift',
      code: 'SHIFT-MORN-01',
      startTime: '07:00',
      endTime: '15:30',
      gracePeriodMins: 15,
      isActive: true
    }
  });
  console.log(`✅ Department: ${dept.name} (${dept.code})`);
  console.log(`✅ Shift: ${shift.name} (${shift.startTime} - ${shift.endTime})`);

  // ==========================================
  // TEST 2: Active & Inactive Staff Profiles
  // ==========================================
  console.log('\n--- TEST 2: Staff Profiles & Outlet Assignment ---');
  const activeStaff = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-HR-ACT-01' },
    update: { status: 'ACTIVE', basicSalary: 40000.0, allowances: 5000.0 },
    create: {
      companyId: company.id,
      branchId: branch.id,
      departmentId: dept.id,
      employeeCode: 'EMP-HR-ACT-01',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      designation: 'Senior Sous Chef',
      basicSalary: 40000.0,
      allowances: 5000.0,
      status: 'ACTIVE'
    }
  });

  const inactiveStaff = await prisma.employee.upsert({
    where: { employeeCode: 'EMP-HR-INACT-02' },
    update: { status: 'TERMINATED', basicSalary: 30000.0 },
    create: {
      companyId: company.id,
      branchId: branch.id,
      departmentId: dept.id,
      employeeCode: 'EMP-HR-INACT-02',
      firstName: 'Vikram',
      lastName: 'Singh',
      designation: 'Trainee Cook',
      basicSalary: 30000.0,
      status: 'TERMINATED'
    }
  });
  console.log(`✅ Active Staff: ${activeStaff.firstName} ${activeStaff.lastName} (${activeStaff.employeeCode}) [Salary: $${activeStaff.basicSalary}]`);
  console.log(`✅ Inactive Staff: ${inactiveStaff.firstName} ${inactiveStaff.lastName} (${inactiveStaff.employeeCode}) [Status: ${inactiveStaff.status}]`);

  // ==========================================
  // TEST 3: Attendance Logging & Work Hours
  // ==========================================
  console.log('\n--- TEST 3: Daily Attendance Tracking ---');
  const today = new Date().toISOString().slice(0, 10);
  const attendance = await HRService.recordAttendance(
    company.id,
    {
      employeeId: activeStaff.id,
      shiftId: shift.id,
      date: today,
      checkIn: new Date().toISOString(),
      checkOut: new Date(Date.now() + 8.5 * 3600000).toISOString(),
      status: 'PRESENT',
      workHours: 8.5,
      notes: 'On time for morning breakfast service'
    },
    user.id
  );
  console.log(`✅ Attendance Recorded: Date: ${attendance.date.toISOString().slice(0, 10)} | Status: ${attendance.status} | Work Hours: ${attendance.workHours}`);

  // ==========================================
  // TEST 4: Leave Request & Approval Lifecycle
  // ==========================================
  console.log('\n--- TEST 4: Leave Request & Manager Approval ---');
  const leaveType = await prisma.leaveType.upsert({
    where: { companyId_code: { companyId: company.id, code: 'LV-ANNUAL' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Annual Paid Leave',
      code: 'LV-ANNUAL',
      daysAllowed: 21,
      isPaid: true
    }
  });

  const leaveReq = await HRService.createLeaveRequest(
    company.id,
    {
      branchId: branch.id,
      employeeId: activeStaff.id,
      leaveTypeId: leaveType.id,
      startDate: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 86400000 * 12).toISOString().slice(0, 10),
      totalDays: 3,
      reason: 'Annual family festival leave'
    },
    user.id
  );
  console.log(`✅ Leave Request Submitted: #${leaveReq.id} (Days: ${leaveReq.totalDays}, Status: ${leaveReq.status})`);

  const approvedLeave = await HRService.actOnLeaveRequest(
    company.id,
    leaveReq.id,
    { status: 'APPROVED' },
    user.id
  );
  console.log(`✅ Leave Request Approved: Status: ${approvedLeave.status}`);
  if (approvedLeave.status !== 'APPROVED') {
    throw new Error('Leave approval state transition failed');
  }

  // ==========================================
  // TEST 5: Monthly Payroll Execution & Calculation
  // ==========================================
  console.log('\n--- TEST 5: Monthly Payroll Run Execution ---');
  const testMonth = 8;
  const testYear = 2026;

  const payrollRun = await HRService.executePayrollRun(
    company.id,
    {
      branchId: branch.id,
      month: testMonth,
      year: testYear
    },
    user.id
  );

  console.log(`✅ Payroll Run Executed: ${payrollRun.payrollNumber}`);
  console.log(`   Total Gross Salary: $${payrollRun.totalGrossSalary}`);
  console.log(`   Total Deductions:   $${payrollRun.totalDeductions}`);
  console.log(`   Total Net Salary:   $${payrollRun.totalNetSalary}`);
  console.log(`   Status:             ${payrollRun.status}`);

  // ==========================================
  // TEST 6: Payroll Itemization & Inactive Staff Exclusion
  // ==========================================
  console.log('\n--- TEST 6: Payslip Itemization & Inactive Staff Exclusion ---');
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: payrollRun.id },
    include: { employee: true }
  });

  console.log(`✅ Generated ${payslips.length} payslips:`);
  let foundTerminated = false;
  payslips.forEach((ps) => {
    console.log(`   - [${ps.employee.employeeCode}] ${ps.employee.firstName} ${ps.employee.lastName} (${ps.employee.designation}): Gross: $${Number(ps.basicSalary) + Number(ps.allowances)} | Net: $${ps.netSalary}`);
    if (ps.employee.status === 'TERMINATED') {
      foundTerminated = true;
    }
  });

  if (foundTerminated) {
    throw new Error('❌ Failed: Inactive/Terminated staff was included in payroll generation!');
  }
  console.log('✅ Passed: Inactive/Terminated staff correctly excluded from payroll run');

  // Verify Active Staff received correct payslip
  const activePayslip = payslips.find((p) => p.employeeId === activeStaff.id);
  if (!activePayslip) {
    throw new Error('Active staff payslip not found in payroll run');
  }
  const expectedNet = Number(activeStaff.basicSalary) + Number(activeStaff.allowances);
  if (Number(activePayslip.netSalary) !== expectedNet) {
    throw new Error(`Net salary calculation mismatch: Expected ${expectedNet}, got ${activePayslip.netSalary}`);
  }
  console.log(`✅ Passed: Active staff payslip matches basic + allowances ($${expectedNet})`);

  console.log('\n🎉 ALL PART 5 HR, ATTENDANCE & PAYROLL TESTS PASSED!');
}

runPart5Tests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
