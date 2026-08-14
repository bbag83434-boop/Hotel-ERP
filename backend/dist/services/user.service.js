"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const password_utils_1 = require("../utils/password.utils");
const audit_service_1 = require("./audit.service");
class UserService {
    static async getUsers() {
        return database_1.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarUrl: true,
                isActive: true,
                role: { select: { id: true, name: true, description: true } },
                company: { select: { id: true, name: true, code: true } },
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        designation: true,
                        department: { select: { id: true, name: true, code: true } }
                    }
                },
                branches: {
                    select: {
                        branch: { select: { id: true, name: true, code: true, type: true } },
                        isDefault: true
                    }
                },
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    static async getUserById(id) {
        const user = await database_1.prisma.user.findUnique({
            where: { id },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                },
                company: true,
                employee: {
                    include: { department: true }
                },
                branches: {
                    include: { branch: true }
                }
            }
        });
        if (!user) {
            throw new response_utils_1.AppError('User not found', 404);
        }
        return user;
    }
    static async createUser(data, actorId, ipAddress, userAgent) {
        const existingUser = await database_1.prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { username: data.username }]
            }
        });
        if (existingUser) {
            throw new response_utils_1.AppError('User with this email or username already exists', 400);
        }
        const passwordHash = await (0, password_utils_1.hashPassword)(data.password);
        const newUser = await database_1.prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                roleId: data.roleId,
                companyId: data.companyId,
                branches: data.branchIds
                    ? {
                        create: data.branchIds.map((branchId, idx) => ({
                            branchId,
                            isDefault: idx === 0
                        }))
                    }
                    : undefined
            },
            include: {
                role: true,
                branches: { include: { branch: true } }
            }
        });
        // Create Audit Log entry for write action per Section 17
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'USER_CREATE',
            entity: 'User',
            entityId: newUser.id,
            details: {
                after: {
                    id: newUser.id,
                    email: newUser.email,
                    username: newUser.username,
                    role: newUser.role.name
                }
            },
            ipAddress,
            userAgent
        });
        return newUser;
    }
    static async updateUserStatus(userId, isActive, actorId, ipAddress, userAgent) {
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new response_utils_1.AppError('User not found', 404);
        }
        const updated = await database_1.prisma.user.update({
            where: { id: userId },
            data: { isActive }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
            entity: 'User',
            entityId: userId,
            details: { previousStatus: user.isActive, newStatus: isActive },
            ipAddress,
            userAgent
        });
        return updated;
    }
    static async assignUserBranches(userId, branchIds, defaultBranchId, actorId, ipAddress, userAgent) {
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new response_utils_1.AppError('User not found', 404);
        }
        // Atomically replace user branches in a transaction
        await database_1.prisma.$transaction(async (tx) => {
            await tx.userBranch.deleteMany({
                where: { userId }
            });
            if (branchIds && branchIds.length > 0) {
                await tx.userBranch.createMany({
                    data: branchIds.map((branchId, idx) => ({
                        userId,
                        branchId,
                        isDefault: defaultBranchId ? branchId === defaultBranchId : idx === 0
                    }))
                });
            }
        });
        if (actorId) {
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'USER_BRANCHES_UPDATE',
                entity: 'UserBranch',
                entityId: userId,
                details: { branchIds, defaultBranchId },
                ipAddress,
                userAgent
            });
        }
        return database_1.prisma.userBranch.findMany({
            where: { userId },
            include: { branch: true }
        });
    }
    static async getRoles() {
        return database_1.prisma.role.findMany({
            include: {
                permissions: {
                    include: { permission: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    }
    static async getPermissions() {
        return database_1.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { action: 'asc' }]
        });
    }
}
exports.UserService = UserService;
