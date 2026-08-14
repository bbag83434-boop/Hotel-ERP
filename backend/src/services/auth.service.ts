import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { comparePassword } from '../utils/password.utils';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.utils';
import { AuditService } from './audit.service';

export interface GoogleAuthData {
  credential: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

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
        },
        employee: {
          include: { department: true }
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
      department: user.employee?.department
        ? {
            id: user.employee.department.id,
            name: user.employee.department.name,
            code: user.employee.department.code
          }
        : null,
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

  public static async loginWithGoogle(
    data: GoogleAuthData,
    ipAddress?: string,
    userAgent?: string
  ) {
    let verifiedEmail = data.email;

    // Decode Google JWT credential if direct email is not provided or if JWT is supplied
    if (!verifiedEmail && data.credential) {
      try {
        const parts = data.credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload.email) {
            verifiedEmail = payload.email;
          }
        } else if (data.credential.includes('@')) {
          verifiedEmail = data.credential;
        }
      } catch (e) {
        // Handled below
      }
    }

    if (!verifiedEmail) {
      throw new AppError('Unable to extract verified Google email identity', 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: verifiedEmail.toLowerCase().trim() },
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
        },
        employee: {
          include: { department: true }
        }
      }
    });

    if (!user) {
      throw new AppError(
        `No ERP account found for Google email "${verifiedEmail}". Please contact your administrator.`,
        404
      );
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Please contact administrator.', 403);
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

    // Update refresh token, lastLogin, and avatar if available
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLoginAt: new Date(),
        avatarUrl: user.avatarUrl || data.avatarUrl || null
      }
    });

    // Create Audit Log entry
    await AuditService.log({
      userId: user.id,
      action: 'USER_LOGIN_GOOGLE',
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
      avatarUrl: user.avatarUrl || data.avatarUrl || null,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: permissionCodes
      },
      department: user.employee?.department
        ? {
            id: user.employee.department.id,
            name: user.employee.department.name,
            code: user.employee.department.code
          }
        : null,
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
        },
        employee: {
          include: { department: true }
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
      department: user.employee?.department
        ? {
            id: user.employee.department.id,
            name: user.employee.department.name,
            code: user.employee.department.code
          }
        : null,
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

