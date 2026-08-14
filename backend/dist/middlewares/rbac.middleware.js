"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireBranchAccess = exports.requirePermission = exports.requireRole = void 0;
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const requireRole = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new response_utils_1.AppError('Authentication required', 401));
        }
        if (req.user.role === 'SUPER_ADMIN') {
            return next();
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new response_utils_1.AppError('Access forbidden: Insufficient role permissions', 403));
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePermission = (...requiredPermissions) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new response_utils_1.AppError('Authentication required', 401));
        }
        if (req.user.role === 'SUPER_ADMIN') {
            return next();
        }
        const userPerms = req.user.permissions || [];
        const hasPermission = requiredPermissions.every((perm) => userPerms.includes(perm));
        if (!hasPermission) {
            return next(new response_utils_1.AppError('Access forbidden: Missing required permission(s)', 403));
        }
        next();
    };
};
exports.requirePermission = requirePermission;
/**
 * Outlet / Branch Isolation Middleware
 * Prevents a user authorized for Outlet A from accessing Outlet B data by changing branchId/outlet_id in query, params, body, or header.
 */
const requireBranchAccess = (branchKey = 'branchId') => {
    return async (req, _res, next) => {
        try {
            if (!req.user) {
                return next(new response_utils_1.AppError('Authentication required', 401));
            }
            // SUPER_ADMIN has global company-wide access across all branches
            if (req.user.role === 'SUPER_ADMIN') {
                return next();
            }
            // Extract branchId from params, query, body, or custom header
            const targetBranchId = req.params[branchKey] ||
                req.query[branchKey] ||
                req.query.outlet_id ||
                req.body[branchKey] ||
                req.body.outlet_id ||
                req.headers['x-branch-id'];
            if (!targetBranchId) {
                return next();
            }
            // Query database to ensure user is explicitly authorized for this branch in UserBranch
            const userBranch = await database_1.prisma.userBranch.findUnique({
                where: {
                    userId_branchId: {
                        userId: req.user.userId,
                        branchId: targetBranchId
                    }
                }
            });
            if (!userBranch) {
                return next(new response_utils_1.AppError(`Access forbidden: You do not have authorization to access outlet/branch "${targetBranchId}".`, 403));
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireBranchAccess = requireBranchAccess;
