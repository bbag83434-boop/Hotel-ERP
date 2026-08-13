import { z } from 'zod';

export const createApprovalRuleSchema = z.object({
  branchId: z.string().optional(),
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
  minAmount: z.number().min(0).default(0),
  requiredRole: z.string().min(2, 'Required role is required'),
  stepNumber: z.number().min(1).default(1)
});

export const createApprovalRequestSchema = z.object({
  branchId: z.string().optional(),
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
  amount: z.number().optional(),
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional()
});

export const actOnApprovalSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  comment: z.string().optional()
});
