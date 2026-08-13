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
        isActive: true,
        role: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
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
        role: true
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
}
