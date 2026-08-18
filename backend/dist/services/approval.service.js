"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const audit_service_1 = require("./audit.service");
const client_1 = require("@prisma/client");
class ApprovalService {
    // ==========================================
    // 1. EVALUATE AND TRIGGER APPROVAL
    // ==========================================
    static async evaluateAndTriggerApproval(companyId, data, requestedById, ipAddress, userAgent) {
        const { branchId, transactionType, referenceId, amount = 0, title, description } = data;
        // Check if matching active approval rules exist for this transaction type and amount threshold
        const matchingRules = await database_1.prisma.approvalRule.findMany({
            where: {
                companyId,
                transactionType,
                isActive: true,
                minAmount: { lte: new client_1.Prisma.Decimal(amount) },
                ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {})
            },
            orderBy: { stepNumber: 'asc' }
        });
        if (matchingRules.length === 0) {
            // No approval required -> automatically allowed / approved
            return {
                requiresApproval: false,
                approvalRequest: null
            };
        }
        const totalSteps = Math.max(...matchingRules.map((r) => r.stepNumber), 1);
        const count = await database_1.prisma.approvalRequest.count({ where: { companyId } });
        const requestNumber = `APR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const request = await database_1.prisma.approvalRequest.create({
            data: {
                companyId,
                branchId: branchId || null,
                requestNumber,
                transactionType,
                referenceId,
                amount: new client_1.Prisma.Decimal(amount),
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
            details: { requestNumber, transactionType, referenceId, amount, title, requiredSteps: totalSteps },
            ipAddress,
            userAgent
        });
        return {
            requiresApproval: true,
            approvalRequest: request
        };
    }
    // ==========================================
    // 2. CREATE APPROVAL REQUEST DIRECTLY
    // ==========================================
    static async createApprovalRequest(companyId, data, requestedById, ipAddress, userAgent) {
        const res = await this.evaluateAndTriggerApproval(companyId, data, requestedById, ipAddress, userAgent);
        if (res.approvalRequest)
            return res.approvalRequest;
        // If no rule matched, create standard 1-step request
        const count = await database_1.prisma.approvalRequest.count({ where: { companyId } });
        const requestNumber = `APR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        return database_1.prisma.approvalRequest.create({
            data: {
                companyId,
                branchId: data.branchId || null,
                requestNumber,
                transactionType: data.transactionType,
                referenceId: data.referenceId,
                amount: data.amount ? new client_1.Prisma.Decimal(data.amount) : null,
                title: data.title,
                description: data.description,
                status: 'PENDING',
                requestedById,
                currentStep: 1,
                totalSteps: 1
            },
            include: {
                requestedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
                }
            }
        });
    }
    // ==========================================
    // 3. GET APPROVAL REQUESTS (QUEUE & HISTORY)
    // ==========================================
    static async getApprovalRequests(companyId, filters) {
        const where = {
            companyId,
            ...(filters?.branchId ? { branchId: filters.branchId } : {}),
            ...(filters?.status ? { status: filters.status } : {}),
            ...(filters?.transactionType ? { transactionType: filters.transactionType } : {}),
            ...(filters?.requestedById ? { requestedById: filters.requestedById } : {})
        };
        return database_1.prisma.approvalRequest.findMany({
            where,
            include: {
                requestedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
                },
                branch: { select: { id: true, name: true, code: true } },
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
    // ==========================================
    // 4. ACT ON APPROVAL (APPROVE / REJECT / CANCEL)
    // ==========================================
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
                    newStatus = 'PENDING'; // Still pending higher tier authorization
                }
                else {
                    newStatus = 'APPROVED'; // Final tier reached
                }
            }
            // Record Action Audit Log in approval_actions
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
            // Update Request Status
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
            // ==========================================
            // FINAL RESOLUTION CALLBACKS (CROSS-MODULE SYNC)
            // ==========================================
            if (newStatus === 'APPROVED') {
                // 1. Purchase Order Approval
                if (request.transactionType === 'PURCHASE_ORDER') {
                    await tx.purchaseOrder.updateMany({
                        where: { id: request.referenceId, companyId },
                        data: { status: 'ISSUED' }
                    });
                }
                // 2. Purchase Request Approval
                else if (request.transactionType === 'PURCHASE_REQUEST') {
                    await tx.purchaseRequest.updateMany({
                        where: { id: request.referenceId, companyId },
                        data: { status: 'APPROVED' }
                    });
                }
                // 3. Stock Adjustment Approval
                else if (request.transactionType === 'STOCK_ADJUSTMENT') {
                    await tx.stockAdjustment.updateMany({
                        where: { id: request.referenceId, companyId },
                        data: { status: 'APPROVED' }
                    });
                }
            }
            else if (newStatus === 'REJECTED') {
                // Rejection handling across linked entities
                if (request.transactionType === 'PURCHASE_ORDER') {
                    await tx.purchaseOrder.updateMany({
                        where: { id: request.referenceId, companyId },
                        data: { status: 'CANCELLED' }
                    });
                }
                else if (request.transactionType === 'PURCHASE_REQUEST') {
                    await tx.purchaseRequest.updateMany({
                        where: { id: request.referenceId, companyId },
                        data: { status: 'REJECTED' }
                    });
                }
                else if (request.transactionType === 'STOCK_ADJUSTMENT') {
                    await tx.stockAdjustment.updateMany({
                        where: { id: request.referenceId, companyId },
                        data: { status: 'REJECTED' }
                    });
                }
            }
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
                    newStatus,
                    currentStep: nextStep,
                    totalSteps: request.totalSteps
                },
                ipAddress,
                userAgent
            });
            return updatedRequest;
        });
    }
    // ==========================================
    // 5. APPROVAL RULES CRUD (CONFIGURABLE MATRICES)
    // ==========================================
    static async getApprovalRules(companyId, branchId) {
        return database_1.prisma.approvalRule.findMany({
            where: {
                companyId,
                ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {})
            },
            include: {
                branch: { select: { id: true, name: true, code: true } }
            },
            orderBy: [{ transactionType: 'asc' }, { stepNumber: 'asc' }, { minAmount: 'asc' }]
        });
    }
    static async createApprovalRule(companyId, data, actorId) {
        const rule = await database_1.prisma.approvalRule.create({
            data: {
                companyId,
                branchId: data.branchId || null,
                transactionType: data.transactionType,
                minAmount: data.minAmount ? new client_1.Prisma.Decimal(data.minAmount) : new client_1.Prisma.Decimal(0),
                requiredRole: data.requiredRole,
                stepNumber: data.stepNumber || 1,
                isActive: true
            },
            include: {
                branch: { select: { id: true, name: true, code: true } }
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'APPROVAL_RULE_CREATED',
            entity: 'ApprovalRule',
            entityId: rule.id,
            details: { transactionType: rule.transactionType, minAmount: rule.minAmount.toString(), requiredRole: rule.requiredRole }
        });
        return rule;
    }
    static async updateApprovalRule(companyId, ruleId, data, actorId) {
        const existing = await database_1.prisma.approvalRule.findFirst({
            where: { id: ruleId, companyId }
        });
        if (!existing)
            throw new response_utils_1.AppError('Approval rule not found', 404);
        const updated = await database_1.prisma.approvalRule.update({
            where: { id: ruleId },
            data: {
                branchId: data.branchId !== undefined ? data.branchId : existing.branchId,
                minAmount: data.minAmount !== undefined ? new client_1.Prisma.Decimal(data.minAmount) : existing.minAmount,
                requiredRole: data.requiredRole !== undefined ? data.requiredRole : existing.requiredRole,
                stepNumber: data.stepNumber !== undefined ? data.stepNumber : existing.stepNumber,
                isActive: data.isActive !== undefined ? data.isActive : existing.isActive
            },
            include: {
                branch: { select: { id: true, name: true, code: true } }
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'APPROVAL_RULE_UPDATED',
            entity: 'ApprovalRule',
            entityId: ruleId,
            details: { ruleId, updates: data }
        });
        return updated;
    }
    static async deleteApprovalRule(companyId, ruleId, actorId) {
        const existing = await database_1.prisma.approvalRule.findFirst({
            where: { id: ruleId, companyId }
        });
        if (!existing)
            throw new response_utils_1.AppError('Approval rule not found', 404);
        await database_1.prisma.approvalRule.delete({ where: { id: ruleId } });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'APPROVAL_RULE_DELETED',
            entity: 'ApprovalRule',
            entityId: ruleId
        });
        return { success: true };
    }
    // ==========================================
    // 6. APPROVAL METRICS & SUMMARY
    // ==========================================
    static async getApprovalSummary(companyId, branchId) {
        const [pendingCount, approvedCount, rejectedCount, totalRules, pendingByTypeRaw] = await Promise.all([
            database_1.prisma.approvalRequest.count({
                where: { companyId, status: 'PENDING', ...(branchId ? { branchId } : {}) }
            }),
            database_1.prisma.approvalRequest.count({
                where: { companyId, status: 'APPROVED', ...(branchId ? { branchId } : {}) }
            }),
            database_1.prisma.approvalRequest.count({
                where: { companyId, status: 'REJECTED', ...(branchId ? { branchId } : {}) }
            }),
            database_1.prisma.approvalRule.count({
                where: { companyId, isActive: true, ...(branchId ? { branchId } : {}) }
            }),
            database_1.prisma.approvalRequest.groupBy({
                by: ['transactionType'],
                where: { companyId, status: 'PENDING', ...(branchId ? { branchId } : {}) },
                _count: { id: true }
            })
        ]);
        const pendingByType = pendingByTypeRaw.map((p) => ({
            type: p.transactionType,
            count: p._count.id
        }));
        return {
            pendingCount,
            approvedCount,
            rejectedCount,
            totalRules,
            pendingByType
        };
    }
}
exports.ApprovalService = ApprovalService;
