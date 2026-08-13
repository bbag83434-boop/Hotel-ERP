"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const audit_service_1 = require("./audit.service");
const client_1 = require("@prisma/client");
class ApprovalService {
    // 1. Create Approval Request
    static async createApprovalRequest(companyId, data, requestedById, ipAddress, userAgent) {
        const { branchId, transactionType, referenceId, amount, title, description } = data;
        // Check if matching rules exist
        const rules = await database_1.prisma.approvalRule.findMany({
            where: {
                companyId,
                transactionType,
                isActive: true
            },
            orderBy: { stepNumber: 'asc' }
        });
        const totalSteps = rules.length > 0 ? Math.max(...rules.map((r) => r.stepNumber)) : 1;
        const count = await database_1.prisma.approvalRequest.count({ where: { companyId } });
        const requestNumber = `APR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const request = await database_1.prisma.approvalRequest.create({
            data: {
                companyId,
                branchId,
                requestNumber,
                transactionType,
                referenceId,
                amount: amount ? new client_1.Prisma.Decimal(amount) : null,
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
        await audit_service_1.AuditService.log({
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
    static async getApprovalRequests(companyId, filters) {
        const where = {
            companyId,
            ...(filters?.branchId ? { branchId: filters.branchId } : {}),
            ...(filters?.status ? { status: filters.status } : {}),
            ...(filters?.transactionType ? { transactionType: filters.transactionType } : {})
        };
        return database_1.prisma.approvalRequest.findMany({
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
    static async actOnApproval(companyId, requestId, data, userId, userRole, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const request = await tx.approvalRequest.findUnique({
                where: { id: requestId }
            });
            if (!request || request.companyId !== companyId) {
                throw new response_utils_1.AppError('Approval request not found', 404);
            }
            if (request.status !== 'PENDING') {
                throw new response_utils_1.AppError(`Cannot act on a request with status ${request.status}`, 400);
            }
            const previousStatus = request.status;
            let newStatus = data.action;
            let nextStep = request.currentStep;
            if (data.action === 'APPROVED') {
                if (request.currentStep < request.totalSteps) {
                    nextStep = request.currentStep + 1;
                    newStatus = 'PENDING'; // Still pending next step
                }
                else {
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
            await audit_service_1.AuditService.log({
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
    static async getApprovalRules(companyId, branchId) {
        return database_1.prisma.approvalRule.findMany({
            where: {
                companyId,
                ...(branchId ? { branchId } : {})
            },
            orderBy: [{ transactionType: 'asc' }, { stepNumber: 'asc' }]
        });
    }
    static async createApprovalRule(companyId, data) {
        return database_1.prisma.approvalRule.create({
            data: {
                companyId,
                branchId: data.branchId,
                transactionType: data.transactionType,
                minAmount: data.minAmount ? new client_1.Prisma.Decimal(data.minAmount) : new client_1.Prisma.Decimal(0),
                requiredRole: data.requiredRole,
                stepNumber: data.stepNumber || 1,
                isActive: true
            }
        });
    }
}
exports.ApprovalService = ApprovalService;
