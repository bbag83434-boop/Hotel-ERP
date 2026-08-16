import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ApprovalService } from '../services/approval.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';
import {
  createApprovalRuleSchema,
  updateApprovalRuleSchema,
  createApprovalRequestSchema,
  actOnApprovalSchema
} from '../schemas/approval.schema';

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

export class ApprovalController {
  // 1. Summary Metrics
  public static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId } = req.query;
      const summary = await ApprovalService.getApprovalSummary(companyId, branchId as string);
      return sendSuccess(res, summary, 'Approval summary retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  // 2. Requests Queue
  public static async getRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, status, transactionType, requestedById } = req.query;
      const requests = await ApprovalService.getApprovalRequests(companyId, {
        branchId: branchId as string,
        status: status as any,
        transactionType: transactionType as any,
        requestedById: requestedById as string
      });
      return sendSuccess(res, requests, 'Approval requests retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createApprovalRequestSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const request = await ApprovalService.createApprovalRequest(
        companyId,
        data,
        req.user!.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, request, 'Approval request submitted', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async actOnRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const data = actOnApprovalSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const request = await ApprovalService.actOnApproval(
        companyId,
        String(id),
        data,
        req.user!.userId,
        req.user!.role,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, request, `Approval request ${data.action.toLowerCase()}`, 200);
    } catch (err) {
      next(err);
    }
  }

  // 3. Rules Matrix
  public static async getRules(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId } = req.query;
      const rules = await ApprovalService.getApprovalRules(companyId, branchId as string);
      return sendSuccess(res, rules, 'Approval rules retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createApprovalRuleSchema.parse(req.body);
      const rule = await ApprovalService.createApprovalRule(companyId, data, req.user?.userId);
      return sendSuccess(res, rule, 'Approval rule created', 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const data = updateApprovalRuleSchema.parse(req.body);
      const rule = await ApprovalService.updateApprovalRule(companyId, id, data, req.user?.userId);
      return sendSuccess(res, rule, 'Approval rule updated', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { id } = req.params;
      const result = await ApprovalService.deleteApprovalRule(companyId, id, req.user?.userId);
      return sendSuccess(res, result, 'Approval rule deleted', 200);
    } catch (err) {
      next(err);
    }
  }
}
