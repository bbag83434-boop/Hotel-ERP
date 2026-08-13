import { z } from 'zod';

export const createDepartmentSchema = z.object({
  branchId: z.string().optional(),
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Code is required').toUpperCase(),
  description: z.string().optional(),
  headId: z.string().optional()
});

export const createEmployeeSchema = z.object({
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  employeeCode: z.string().min(2, 'Employee code is required'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  designation: z.string().min(2, 'Designation is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
  joinDate: z.string().optional(),
  basicSalary: z.number().min(0, 'Basic salary must be non-negative'),
  allowances: z.number().min(0).default(0),
  bankAccount: z.string().optional(),
  nidOrPassport: z.string().optional(),
  emergencyContact: z.string().optional()
});

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION'])
});

export const recordAttendanceSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  shiftId: z.string().optional(),
  date: z.string().min(10, 'Date is required (YYYY-MM-DD)'),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE']).default('PRESENT'),
  workHours: z.number().optional(),
  overtimeHours: z.number().optional(),
  notes: z.string().optional()
});

export const createLeaveRequestSchema = z.object({
  branchId: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  leaveTypeId: z.string().min(1, 'Leave Type ID is required'),
  startDate: z.string().min(10, 'Start date is required'),
  endDate: z.string().min(10, 'End date is required'),
  totalDays: z.number().min(1, 'Total days must be at least 1'),
  reason: z.string().min(3, 'Reason is required')
});

export const approveLeaveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional()
});

export const createPayrollRunSchema = z.object({
  branchId: z.string().optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100)
});
