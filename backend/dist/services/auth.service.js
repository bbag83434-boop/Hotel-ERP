"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const password_utils_1 = require("../utils/password.utils");
const jwt_utils_1 = require("../utils/jwt.utils");
const audit_service_1 = require("./audit.service");
class AuthService {
    static async login(identifier, password, ipAddress, userAgent) {
        const user = await database_1.prisma.user.findFirst({
            where: {
                OR: [{ email: identifier }, { username: identifier }]
            },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                },
                company: true,
                branches: {
                    include: { branch: true }
                }
            }
        });
        if (!user) {
            throw new response_utils_1.AppError('Invalid credentials', 401);
        }
        if (!user.isActive) {
            throw new response_utils_1.AppError('Account is deactivated. Please contact administrator.', 403);
        }
        const isValidPassword = await (0, password_utils_1.comparePassword)(password, user.passwordHash);
        if (!isValidPassword) {
            throw new response_utils_1.AppError('Invalid credentials', 401);
        }
        const permissionCodes = user.role.permissions.map((rp) => rp.permission.code);
        const accessToken = (0, jwt_utils_1.generateAccessToken)({
            userId: user.id,
            email: user.email,
            role: user.role.name,
            permissions: permissionCodes,
            companyId: user.companyId || undefined
        });
        const refreshToken = (0, jwt_utils_1.generateRefreshToken)(user.id);
        // Save refresh token to DB and update last login
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: {
                refreshToken,
                lastLoginAt: new Date()
            }
        });
        // Create Audit Log entry
        await audit_service_1.AuditService.log({
            userId: user.id,
            action: 'USER_LOGIN',
            entity: 'Auth',
            entityId: user.id,
            details: { email: user.email, role: user.role.name },
            ipAddress,
            userAgent
        });
        const defaultBranch = user.branches.find((b) => b.isDefault)?.branch || user.branches[0]?.branch || null;
        const userProfile = {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            role: {
                id: user.role.id,
                name: user.role.name,
                permissions: permissionCodes
            },
            company: user.company
                ? {
                    id: user.company.id,
                    name: user.company.name,
                    code: user.company.code
                }
                : null,
            branches: user.branches.map((ub) => ({
                id: ub.branch.id,
                name: ub.branch.name,
                code: ub.branch.code,
                type: ub.branch.type,
                isDefault: ub.isDefault
            })),
            defaultBranch: defaultBranch
                ? {
                    id: defaultBranch.id,
                    name: defaultBranch.name,
                    code: defaultBranch.code,
                    type: defaultBranch.type
                }
                : null
        };
        return {
            accessToken,
            refreshToken,
            user: userProfile
        };
    }
    static async refreshAccessToken(token) {
        try {
            const decoded = (0, jwt_utils_1.verifyRefreshToken)(token);
            const user = await database_1.prisma.user.findUnique({
                where: { id: decoded.userId },
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true }
                            }
                        }
                    }
                }
            });
            if (!user || user.refreshToken !== token || !user.isActive) {
                throw new response_utils_1.AppError('Invalid refresh token or user inactive', 401);
            }
            const permissionCodes = user.role.permissions.map((rp) => rp.permission.code);
            const newAccessToken = (0, jwt_utils_1.generateAccessToken)({
                userId: user.id,
                email: user.email,
                role: user.role.name,
                permissions: permissionCodes,
                companyId: user.companyId || undefined
            });
            const newRefreshToken = (0, jwt_utils_1.generateRefreshToken)(user.id);
            await database_1.prisma.user.update({
                where: { id: user.id },
                data: { refreshToken: newRefreshToken }
            });
            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            };
        }
        catch (err) {
            throw new response_utils_1.AppError('Invalid or expired refresh token', 401);
        }
    }
    static async logout(userId, ipAddress, userAgent) {
        await database_1.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null }
        });
        await audit_service_1.AuditService.log({
            userId,
            action: 'USER_LOGOUT',
            entity: 'Auth',
            entityId: userId,
            ipAddress,
            userAgent
        });
    }
    static async getMe(userId) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                },
                company: true,
                branches: {
                    include: { branch: true }
                }
            }
        });
        if (!user || !user.isActive) {
            throw new response_utils_1.AppError('User not found or inactive', 404);
        }
        const permissionCodes = user.role.permissions.map((rp) => rp.permission.code);
        const defaultBranch = user.branches.find((b) => b.isDefault)?.branch || user.branches[0]?.branch || null;
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            role: {
                id: user.role.id,
                name: user.role.name,
                permissions: permissionCodes
            },
            company: user.company
                ? {
                    id: user.company.id,
                    name: user.company.name,
                    code: user.company.code
                }
                : null,
            branches: user.branches.map((ub) => ({
                id: ub.branch.id,
                name: ub.branch.name,
                code: ub.branch.code,
                type: ub.branch.type,
                isDefault: ub.isDefault
            })),
            defaultBranch: defaultBranch
                ? {
                    id: defaultBranch.id,
                    name: defaultBranch.name,
                    code: defaultBranch.code,
                    type: defaultBranch.type
                }
                : null
        };
    }
}
exports.AuthService = AuthService;
