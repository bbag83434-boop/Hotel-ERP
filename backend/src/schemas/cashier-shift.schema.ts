import { z } from 'zod';

export const openShiftSchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal('')),
  openingFloat: z.coerce.number().min(0, 'Opening float must be non-negative').default(0),
  notes: z.string().optional()
});

export const cashMovementSchema = z.object({
  sessionId: z.string().uuid('Valid Session ID is required'),
  movementType: z.enum(['CASH_IN', 'CASH_OUT', 'FLOAT_START', 'CLOSING_DROP']),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  reason: z.string().min(2, 'Reason must be at least 2 characters')
});

export const closeShiftSchema = z.object({
  sessionId: z.string().uuid('Valid Session ID is required'),
  closingCash: z.coerce.number().min(0, 'Counted closing cash must be non-negative'),
  notes: z.string().optional(),
  varianceReason: z.string().optional()
});

export const reconcileShiftSchema = z.object({
  sessionId: z.string().uuid('Valid Session ID is required'),
  notes: z.string().optional()
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type ReconcileShiftInput = z.infer<typeof reconcileShiftSchema>;
