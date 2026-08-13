"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const database_1 = require("./config/database");
const server = app_1.default.listen(env_1.env.PORT, () => {
    logger_1.logger.info(`🚀 Hotel & Restaurant ERP Backend running on port ${env_1.env.PORT}`);
    logger_1.logger.info(`Environment: ${env_1.env.NODE_ENV}`);
    logger_1.logger.info(`Health check: http://localhost:${env_1.env.PORT}/api/health`);
});
const gracefulShutdown = async (signal) => {
    logger_1.logger.warn(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
        logger_1.logger.info('HTTP server closed.');
        await database_1.prisma.$disconnect();
        logger_1.logger.info('Database connection closed.');
        process.exit(0);
    });
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
