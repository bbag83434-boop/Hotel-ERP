import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface AuditLogOptions {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  public static async log(options: AuditLogOptions) {
    try {
      const isUuid = options.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.userId);
      const validUserId = isUuid ? options.userId : null;
      const details = {
        ...(options.details || {}),
        ...(!isUuid && options.userId ? { actor: options.userId } : {})
      };

      const auditLog = await prisma.auditLog.create({
        data: {
          userId: validUserId,
          action: options.action,
          entity: options.entity,
          entityId: options.entityId || null,
          details: Object.keys(details).length > 0 ? (details as any) : undefined,
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null
        }
      });
      return auditLog;
    } catch (error) {
      logger.error('Failed to create audit log entry', error);
      // Non-blocking: we log audit errors without crashing business transactions if audit log fails
    }
  }
}
