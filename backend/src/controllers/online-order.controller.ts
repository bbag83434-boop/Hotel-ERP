import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { OnlineOrderService } from '../services/online-order.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';
import {
  generateTableQRSchema,
  placeOnlineOrderSchema,
  settleOnlinePaymentSchema
} from '../schemas/online-order.schema';

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
  if (!branch) throw new AppError('No active branch available', 400);
  return branch.id;
};

const getClientIp = (req: Request): string => {
  const xf = req.headers['x-forwarded-for'];
  if (Array.isArray(xf)) return xf[0] || '';
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || '';
};

export class OnlineOrderController {
  // ==========================================
  // PUBLIC DIGITAL QR ORDERING ENDPOINTS
  // ==========================================

  // 1. Get Public Menu
  public static async getMenu(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId, token } = req.query;
      const menu = await OnlineOrderService.getPublicMenu(branchId as string, token as string);
      return sendSuccess(res, menu, 'Public digital menu loaded', 200);
    } catch (err) {
      next(err);
    }
  }

  // 2. Resolve Table Session
  public static async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const session = await OnlineOrderService.getSessionDetails(token);
      return sendSuccess(res, session, 'QR Table session resolved', 200);
    } catch (err) {
      next(err);
    }
  }

  // 3. Place Order
  public static async placeOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = placeOnlineOrderSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const result = await OnlineOrderService.placeOnlineOrder(data, getClientIp(req), userAgent);
      return sendSuccess(res, result, 'Digital order placed and sent to kitchen', 201);
    } catch (err) {
      next(err);
    }
  }

  // 4. Settle Digital Payment
  public static async settlePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = settleOnlinePaymentSchema.parse(req.body);
      const company = await prisma.company.findFirst({ where: { isActive: true } });
      if (!company) throw new AppError('No company found', 400);

      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const result = await OnlineOrderService.settleOnlinePayment(
        company.id,
        data,
        undefined,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, result, 'Digital payment processed', 200);
    } catch (err) {
      next(err);
    }
  }

  // 5. Track Live Order Status
  public static async trackOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber } = req.params;
      const status = await OnlineOrderService.trackOrder(orderNumber);
      return sendSuccess(res, status, 'Live order status retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // AUTHENTICATED OUTLET MANAGER ENDPOINTS
  // ==========================================

  // 6. Generate QR for Table
  public static async generateQR(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId: explicitBranchId } = req.query;
      const branchId = await resolveBranchId(req, explicitBranchId as string);
      const data = generateTableQRSchema.parse(req.body);

      const qr = await OnlineOrderService.generateTableQR(companyId, branchId, data);
      return sendSuccess(res, qr, 'Table QR generated successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  // 7. Get Branch Tables QR List
  public static async getBranchTables(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId: explicitBranchId } = req.query;
      const branchId = await resolveBranchId(req, explicitBranchId as string);

      const tables = await OnlineOrderService.getBranchTablesQR(companyId, branchId);
      return sendSuccess(res, tables, 'Branch tables with QR retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  // 8. Get Online Orders Stream
  public static async getOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, status } = req.query;
      const orders = await OnlineOrderService.getOnlineOrders(companyId, {
        branchId: branchId as string,
        status: status as any
      });
      return sendSuccess(res, orders, 'Online orders stream retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
}
