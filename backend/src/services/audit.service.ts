import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

export type AuditModule =
  | 'INVENTORY'
  | 'PURCHASING'
  | 'PRODUCTION'
  | 'RESTAURANT'
  | 'HOTEL'
  | 'ACCOUNTING'
  | 'HR'
  | 'APPROVAL'
  | 'SECURITY'
  | 'SYSTEM';

export interface AuditLogOptions {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface DetailedAuditOptions {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  module?: AuditModule;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  reason?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogFilters {
  entity?: string;
  action?: string;
  userId?: string;
  module?: AuditModule;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class AuditService {
  // 1. Basic log (Backwards-compatible)
  public static async log(options: AuditLogOptions) {
    try {
      const isUuid = options.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.userId);
      let validUserId = isUuid ? options.userId : null;
      if (validUserId) {
        const exists = await prisma.user.findUnique({ where: { id: validUserId }, select: { id: true } });
        if (!exists) validUserId = null;
      }

      const details = {
        ...(options.details || {}),
        ...(!validUserId && options.userId ? { actor: options.userId } : {})
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
    }
  }

  // 2. Comprehensive Detailed Change Logging with State Snapshots & Diff Computation
  public static async logDetailedChange(options: DetailedAuditOptions) {
    try {
      const isUuid = options.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.userId);
      let validUserId = isUuid ? options.userId : null;
      if (validUserId) {
        const exists = await prisma.user.findUnique({ where: { id: validUserId }, select: { id: true } });
        if (!exists) validUserId = null;
      }

      // Compute Changed Keys Diff if both old and new values are provided
      const changedKeys: string[] = [];
      if (options.oldValue && options.newValue) {
        const allKeys = new Set([...Object.keys(options.oldValue), ...Object.keys(options.newValue)]);
        for (const k of allKeys) {
          if (JSON.stringify(options.oldValue[k]) !== JSON.stringify(options.newValue[k])) {
            changedKeys.push(k);
          }
        }
      }

      const detailsPayload = {
        module: options.module || 'SYSTEM',
        oldValue: options.oldValue || null,
        newValue: options.newValue || null,
        changedKeys,
        reason: options.reason || null,
        ...(options.details || {}),
        ...(!validUserId && options.userId ? { actor: options.userId } : {})
      };

      const auditLog = await prisma.auditLog.create({
        data: {
          userId: validUserId,
          action: options.action,
          entity: options.entity,
          entityId: options.entityId || null,
          details: detailsPayload as any,
          ipAddress: options.ipAddress || null,
          userAgent: options.userAgent || null
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
          }
        }
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to create detailed audit log entry', error);
    }
  }

  // 3. Query Filterable Audit Stream
  public static async getAuditLogs(filters: AuditLogFilters = {}) {
    const { entity, action, userId, startDate, endDate, search, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (entity) where.entity = { contains: entity, mode: 'insensitive' };
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs
    };
  }

  // 4. Entity Record Lifecycle Timeline
  public static async getEntityAuditTrail(entity: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: {
        entity,
        entityId
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, role: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  // 5. Compliance Summary & Risk KPIs
  public static async getComplianceSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalEvents, todayEvents, topActionsRaw, distinctUsersRaw] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8
      }),
      prisma.auditLog.findMany({
        select: { userId: true },
        distinct: ['userId'],
        where: { userId: { not: null } }
      })
    ]);

    // High risk categories count (stock adjustments, refunds, price overrides, approvals)
    const [stockEvents, refundEvents, approvalEvents, securityEvents] = await Promise.all([
      prisma.auditLog.count({
        where: {
          OR: [
            { entity: { in: ['StockAdjustment', 'StockBalance', 'StockLedger', 'WastageEntry'] } },
            { action: { contains: 'STOCK' } },
            { action: { contains: 'WASTAGE' } }
          ]
        }
      }),
      prisma.auditLog.count({
        where: {
          OR: [
            { action: { contains: 'REFUND' } },
            { action: { contains: 'DISCOUNT' } },
            { action: { contains: 'VOID' } }
          ]
        }
      }),
      prisma.auditLog.count({
        where: {
          OR: [
            { entity: 'ApprovalRequest' },
            { entity: 'ApprovalRule' },
            { action: { contains: 'APPROVAL' } }
          ]
        }
      }),
      prisma.auditLog.count({
        where: {
          OR: [
            { action: { contains: 'LOGIN' } },
            { action: { contains: 'PASSWORD' } },
            { action: { contains: 'PERMISSION' } },
            { action: { contains: 'ROLE' } }
          ]
        }
      })
    ]);

    const topActions = topActionsRaw.map((a) => ({
      action: a.action,
      count: a._count.id
    }));

    return {
      totalEvents,
      todayEvents,
      activeAuditedUsers: distinctUsersRaw.length,
      highRiskBreakdown: {
        stockEvents,
        refundEvents,
        approvalEvents,
        securityEvents
      },
      topActions
    };
  }

  // 6. Export Compliance Dossier
  public static async exportAuditLogs(filters: AuditLogFilters = {}) {
    const result = await this.getAuditLogs({ ...filters, limit: 1000, page: 1 });
    return result.logs.map((l) => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      userEmail: l.user?.email || 'System / Automated',
      userName: l.user ? `${l.user.firstName} ${l.user.lastName}` : 'System',
      role: l.user?.role?.name || 'System',
      action: l.action,
      entity: l.entity,
      entityId: l.entityId || 'N/A',
      ipAddress: l.ipAddress || '127.0.0.1',
      details: l.details
    }));
  }
}
