import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AuditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response.utils';
import { auditLogQuerySchema, createDetailedAuditLogSchema } from '../schemas/audit.schema';

const getClientIp = (req: AuthenticatedRequest): string => {
  const xf = req.headers['x-forwarded-for'];
  if (Array.isArray(xf)) return xf[0] || '';
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || '';
};

export class AuditController {
  // 1. Get Audit Logs Stream
  public static async getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const result = await AuditService.getAuditLogs(query);
      return sendSuccess(res, result, 'Audit logs retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  // 2. Get Compliance Summary & Risk KPIs
  public static async getSummary(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await AuditService.getComplianceSummary();
      return sendSuccess(res, summary, 'Compliance summary retrieved', 200);
    } catch (err) {
      next(err);
    }
  }

  // 3. Get Entity Audit Trail (Record-Level History)
  public static async getEntityTrail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { entity, entityId } = req.params;
      const trail = await AuditService.getEntityAuditTrail(entity, entityId);
      return sendSuccess(res, trail, `Audit trail for ${entity} #${entityId}`, 200);
    } catch (err) {
      next(err);
    }
  }

  // 4. Manually Log Detailed Change / Note
  public static async logChange(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = createDetailedAuditLogSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const log = await AuditService.logDetailedChange({
        userId: req.user?.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        module: data.module,
        oldValue: data.oldValue,
        newValue: data.newValue,
        reason: data.reason,
        details: data.details,
        ipAddress: getClientIp(req),
        userAgent
      });
      return sendSuccess(res, log, 'Detailed audit entry recorded', 201);
    } catch (err) {
      next(err);
    }
  }

  // 5. Export Audit Dossier
  public static async exportDossier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const exported = await AuditService.exportAuditLogs(query);
      return sendSuccess(res, exported, 'Compliance audit dossier exported', 200);
    } catch (err) {
      next(err);
    }
  }
}
