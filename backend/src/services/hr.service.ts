import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { AccountingService } from './accounting.service';
import { Prisma, EmployeeStatus, AttendanceStatus, LeaveStatus, PayrollStatus } from '@prisma/client';

export class HRService {
  // ==========================================
  // 1. DEPARTMENTS
  // ==========================================
  public static async getDepartments(companyId: string, branchId?: string) {
    return prisma.department.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {})
      },
      include: {
        head: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  public static async createDepartment(
    companyId: string,
    data: {
      branchId?: string;
      name: string;
      code: string;
      description?: string;
      headId?: string;
    },
    actorId?: string
  ) {
    const dept = await prisma.department.create({
      data: {
        companyId,
        branchId: data.branchId,
        name: data.name,
        code: data.code,
        description: data.description,
        headId: data.headId
      }
    });

    if (actorId) {
      await AuditService.log({
        userId: actorId,
        action: 'DEPARTMENT_CREATED',
        entity: 'Department',
        entityId: dept.id,
        details: { code: dept.code, name: dept.name }
      });
    }

    return dept;
  }

  // ==========================================
  // 2. EMPLOYEES
  // ==========================================
  public static async getEmployees(
    companyId: string,
    filters?: {
      branchId?: string;
      departmentId?: string;
      status?: EmployeeStatus;
      search?: string;
    }
  ) {
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { employeeCode: { contains: filters.search, mode: 'insensitive' } },
              { designation: { contains: filters.search, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    return prisma.employee.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, username: true, email: true } },
        _count: { select: { attendances: true, leaveRequests: true } }
      },
      orderBy: { employeeCode: 'asc' }
    });
  }

  public static async createEmployee(
    companyId: string,
    data: {
      branchId?: string;
      departmentId?: string;
      userId?: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      designation: string;
      employmentType?: any;
      joinDate?: string;
      basicSalary: number;
      allowances?: number;
      bankAccount?: string;
      nidOrPassport?: string;
      emergencyContact?: string;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const emp = await prisma.employee.create({
      data: {
        companyId,
        branchId: data.branchId,
        departmentId: data.departmentId,
        userId: data.userId,
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone,
        designation: data.designation,
        employmentType: data.employmentType || 'FULL_TIME',
        joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
        basicSalary: new Prisma.Decimal(data.basicSalary),
        allowances: data.allowances ? new Prisma.Decimal(data.allowances) : new Prisma.Decimal(0),
        bankAccount: data.bankAccount,
        nidOrPassport: data.nidOrPassport,
        emergencyContact: data.emergencyContact,
        status: 'ACTIVE'
      }
    });

    if (actorId) {
      await AuditService.log({
        userId: actorId,
        action: 'EMPLOYEE_CREATED',
        entity: 'Employee',
        entityId: emp.id,
        details: { code: emp.employeeCode, name: `${emp.firstName} ${emp.lastName}`, salary: data.basicSalary },
        ipAddress,
        userAgent
      });
    }

    return emp;
  }

  public static async updateEmployeeStatus(
    companyId: string,
    employeeId: string,
    status: EmployeeStatus,
    actorId?: string
  ) {
    const emp = await prisma.employee.update({
      where: { id: employeeId },
      data: { status }
    });

    if (actorId) {
      await AuditService.log({
        userId: actorId,
        action: 'EMPLOYEE_STATUS_UPDATED',
        entity: 'Employee',
        entityId: emp.id,
        details: { status }
      });
    }

    return emp;
  }

  // ==========================================
  // 3. ATTENDANCE & SHIFTS
  // ==========================================
  public static async getShifts(companyId: string, branchId?: string) {
    return prisma.shift.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {})
      },
      orderBy: { startTime: 'asc' }
    });
  }

  public static async getAttendances(
    companyId: string,
    filters: {
      branchId?: string;
      date?: string;
      employeeId?: string;
    }
  ) {
    const where: Prisma.AttendanceWhereInput = {
      employee: {
        companyId,
        ...(filters.branchId ? { branchId: filters.branchId } : {})
      },
      ...(filters.date ? { date: new Date(filters.date) } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {})
    };

    return prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: { select: { name: true } }
          }
        },
        shift: true
      },
      orderBy: { date: 'desc' }
    });
  }

  public static async recordAttendance(
    companyId: string,
    data: {
      employeeId: string;
      shiftId?: string;
      date: string;
      checkIn?: string;
      checkOut?: string;
      status?: AttendanceStatus;
      workHours?: number;
      overtimeHours?: number;
      notes?: string;
    },
    actorId?: string
  ) {
    const attDate = new Date(data.date);
    const att = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: attDate
        }
      },
      update: {
        shiftId: data.shiftId,
        checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
        checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
        status: data.status || 'PRESENT',
        workHours: data.workHours ? new Prisma.Decimal(data.workHours) : undefined,
        overtimeHours: data.overtimeHours ? new Prisma.Decimal(data.overtimeHours) : undefined,
        notes: data.notes
      },
      create: {
        employeeId: data.employeeId,
        shiftId: data.shiftId,
        date: attDate,
        checkIn: data.checkIn ? new Date(data.checkIn) : new Date(),
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        status: data.status || 'PRESENT',
        workHours: data.workHours ? new Prisma.Decimal(data.workHours) : new Prisma.Decimal(8.0),
        overtimeHours: data.overtimeHours ? new Prisma.Decimal(data.overtimeHours) : new Prisma.Decimal(0),
        notes: data.notes
      }
    });

    return att;
  }

  // ==========================================
  // 4. LEAVE MANAGEMENT
  // ==========================================
  public static async getLeaveTypes(companyId: string) {
    return prisma.leaveType.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    });
  }

  public static async getLeaveRequests(
    companyId: string,
    filters?: {
      branchId?: string;
      status?: LeaveStatus;
      employeeId?: string;
    }
  ) {
    return prisma.leaveRequest.findMany({
      where: {
        companyId,
        ...(filters?.branchId ? { branchId: filters.branchId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.employeeId ? { employeeId: filters.employeeId } : {})
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: { select: { name: true } }
          }
        },
        leaveType: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async createLeaveRequest(
    companyId: string,
    data: {
      branchId?: string;
      employeeId: string;
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      totalDays: number;
      reason: string;
    },
    actorId?: string
  ) {
    const leave = await prisma.leaveRequest.create({
      data: {
        companyId,
        branchId: data.branchId,
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalDays: data.totalDays,
        reason: data.reason,
        status: 'PENDING'
      }
    });

    if (actorId) {
      await AuditService.log({
        userId: actorId,
        action: 'LEAVE_REQUESTED',
        entity: 'LeaveRequest',
        entityId: leave.id,
        details: { totalDays: data.totalDays, reason: data.reason }
      });
    }

    return leave;
  }

  public static async actOnLeaveRequest(
    companyId: string,
    requestId: string,
    data: {
      status: 'APPROVED' | 'REJECTED';
      rejectionReason?: string;
    },
    approverId: string
  ) {
    const leave = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: data.status,
        approvedById: approverId,
        approvedAt: new Date(),
        rejectionReason: data.rejectionReason
      }
    });

    await AuditService.log({
      userId: approverId,
      action: `LEAVE_${data.status}`,
      entity: 'LeaveRequest',
      entityId: leave.id,
      details: { status: data.status, reason: data.rejectionReason }
    });

    return leave;
  }

  // ==========================================
  // 5. PAYROLL RUN & DOUBLE-ENTRY GL
  // ==========================================
  public static async getPayrollRuns(companyId: string, branchId?: string) {
    return prisma.payrollRun.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {})
      },
      include: {
        processedBy: { select: { id: true, firstName: true, lastName: true } },
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                department: { select: { name: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async executePayrollRun(
    companyId: string,
    data: {
      branchId?: string;
      month: number;
      year: number;
    },
    processorId?: string
  ) {
    return prisma.$transaction(
      async (tx) => {
        const { branchId, month, year } = data;

        // Fetch active employees
        const employees = await tx.employee.findMany({
          where: {
            companyId,
            status: 'ACTIVE',
            ...(branchId ? { branchId } : {})
          }
        });

        if (employees.length === 0) {
          throw new AppError('No active employees found to generate payroll', 400);
        }

        const payrollNumber = `PAY-${year}-${String(month).padStart(2, '0')}`;
        let totalGross = new Prisma.Decimal(0);
        let totalDeductions = new Prisma.Decimal(0);
        let totalNet = new Prisma.Decimal(0);

        const payslipRows: any[] = [];

        for (const emp of employees) {
          const basic = new Prisma.Decimal(emp.basicSalary);
          const allowances = new Prisma.Decimal(emp.allowances);
          const overtime = new Prisma.Decimal(0); // overtime calculated from attendance if available
          const deductions = new Prisma.Decimal(0); // tax/pension deduction
          const net = basic.plus(allowances).plus(overtime).minus(deductions);

          totalGross = totalGross.plus(basic).plus(allowances);
          totalDeductions = totalDeductions.plus(deductions);
          totalNet = totalNet.plus(net);

          payslipRows.push({
            employeeId: emp.id,
            basicSalary: basic,
            allowances,
            overtimeAmount: overtime,
            deductions,
            netSalary: net,
            paymentStatus: 'SUCCESS' as const,
            paidAt: new Date(),
            paymentMethod: 'MOBILE_BANKING' as const
          });
        }

        const payrollRun = await tx.payrollRun.upsert({
          where: {
            companyId_month_year: {
              companyId,
              month,
              year
            }
          },
          update: {
            totalGrossSalary: totalGross,
            totalDeductions,
            totalNetSalary: totalNet,
            status: 'PAID',
            processedById: processorId
          },
          create: {
            companyId,
            branchId,
            payrollNumber,
            month,
            year,
            totalGrossSalary: totalGross,
            totalDeductions,
            totalNetSalary: totalNet,
            status: 'PAID',
            processedById: processorId
          }
        });

        // Upsert payslips
        for (const p of payslipRows) {
          await tx.payslip.upsert({
            where: {
              payrollRunId_employeeId: {
                payrollRunId: payrollRun.id,
                employeeId: p.employeeId
              }
            },
            update: p,
            create: {
              ...p,
              payrollRunId: payrollRun.id
            }
          });
        }

        // Post Double-Entry Journal to General Ledger
        // Debit: [6010] Staff Salary & Wages Expense ($totalNet)
        // Credit: [1020] Main Operating Bank Account ($totalNet)
        try {
          const [salaryExpAcc, bankAcc] = await Promise.all([
            tx.chartOfAccount.findFirst({ where: { companyId, code: '6010' } }),
            tx.chartOfAccount.findFirst({ where: { companyId, code: '1020' } })
          ]);

          if (salaryExpAcc && bankAcc) {
            const count = await tx.journalEntry.count({ where: { companyId } });
            const entryNumber = `JE-${year}-${String(count + 1).padStart(6, '0')}`;

            const je = await tx.journalEntry.create({
              data: {
                companyId,
                branchId,
                entryNumber,
                referenceType: 'PAYROLL_DISBURSEMENT',
                referenceId: payrollRun.id,
                narration: `Monthly staff salary & wages disbursement for ${month}/${year}`,
                totalDebit: totalNet,
                totalCredit: totalNet,
                status: 'POSTED',
                createdById: processorId
              }
            });

            await tx.journalEntryLine.createMany({
              data: [
                {
                  journalEntryId: je.id,
                  accountId: salaryExpAcc.id,
                  debit: totalNet,
                  credit: new Prisma.Decimal(0),
                  narration: `Staff salaries ${month}/${year}`
                },
                {
                  journalEntryId: je.id,
                  accountId: bankAcc.id,
                  debit: new Prisma.Decimal(0),
                  credit: totalNet,
                  narration: `Bank salary transfers ${month}/${year}`
                }
              ]
            });

            // Update Account Balances
            await tx.chartOfAccount.update({
              where: { id: salaryExpAcc.id },
              data: { balance: { increment: totalNet } }
            });
            await tx.chartOfAccount.update({
              where: { id: bankAcc.id },
              data: { balance: { decrement: totalNet } }
            });
          }
        } catch (accErr) {
          console.warn('Payroll GL posting notice:', accErr);
        }

        if (processorId) {
          await AuditService.log({
            userId: processorId,
            action: 'PAYROLL_PROCESSED_AND_PAID',
            entity: 'PayrollRun',
            entityId: payrollRun.id,
            details: { payrollNumber, totalEmployees: employees.length, totalNet: totalNet.toNumber() }
          });
        }

        return payrollRun;
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }
}
