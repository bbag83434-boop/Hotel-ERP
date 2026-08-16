import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { CashierShiftService } from '../services/cashier-shift.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';
import {
  openShiftSchema,
  cashMovementSchema,
  closeShiftSchema,
  reconcileShiftSchema
} from '../schemas/cashier-shift.schema';

const resolveCompanyId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.companyId) return req.user.companyId;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new AppError('No active company found in system', 400);
  return company.id;
};

const resolveBranchId = async (req: AuthenticatedRequest, explicitBranchId?: string): Promise<string> => {
  if (explicitBranchId) return explicitBranchId;
  const companyId = await resolveCompanyId(req);
  if (req.user?.userId) {
    const userBranch = await prisma.userBranch.findFirst({
      where: { userId: req.user.userId }
    });
    if (userBranch?.branchId) return userBranch.branchId;
  }
  const branch = await prisma.branch.findFirst({
    where: { companyId, isActive: true }
  });
  if (!branch) throw new AppError('No active branch available for this operation', 400);
  return branch.id;
};

const getClientIp = (req: AuthenticatedRequest): string => {
  const xf = req.headers['x-forwarded-for'];
  if (Array.isArray(xf)) return xf[0] || '';
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || '';
};

export class CashierShiftController {
  // Get active session
  public static async getActiveSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const session = await CashierShiftService.getActiveSession(
        companyId,
        branchId,
        req.user?.userId
      );
      return sendSuccess(res, session, 'Active cashier shift retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  // Open shift
  public static async openSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = openShiftSchema.parse(req.body);
      const branchId = await resolveBranchId(req, data.branchId);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];

      const session = await CashierShiftService.openSession(
        companyId,
        branchId,
        req.user!.userId,
        data.openingFloat,
        data.notes,
        getClientIp(req),
        userAgent
      );

      return sendSuccess(res, session, 'Cashier shift opened successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  // Cash movement (Cash In / Out / Safe Drop)
  public static async recordCashMovement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = cashMovementSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];

      const movement = await CashierShiftService.recordCashMovement(
        companyId,
        data.sessionId,
        req.user!.userId,
        {
          movementType: data.movementType,
          amount: data.amount,
          reason: data.reason
        },
        getClientIp(req),
        userAgent
      );

      return sendSuccess(res, movement, 'Cash drawer movement recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  // Close shift
  public static async closeSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = closeShiftSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];

      const session = await CashierShiftService.closeSession(
        companyId,
        data.sessionId,
        req.user!.userId,
        {
          closingCash: data.closingCash,
          notes: data.notes,
          varianceReason: data.varianceReason
        },
        getClientIp(req),
        userAgent
      );

      return sendSuccess(res, session, 'Cashier shift closed and reconciled successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  // Manager Reconciliation Signoff
  public static async reconcileSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = reconcileShiftSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];

      const session = await CashierShiftService.reconcileSession(
        companyId,
        data.sessionId,
        req.user!.userId,
        data.notes,
        getClientIp(req),
        userAgent
      );

      return sendSuccess(res, session, 'Cashier shift reconciled by manager', 200);
    } catch (err) {
      next(err);
    }
  }

  // Shift History
  public static async getSessionHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const cashierId = (req.query.cashierId as string) || undefined;
      const status = (req.query.status as any) || undefined;
      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;

      const history = await CashierShiftService.getSessionHistory(companyId, {
        branchId,
        cashierId,
        status,
        startDate,
        endDate
      });

      return sendSuccess(res, history, 'Cashier shift history retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  // Single shift summary
  public static async getSessionSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const sessionId = req.params.sessionId;
      const summary = await CashierShiftService.getSessionSummary(companyId, sessionId);
      return sendSuccess(res, summary, 'Shift summary retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}
