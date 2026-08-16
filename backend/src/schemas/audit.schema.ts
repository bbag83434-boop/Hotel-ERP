import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  entity: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  module: z.enum(['INVENTORY', 'PURCHASING', 'PRODUCTION', 'RESTAURANT', 'HOTEL', 'ACCOUNTING', 'HR', 'APPROVAL', 'SECURITY', 'SYSTEM']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50)
});

export const createDetailedAuditLogSchema = z.object({
  action: z.string().min(2),
  entity: z.string().min(2),
  entityId: z.string().optional(),
  module: z.enum(['INVENTORY', 'PURCHASING', 'PRODUCTION', 'RESTAURANT', 'HOTEL', 'ACCOUNTING', 'HR', 'APPROVAL', 'SECURITY', 'SYSTEM']).default('SYSTEM'),
  oldValue: z.record(z.any()).optional(),
  newValue: z.record(z.any()).optional(),
  reason: z.string().optional(),
  details: z.record(z.any()).optional()
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
export type CreateDetailedAuditLogInput = z.infer<typeof createDetailedAuditLogSchema>;
