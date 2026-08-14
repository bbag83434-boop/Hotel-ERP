import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError } from '../utils/response.utils';
import { prisma } from '../config/database';

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Access forbidden: Insufficient role permissions', 403));
    }

    next();
  };
};

export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasPermission = requiredPermissions.every((perm) => userPerms.includes(perm));

    if (!hasPermission) {
      return next(new AppError('Access forbidden: Missing required permission(s)', 403));
    }

    next();
  };
};

/**
 * Outlet / Branch Isolation Middleware
 * Prevents a user authorized for Outlet A from accessing Outlet B data by changing branchId/outlet_id in query, params, body, or header.
 */
export const requireBranchAccess = (branchKey: string = 'branchId') => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      // SUPER_ADMIN has global company-wide access across all branches
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Extract branchId from params, query, body, or custom header
      const targetBranchId =
        req.params[branchKey] ||
        (req.query[branchKey] as string) ||
        (req.query.outlet_id as string) ||
        req.body[branchKey] ||
        req.body.outlet_id ||
        (req.headers['x-branch-id'] as string);

      if (!targetBranchId) {
        return next();
      }

      // Query database to ensure user is explicitly authorized for this branch in UserBranch
      const userBranch = await prisma.userBranch.findUnique({
        where: {
          userId_branchId: {
            userId: req.user.userId,
            branchId: targetBranchId
          }
        }
      });

      if (!userBranch) {
        return next(
          new AppError(
            `Access forbidden: You do not have authorization to access outlet/branch "${targetBranchId}".`,
            403
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};


