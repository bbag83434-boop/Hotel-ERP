import { prisma } from '../config/database';
import { CreateBranchDto } from '../schemas/branch.schema';
import { AppError } from '../utils/response.utils';

export class BranchService {
  /**
   * Get all active branches for a company
   */
  static async getBranches(companyId: string) {
    return prisma.branch.findMany({
      where: {
        companyId,
        isActive: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        code: true,
        type: true,
        email: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  /**
   * Create a new branch under a company with multi-tenant isolation
   */
  static async createBranch(companyId: string, userId: string, data: CreateBranchDto) {
    // 1. Verify Company exists & active
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });
    if (!company || !company.isActive) {
      throw new AppError('Active company not found', 404);
    }

    // 2. Check for duplicate branch code
    const existingBranch = await prisma.branch.findUnique({
      where: { code: data.code.toUpperCase() }
    });
    if (existingBranch) {
      throw new AppError(`Branch with code "${data.code}" already exists`, 409);
    }

    // 3. Create branch in transaction & automatically grant access to creating user
    const newBranch = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          companyId,
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          type: data.type,
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          address: data.address.trim(),
          isActive: true
        }
      });

      // Grant UserBranch membership to the creator
      if (userId) {
        await tx.userBranch.upsert({
          where: {
            userId_branchId: {
              userId,
              branchId: branch.id
            }
          },
          update: {},
          create: {
            userId,
            branchId: branch.id,
            isDefault: false
          }
        });
      }

      // Record audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_BRANCH',
          entity: 'Branch',
          entityId: branch.id,
          details: {
            name: branch.name,
            code: branch.code,
            type: branch.type,
            companyId
          }
        }
      });

      return branch;
    });

    return newBranch;
  }
}
