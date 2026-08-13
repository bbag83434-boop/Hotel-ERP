"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class AuditService {
    static async log(options) {
        try {
            const auditLog = await database_1.prisma.auditLog.create({
                data: {
                    userId: options.userId || null,
                    action: options.action,
                    entity: options.entity,
                    entityId: options.entityId || null,
                    details: options.details ? options.details : undefined,
                    ipAddress: options.ipAddress || null,
                    userAgent: options.userAgent || null
                }
            });
            return auditLog;
        }
        catch (error) {
            logger_1.logger.error('Failed to create audit log entry', error);
            // Non-blocking: we log audit errors without crashing business transactions if audit log fails
        }
    }
}
exports.AuditService = AuditService;
