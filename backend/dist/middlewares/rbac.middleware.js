"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.requireRole = void 0;
const response_utils_1 = require("../utils/response.utils");
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
