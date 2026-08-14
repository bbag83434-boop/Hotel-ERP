import { Request, Response } from 'express';
import { prisma } from '../config/database';

export class HealthController {
  public static async check(_req: Request, res: Response) {
    try {
      let dbStatus = 'disconnected';
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
      } catch {
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
    } catch (err) {
      return res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        service: 'Hotel-ERP Backend API',
        error: err instanceof Error ? err.message : 'Internal error during health check'
      });
    }
  }
}
