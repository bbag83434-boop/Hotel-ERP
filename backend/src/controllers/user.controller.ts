import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserService } from '../services/user.service';
import { sendSuccess } from '../utils/response.utils';

export class UserController {
  public static async getUsers(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const users = await UserService.getUsers();
      return sendSuccess(res, users, 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await UserService.getUserById(req.params.id);
      return sendSuccess(res, user, 'User details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const actorId = req.user?.userId || 'SYSTEM';
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
      const userAgent = req.headers['user-agent'] || '';

      const newUser = await UserService.createUser(req.body, actorId, ipAddress, userAgent);
      return sendSuccess(res, newUser, 'User created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const actorId = req.user?.userId || 'SYSTEM';
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
      const userAgent = req.headers['user-agent'] || '';
      const { isActive } = req.body;

      const updated = await UserService.updateUserStatus(
        req.params.id,
        Boolean(isActive),
        actorId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, updated, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  public static async assignUserBranches(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const actorId = req.user?.userId || 'SYSTEM';
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || '';
      const userAgent = req.headers['user-agent'] || '';
      const { branchIds, defaultBranchId } = req.body;

      const userBranches = await UserService.assignUserBranches(
        req.params.id,
        branchIds || [],
        defaultBranchId,
        actorId,
        ipAddress,
        userAgent
      );
      return sendSuccess(res, userBranches, 'User outlet permissions updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getRoles(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roles = await UserService.getRoles();
      return sendSuccess(res, roles, 'Roles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getPermissions(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const permissions = await UserService.getPermissions();
      return sendSuccess(res, permissions, 'Permissions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

