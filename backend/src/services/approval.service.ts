import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';
import { Prisma, ApprovalType, ApprovalStatus } from '@prisma/client';

export class ApprovalService {
  // 1. Create Approval Request
  public static async createApprovalRequest(
    companyId: string,
    data: {
      branchId?: string;
      transactionType: ApprovalType;
      referenceId: string;
      amount?: number;
      title: string;
      description?: string;
    },
    requestedById: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const { branchId, transactionType, referenceId, amount, title, description } = data;

    // Check if matching rules exist
    const rules = await prisma.approvalRule.findMany({
      where: {
        companyId,
        transactionType,
        isActive: true
      },
      orderBy: { stepNumber: 'asc' }
    });

    const totalSteps = rules.length > 0 ? Math.max(...rules.map((r) => r.stepNumber)) : 1;
    const count = await prisma.approvalRequest.count({ where: { companyId } });
    const requestNumber = `APR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const request = await prisma.approvalRequest.create({
      data: {
        companyId,
        branchId,
        requestNumber,
        transactionType,
        referenceId,
        amount: amount ? new Prisma.Decimal(amount) : null,
        title,
        description,
        status: 'PENDING',
        requestedById,
        currentStep: 1,
        totalSteps
      },
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
        }
      }
    });

    await AuditService.log({
      userId: requestedById,
      action: 'APPROVAL_REQUESTED',
      entity: 'ApprovalRequest',
      entityId: request.id,
      details: { requestNumber, transactionType, referenceId, amount, title },
      ipAddress,
      userAgent
    });

    return request;
  }

  // 2. Get Approval Requests
  public static async getApprovalRequests(
    companyId: string,
    filters?: {
      branchId?: string;
      status?: ApprovalStatus;
      transactionType?: ApprovalType;
    }
  ) {
    const where: Prisma.ApprovalRequestWhereInput = {
      companyId,
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.transactionType ? { transactionType: filters.transactionType } : {})
    };

    return prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
        },
        actions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 3. Act on Approval (Approve / Reject / Cancel)
  public static async actOnApproval(
    companyId: string,
    requestId: string,
    data: {
      action: ApprovalStatus;
      comment?: string;
    },
    userId: string,
    userRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({
        where: { id: requestId }
      });

      if (!request || request.companyId !== companyId) {
        throw new AppError('Approval request not found', 404);
      }

      if (request.status !== 'PENDING') {
        throw new AppError(`Cannot act on a request with status ${request.status}`, 400);
      }

      const previousStatus = request.status;
      let newStatus: ApprovalStatus = data.action;
      let nextStep = request.currentStep;

      if (data.action === 'APPROVED') {
        if (request.currentStep < request.totalSteps) {
          nextStep = request.currentStep + 1;
          newStatus = 'PENDING'; // Still pending next step
        } else {
          newStatus = 'APPROVED';
        }
      }

      // Record Action
      await tx.approvalAction.create({
        data: {
          approvalRequestId: request.id,
          userId,
          userRole,
          action: data.action,
          previousStatus,
          newStatus,
          comment: data.comment
        }
      });

      // Update Request
      const updatedRequest = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: newStatus,
          currentStep: nextStep
        },
        include: {
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          actions: true
        }
      });

      await AuditService.log({
        userId,
        action: `APPROVAL_${data.action}`,
        entity: 'ApprovalRequest',
        entityId: request.id,
        details: {
          requestNumber: request.requestNumber,
          action: data.action,
          comment: data.comment,
          previousStatus,
          newStatus
        },
        ipAddress,
        userAgent
      });

      return updatedRequest;
    });
  }

  // 4. Approval Rules CRUD
  public static async getApprovalRules(companyId: string, branchId?: string) {
    return prisma.approvalRule.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {})
      },
      orderBy: [{ transactionType: 'asc' }, { stepNumber: 'asc' }]
    });
  }

  public static async createApprovalRule(
    companyId: string,
    data: {
      branchId?: string;
      transactionType: ApprovalType;
      minAmount?: number;
      requiredRole: string;
      stepNumber?: number;
    }
  ) {
    return prisma.approvalRule.create({
      data: {
        companyId,
        branchId: data.branchId,
        transactionType: data.transactionType,
        minAmount: data.minAmount ? new Prisma.Decimal(data.minAmount) : new Prisma.Decimal(0),
        requiredRole: data.requiredRole,
        stepNumber: data.stepNumber || 1,
        isActive: true
      }
    });
  }
}
