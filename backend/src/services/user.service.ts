import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { hashPassword } from '../utils/password.utils';
import { AuditService } from './audit.service';

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  roleId: string;
  companyId?: string;
  branchIds?: string[];
}

export class UserService {
  public static async getUsers() {
    return prisma.user.findMany({
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

  public static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
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
      throw new AppError('User not found', 404);
    }

    return user;
  }

  public static async createUser(
    data: CreateUserData,
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }]
      }
    });

    if (existingUser) {
      throw new AppError('User with this email or username already exists', 400);
    }

    const passwordHash = await hashPassword(data.password);

    const newUser = await prisma.user.create({
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
    await AuditService.log({
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

  public static async updateUserStatus(
    userId: string,
    isActive: boolean,
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    });

    await AuditService.log({
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

  public static async assignUserBranches(
    userId: string,
    branchIds: string[],
    defaultBranchId?: string,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Atomically replace user branches in a transaction
    await prisma.$transaction(async (tx) => {
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
      await AuditService.log({
        userId: actorId,
        action: 'USER_BRANCHES_UPDATE',
        entity: 'UserBranch',
        entityId: userId,
        details: { branchIds, defaultBranchId },
        ipAddress,
        userAgent
      });
    }

    return prisma.userBranch.findMany({
      where: { userId },
      include: { branch: true }
    });
  }

  public static async getRoles() {
    return prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  public static async getPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }]
    });
  }
}

