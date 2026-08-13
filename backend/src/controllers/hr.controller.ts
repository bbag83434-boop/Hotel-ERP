import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { HRService } from '../services/hr.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';
import {
  createDepartmentSchema,
  createEmployeeSchema,
  updateEmployeeStatusSchema,
  recordAttendanceSchema,
  createLeaveRequestSchema,
  approveLeaveSchema,
  createPayrollRunSchema
} from '../schemas/hr.schema';

const resolveCompanyId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.companyId) return req.user.companyId;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new AppError('No active company found in system', 400);
  return company.id;
};

const getClientIp = (req: AuthenticatedRequest): string => {
  const xf = req.headers['x-forwarded-for'];
  if (Array.isArray(xf)) return xf[0] || '';
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || '';
};

export class HRController {
  // DEPARTMENTS
  public static async getDepartments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const depts = await HRService.getDepartments(companyId, branchId);
      return sendSuccess(res, depts, 'Departments retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createDepartmentSchema.parse(req.body);
      const dept = await HRService.createDepartment(companyId, data, req.user?.userId);
      return sendSuccess(res, dept, 'Department created', 201);
    } catch (err) {
      next(err);
    }
  }

  // EMPLOYEES
  public static async getEmployees(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, departmentId, status, search } = req.query;
      const employees = await HRService.getEmployees(companyId, {
        branchId: branchId as string,
        departmentId: departmentId as string,
        status: status as any,
        search: search as string
      });
      return sendSuccess(res, employees, 'Employees retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createEmployeeSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const employee = await HRService.createEmployee(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, employee, 'Employee created', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateEmployeeStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const { status } = updateEmployeeStatusSchema.parse(req.body);
      const employee = await HRService.updateEmployeeStatus(companyId, String(id), status, req.user?.userId);
      return sendSuccess(res, employee, 'Employee status updated', 200);
    } catch (err) {
      next(err);
    }
  }

  // ATTENDANCE & SHIFTS
  public static async getShifts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const shifts = await HRService.getShifts(companyId, branchId);
      return sendSuccess(res, shifts, 'Shifts retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getAttendances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, date, employeeId } = req.query;
      const attendances = await HRService.getAttendances(companyId, {
        branchId: branchId as string,
        date: date as string,
        employeeId: employeeId as string
      });
      return sendSuccess(res, attendances, 'Attendance records retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async recordAttendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = recordAttendanceSchema.parse(req.body);
      const attendance = await HRService.recordAttendance(companyId, data, req.user?.userId);
      return sendSuccess(res, attendance, 'Attendance recorded', 200);
    } catch (err) {
      next(err);
    }
  }

  // LEAVES
  public static async getLeaveTypes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const types = await HRService.getLeaveTypes(companyId);
      return sendSuccess(res, types, 'Leave types retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getLeaveRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, status, employeeId } = req.query;
      const leaves = await HRService.getLeaveRequests(companyId, {
        branchId: branchId as string,
        status: status as any,
        employeeId: employeeId as string
      });
      return sendSuccess(res, leaves, 'Leave requests retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createLeaveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createLeaveRequestSchema.parse(req.body);
      const leave = await HRService.createLeaveRequest(companyId, data, req.user?.userId);
      return sendSuccess(res, leave, 'Leave request submitted', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async actOnLeaveRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const data = approveLeaveSchema.parse(req.body);
      const leave = await HRService.actOnLeaveRequest(companyId, String(id), data, req.user!.userId);
      return sendSuccess(res, leave, `Leave request ${data.status.toLowerCase()}`, 200);
    } catch (err) {
      next(err);
    }
  }

  // PAYROLL
  public static async getPayrollRuns(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const runs = await HRService.getPayrollRuns(companyId, branchId);
      return sendSuccess(res, runs, 'Payroll runs retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async executePayrollRun(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createPayrollRunSchema.parse(req.body);
      const payroll = await HRService.executePayrollRun(companyId, data, req.user?.userId);
      return sendSuccess(res, payroll, 'Payroll run processed and disbursed with GL journal', 201);
    } catch (err) {
      next(err);
    }
  }
}
