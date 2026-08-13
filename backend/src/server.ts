import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './config/database';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Hotel & Restaurant ERP Backend running on port ${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
});

const gracefulShutdown = async (signal: string) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await prisma.$disconnect();
    logger.info('Database connection closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
