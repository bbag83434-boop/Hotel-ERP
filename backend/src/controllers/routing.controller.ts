import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { RoutingService } from '../services/routing.service';
import { sendSuccess } from '../utils/response.utils';

export class RoutingController {
  public static async getDirectory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId || 'company-1';
      const branchId = req.query.branchId as string | undefined;

      const directory = await RoutingService.getRoutingDirectory(companyId, branchId);
      return sendSuccess(res, directory, 'Routing directory retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async resolvePoc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId || 'company-1';
      const { branchId, departmentId, section, workflowType, itemCategoryId } = req.body;

      const resolved = await RoutingService.resolvePoc({
        companyId,
        branchId,
        departmentId,
        section,
        workflowType,
        itemCategoryId
      });

      return sendSuccess(res, resolved, 'Assigned Point of Contact resolved dynamically');
    } catch (error) {
      next(error);
    }
  }

  public static async updatePoc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { departmentId, newPocUserId } = req.body;
      const actorId = req.user?.userId;
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
      const userAgent = req.headers['user-agent'] || '';

      const updated = await RoutingService.updateDepartmentPoc(
        departmentId,
        newPocUserId,
        actorId,
        ipAddress,
        userAgent
      );

      return sendSuccess(res, updated, 'Department Point of Contact (POC) updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
