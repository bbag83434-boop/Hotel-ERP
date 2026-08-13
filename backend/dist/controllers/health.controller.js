"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const database_1 = require("../config/database");
class HealthController {
    static async check(_req, res) {
        let dbStatus = 'disconnected';
        try {
            await database_1.prisma.$queryRaw `SELECT 1`;
            dbStatus = 'connected';
        }
        catch {
            dbStatus = 'error';
        }
        const healthInfo = {
            status: 'UP',
            timestamp: new Date().toISOString(),
            service: 'Hotel-ERP Backend API',
            uptimeSeconds: process.uptime(),
            database: dbStatus,
            environment: process.env.NODE_ENV || 'development'
        };
        const statusCode = dbStatus === 'connected' ? 200 : 503;
        return res.status(statusCode).json(healthInfo);
    }
}
exports.HealthController = HealthController;
