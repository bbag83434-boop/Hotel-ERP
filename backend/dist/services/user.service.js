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
                isActive: true,
                role: { select: { id: true, name: true } },
                company: { select: { id: true, name: true } },
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
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
                role: true
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
}
exports.UserService = UserService;
