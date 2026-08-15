import { Response, NextFunction } from 'express';
import { BranchService } from '../services/branch.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSuccess, AppError } from '../utils/response.utils';

export class BranchController {
  public static async getBranches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        throw new AppError('Unauthorized: Company context required', 401);
      }

      const branches = await BranchService.getBranches(companyId);
      return sendSuccess(res, branches, 'Branches retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async createBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.userId;
      if (!companyId || !userId) {
        throw new AppError('Unauthorized: Company context required', 401);
      }

      const branch = await BranchService.createBranch(companyId, userId, req.body);
      return sendSuccess(res, branch, 'Branch created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
