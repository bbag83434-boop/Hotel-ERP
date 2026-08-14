import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory or parent root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-change-in-prod-2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-change-in-prod-2026',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,https://hotel-erp-1-o13c.onrender.com',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)
};
