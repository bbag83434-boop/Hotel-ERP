import { z } from 'zod';

export const createApprovalRuleSchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal('')),
  transactionType: z.enum([
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
  minAmount: z.coerce.number().min(0).default(0),
  requiredRole: z.string().min(2, 'Required role is required'),
  stepNumber: z.coerce.number().min(1).default(1)
});

export const updateApprovalRuleSchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal('')),
  minAmount: z.coerce.number().min(0).optional(),
  requiredRole: z.string().min(2).optional(),
  stepNumber: z.coerce.number().min(1).optional(),
  isActive: z.boolean().optional()
});

export const createApprovalRequestSchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal('')),
  transactionType: z.enum([
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
  referenceId: z.string().min(1, 'Reference ID is required'),
  amount: z.coerce.number().optional(),
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional()
});

export const actOnApprovalSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  comment: z.string().optional()
});

export type CreateApprovalRuleInput = z.infer<typeof createApprovalRuleSchema>;
export type UpdateApprovalRuleInput = z.infer<typeof updateApprovalRuleSchema>;
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type ActOnApprovalInput = z.infer<typeof actOnApprovalSchema>;
