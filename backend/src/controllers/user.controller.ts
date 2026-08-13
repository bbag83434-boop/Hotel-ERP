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
}
