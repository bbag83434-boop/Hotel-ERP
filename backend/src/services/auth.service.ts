import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { comparePassword } from '../utils/password.utils';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.utils';
import { AuditService } from './audit.service';

export class AuthService {
  public static async login(
    identifier: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await prisma.user.findFirst({
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
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact administrator.', 403);
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    const permissionCodes = user.role.permissions.map((rp) => rp.permission.code);

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role.name,
      permissions: permissionCodes,
      companyId: user.companyId || undefined
    });

    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token to DB and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLoginAt: new Date()
      }
    });

    // Create Audit Log entry
    await AuditService.log({
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

  public static async refreshAccessToken(token: string) {
    try {
      const decoded = verifyRefreshToken(token);
      const user = await prisma.user.findUnique({
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
        throw new AppError('Invalid refresh token or user inactive', 401);
      }

      const permissionCodes = user.role.permissions.map((rp) => rp.permission.code);

      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role.name,
        permissions: permissionCodes,
        companyId: user.companyId || undefined
      });

      const newRefreshToken = generateRefreshToken(user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken }
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  public static async logout(userId: string, ipAddress?: string, userAgent?: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });

    await AuditService.log({
      userId,
      action: 'USER_LOGOUT',
      entity: 'Auth',
      entityId: userId,
      ipAddress,
      userAgent
    });
  }

  public static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
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
      throw new AppError('User not found or inactive', 404);
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
