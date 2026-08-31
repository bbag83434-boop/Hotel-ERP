export interface Department {
  id: string;
  companyId: string;
  branchId?: string;
  name: string;
  code: string;
  description?: string;
  headId?: string;
  head?: { id: string; firstName: string; lastName: string; email?: string };
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  companyId: string;
  branchId?: string;
  departmentId?: string;
  userId?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  designation: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  joinDate: string;
  basicSalary: number;
  allowances: number;
  bankAccount?: string;
  nidOrPassport?: string;
  emergencyContact?: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'PROBATION';
  department?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMins: number;
  isActive: boolean;
}

export interface Attendance {
  id: string;
  employeeId: string;
  shiftId?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE';
  workHours?: number;
  overtimeHours?: number;
  notes?: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    department?: { name: string };
  };
  shift?: Shift;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  daysAllowed: number;
  isPaid: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvedById?: string;
  approvedAt?: string;
  rejectionReason?: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    department?: { name: string };
  };
  leaveType?: LeaveType;
}

export interface PayrollRun {
  id: string;
  payrollNumber: string;
  month: number;
  year: number;
  totalGrossSalary: number;
  totalDeductions: number;
  totalNetSalary: number;
  status: 'DRAFT' | 'APPROVED' | 'PROCESSED' | 'PAID';
  runDate: string;
  payslips?: Payslip[];
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  basicSalary: number;
  allowances: number;
  overtimeAmount: number;
  deductions: number;
  netSalary: number;
  paymentStatus: string;
  paidAt?: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation: string;
    department?: { name: string };
  };
}
