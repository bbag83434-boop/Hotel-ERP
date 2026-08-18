import { app } from './app';
import { env } from './config/environment';
import { connectDatabase, disconnectDatabase } from './config/database';

async function bootstrap() {
  console.log('🚀 Starting APEX Restaurant ERP Backend (Part 1 Greenfield Rebuild)...');
  console.log(`🌍 Environment: ${env.nodeEnv}`);
  console.log(`🔌 API Prefix: ${env.apiPrefix}`);

  // Connect to Database
  const dbConnected = await connectDatabase();
  if (!dbConnected && env.isProduction) {
    console.warn('⚠️ Warning: Database connection failed during startup.');
  }

  const server = app.listen(env.port, () => {
    console.log(`✨ Server listening on http://0.0.0.0:${env.port}`);
    console.log(`🩺 Health check ready at: http://localhost:${env.port}${env.apiPrefix}/health`);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('🔒 HTTP server closed');
      await disconnectDatabase();
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
