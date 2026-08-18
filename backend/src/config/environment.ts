import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface EnvironmentConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  corsOrigin: string | string[];
}

export const env: EnvironmentConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '10000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'apex_erp_jwt_secret_dev_key_2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'apex_erp_jwt_refresh_dev_key_2026',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : '*',
};

export function validateEnvironment(): void {
  if (!env.databaseUrl) {
    console.warn('⚠️ WARNING: DATABASE_URL is not set. Database operations will require DATABASE_URL.');
  }
}
