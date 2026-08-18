import { PrismaClient } from '@prisma/client';
import { env } from './environment';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: env.isProduction ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'],
  });

if (!env.isProduction) {
  globalThis.prismaGlobal = prisma;
}

export async function connectDatabase(): Promise<boolean> {
  try {
    await prisma.$connect();
    console.log('✅ Neon PostgreSQL Database Connected Successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Neon PostgreSQL Database:', error);
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected cleanly');
  } catch (error) {
    console.error('Error during database disconnect:', error);
  }
}
