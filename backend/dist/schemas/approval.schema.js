"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actOnApprovalSchema = exports.createApprovalRequestSchema = exports.updateApprovalRuleSchema = exports.createApprovalRuleSchema = void 0;
const zod_1 = require("zod");
exports.createApprovalRuleSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid().optional().or(zod_1.z.literal('')),
    transactionType: zod_1.z.enum([
        'PURCHASE_REQUEST',
        'PURCHASE_ORDER',
        'EXPENSE',
        'STOCK_ADJUSTMENT',
        'STOCK_TRANSFER',
        'DISCOUNT',
        'REFUND',
        'SALARY_CHANGE',
        'PERMISSION_CHANGE'
    ]),
    minAmount: zod_1.z.coerce.number().min(0).default(0),
    requiredRole: zod_1.z.string().min(2, 'Required role is required'),
    stepNumber: zod_1.z.coerce.number().min(1).default(1)
});
exports.updateApprovalRuleSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid().optional().or(zod_1.z.literal('')),
    minAmount: zod_1.z.coerce.number().min(0).optional(),
    requiredRole: zod_1.z.string().min(2).optional(),
    stepNumber: zod_1.z.coerce.number().min(1).optional(),
    isActive: zod_1.z.boolean().optional()
});
exports.createApprovalRequestSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid().optional().or(zod_1.z.literal('')),
    transactionType: zod_1.z.enum([
        'PURCHASE_REQUEST',
        'PURCHASE_ORDER',
        'EXPENSE',
        'STOCK_ADJUSTMENT',
        'STOCK_TRANSFER',
        'DISCOUNT',
        'REFUND',
        'SALARY_CHANGE',
        'PERMISSION_CHANGE'
    ]),
    referenceId: zod_1.z.string().min(1, 'Reference ID is required'),
    amount: zod_1.z.coerce.number().optional(),
    title: zod_1.z.string().min(3, 'Title is required'),
    description: zod_1.z.string().optional()
});
exports.actOnApprovalSchema = zod_1.z.object({
    action: zod_1.z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
    comment: zod_1.z.string().optional()
});
