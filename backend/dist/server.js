"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const environment_1 = require("./config/environment");
const database_1 = require("./config/database");
async function bootstrap() {
    console.log('🚀 Starting APEX Restaurant ERP Backend (Part 1 Greenfield Rebuild)...');
    console.log(`🌍 Environment: ${environment_1.env.nodeEnv}`);
    console.log(`🔌 API Prefix: ${environment_1.env.apiPrefix}`);
    // Connect to Database
    const dbConnected = await (0, database_1.connectDatabase)();
    if (!dbConnected && environment_1.env.isProduction) {
        console.warn('⚠️ Warning: Database connection failed during startup.');
    }
    const server = app_1.app.listen(environment_1.env.port, () => {
        console.log(`✨ Server listening on http://0.0.0.0:${environment_1.env.port}`);
        console.log(`🩺 Health check ready at: http://localhost:${environment_1.env.port}${environment_1.env.apiPrefix}/health`);
    });
    // Graceful Shutdown
    const shutdown = async (signal) => {
        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
        server.close(async () => {
            console.log('🔒 HTTP server closed');
            await (0, database_1.disconnectDatabase)();
            console.log('✅ APEX ERP Backend shut down cleanly');
            process.exit(0);
        });
        setTimeout(() => {
            console.error('⚠️ Forcefully terminating after timeout');
            process.exit(1);
        }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
bootstrap().catch((err) => {
    console.error('❌ Fatal error during bootstrap:', err);
    process.exit(1);
});
