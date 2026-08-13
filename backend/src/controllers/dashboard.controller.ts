import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { DashboardService } from '../services/dashboard.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';

const resolveCompanyId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.companyId) return req.user.companyId;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new AppError('No active company found in system', 400);
  return company.id;
};

export class DashboardController {
  public static async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const { branchId, startDate, endDate } = req.query;
      const metrics = await DashboardService.getUnifiedExecutiveMetrics(companyId, {
        branchId: branchId as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      return sendSuccess(res, metrics, 'Executive dashboard metrics retrieved', 200);
    } catch (err) {
      next(err);
    }
  }
}
