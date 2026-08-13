"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRController = void 0;
const hr_service_1 = require("../services/hr.service");
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const hr_schema_1 = require("../schemas/hr.schema");
const resolveCompanyId = async (req) => {
    if (req.user?.companyId)
        return req.user.companyId;
    const company = await database_1.prisma.company.findFirst({ where: { isActive: true } });
    if (!company)
        throw new response_utils_1.AppError('No active company found in system', 400);
    return company.id;
};
const getClientIp = (req) => {
    const xf = req.headers['x-forwarded-for'];
    if (Array.isArray(xf))
        return xf[0] || '';
    if (typeof xf === 'string')
        return xf.split(',')[0].trim();
    return req.ip || '';
};
class HRController {
    // DEPARTMENTS
    static async getDepartments(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const depts = await hr_service_1.HRService.getDepartments(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, depts, 'Departments retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createDepartment(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hr_schema_1.createDepartmentSchema.parse(req.body);
            const dept = await hr_service_1.HRService.createDepartment(companyId, data, req.user?.userId);
            return (0, response_utils_1.sendSuccess)(res, dept, 'Department created', 201);
        }
        catch (err) {
            next(err);
        }
    }
    // EMPLOYEES
    static async getEmployees(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, departmentId, status, search } = req.query;
            const employees = await hr_service_1.HRService.getEmployees(companyId, {
                branchId: branchId,
                departmentId: departmentId,
                status: status,
                search: search
            });
            return (0, response_utils_1.sendSuccess)(res, employees, 'Employees retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createEmployee(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hr_schema_1.createEmployeeSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const employee = await hr_service_1.HRService.createEmployee(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, employee, 'Employee created', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async updateEmployeeStatus(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const { status } = hr_schema_1.updateEmployeeStatusSchema.parse(req.body);
            const employee = await hr_service_1.HRService.updateEmployeeStatus(companyId, String(id), status, req.user?.userId);
            return (0, response_utils_1.sendSuccess)(res, employee, 'Employee status updated', 200);
        }
        catch (err) {
            next(err);
        }
    }
    // ATTENDANCE & SHIFTS
    static async getShifts(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const shifts = await hr_service_1.HRService.getShifts(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, shifts, 'Shifts retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async getAttendances(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, date, employeeId } = req.query;
            const attendances = await hr_service_1.HRService.getAttendances(companyId, {
                branchId: branchId,
                date: date,
                employeeId: employeeId
            });
            return (0, response_utils_1.sendSuccess)(res, attendances, 'Attendance records retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async recordAttendance(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hr_schema_1.recordAttendanceSchema.parse(req.body);
            const attendance = await hr_service_1.HRService.recordAttendance(companyId, data, req.user?.userId);
            return (0, response_utils_1.sendSuccess)(res, attendance, 'Attendance recorded', 200);
        }
        catch (err) {
            next(err);
        }
    }
    // LEAVES
    static async getLeaveTypes(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const types = await hr_service_1.HRService.getLeaveTypes(companyId);
            return (0, response_utils_1.sendSuccess)(res, types, 'Leave types retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async getLeaveRequests(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, status, employeeId } = req.query;
            const leaves = await hr_service_1.HRService.getLeaveRequests(companyId, {
                branchId: branchId,
                status: status,
                employeeId: employeeId
            });
            return (0, response_utils_1.sendSuccess)(res, leaves, 'Leave requests retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createLeaveRequest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hr_schema_1.createLeaveRequestSchema.parse(req.body);
            const leave = await hr_service_1.HRService.createLeaveRequest(companyId, data, req.user?.userId);
            return (0, response_utils_1.sendSuccess)(res, leave, 'Leave request submitted', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async actOnLeaveRequest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const data = hr_schema_1.approveLeaveSchema.parse(req.body);
            const leave = await hr_service_1.HRService.actOnLeaveRequest(companyId, String(id), data, req.user.userId);
            return (0, response_utils_1.sendSuccess)(res, leave, `Leave request ${data.status.toLowerCase()}`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    // PAYROLL
    static async getPayrollRuns(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const runs = await hr_service_1.HRService.getPayrollRuns(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, runs, 'Payroll runs retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async executePayrollRun(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = hr_schema_1.createPayrollRunSchema.parse(req.body);
            const payroll = await hr_service_1.HRService.executePayrollRun(companyId, data, req.user?.userId);
            return (0, response_utils_1.sendSuccess)(res, payroll, 'Payroll run processed and disbursed with GL journal', 201);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.HRController = HRController;
