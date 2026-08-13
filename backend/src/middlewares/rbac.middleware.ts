import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError } from '../utils/response.utils';

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
