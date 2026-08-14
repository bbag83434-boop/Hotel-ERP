import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middlewares/logger.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { HealthController } from './controllers/health.controller';
import apiRouter from './routes';

const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, ''));
const knownOrigins = [
  'https://hotel-erp-1-o13c.onrender.com', // 1, o, 1, 3, c
  'https://hotel-erp-1-013c.onrender.com', // 1, 0, 1, 3, c
  'https://hotel-erp-1-ol3c.onrender.com', // 1, o, l, 3, c
  'https://hotel-erp-1-0l3c.onrender.com', // 1, 0, l, 3, c
  'https://hotel-erp-l-o13c.onrender.com', // l, o, 1, 3, c
  'https://hotel-erp-l-013c.onrender.com', // l, 0, 1, 3, c
  'https://hotel-erp-l-ol3c.onrender.com', // l, o, l, 3, c
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
knownOrigins.forEach((orig) => {
  if (!allowedOrigins.includes(orig)) {
    allowedOrigins.push(orig);
  }
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
      
      // 1. Check exact/known allowed origins (case-insensitive)
      const isExplicitlyAllowed = allowedOrigins.some(
        (o) => o.trim().replace(/\/+$/, '').toLowerCase() === normalizedOrigin
      );

      // 2. Wildcard or any *.onrender.com subdomain or localhost
      const isRenderSubdomain = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(normalizedOrigin);
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);

      if (isExplicitlyAllowed || allowedOrigins.includes('*') || isRenderSubdomain || isLocalhost) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  })
);

// Body Parsing & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request Logging
app.use(requestLogger);

// Direct Health Endpoint per requirement
app.get('/api/health', HealthController.check);
app.get('/health', HealthController.check);

// Versioned API Routes
app.use(env.API_PREFIX, apiRouter);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API Endpoint not found'
  });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
