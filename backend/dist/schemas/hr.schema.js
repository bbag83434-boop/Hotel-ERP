"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayrollRunSchema = exports.approveLeaveSchema = exports.createLeaveRequestSchema = exports.recordAttendanceSchema = exports.updateEmployeeStatusSchema = exports.createEmployeeSchema = exports.createDepartmentSchema = void 0;
const zod_1 = require("zod");
exports.createDepartmentSchema = zod_1.z.object({
    branchId: zod_1.z.string().optional(),
    name: zod_1.z.string().min(2, 'Department name is required'),
    code: zod_1.z.string().min(2, 'Code is required').toUpperCase(),
    description: zod_1.z.string().optional(),
    headId: zod_1.z.string().optional()
});
exports.createEmployeeSchema = zod_1.z.object({
    branchId: zod_1.z.string().optional(),
    departmentId: zod_1.z.string().optional(),
    userId: zod_1.z.string().optional(),
    employeeCode: zod_1.z.string().min(2, 'Employee code is required'),
    firstName: zod_1.z.string().min(2, 'First name is required'),
    lastName: zod_1.z.string().min(2, 'Last name is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    designation: zod_1.z.string().min(2, 'Designation is required'),
    employmentType: zod_1.z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).default('FULL_TIME'),
    joinDate: zod_1.z.string().optional(),
    basicSalary: zod_1.z.number().min(0, 'Basic salary must be non-negative'),
    allowances: zod_1.z.number().min(0).default(0),
    bankAccount: zod_1.z.string().optional(),
    nidOrPassport: zod_1.z.string().optional(),
    emergencyContact: zod_1.z.string().optional()
});
exports.updateEmployeeStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION'])
});
exports.recordAttendanceSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    shiftId: zod_1.z.string().optional(),
    date: zod_1.z.string().min(10, 'Date is required (YYYY-MM-DD)'),
    checkIn: zod_1.z.string().optional(),
    checkOut: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE']).default('PRESENT'),
    workHours: zod_1.z.number().optional(),
    overtimeHours: zod_1.z.number().optional(),
    notes: zod_1.z.string().optional()
});
exports.createLeaveRequestSchema = zod_1.z.object({
    branchId: zod_1.z.string().optional(),
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    leaveTypeId: zod_1.z.string().min(1, 'Leave Type ID is required'),
    startDate: zod_1.z.string().min(10, 'Start date is required'),
    endDate: zod_1.z.string().min(10, 'End date is required'),
    totalDays: zod_1.z.number().min(1, 'Total days must be at least 1'),
    reason: zod_1.z.string().min(3, 'Reason is required')
});
exports.approveLeaveSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: zod_1.z.string().optional()
});
exports.createPayrollRunSchema = zod_1.z.object({
    branchId: zod_1.z.string().optional(),
    month: zod_1.z.number().min(1).max(12),
    year: zod_1.z.number().min(2020).max(2100)
});
