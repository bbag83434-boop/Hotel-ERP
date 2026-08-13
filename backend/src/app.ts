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
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed for this origin'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
