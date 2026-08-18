import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env, validateEnvironment } from './config/environment';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';
import apiRouter from './routes';
import { sendError, sendSuccess } from './utils/response';

// Validate environment on boot
validateEnvironment();

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Static frontend handles its own CSP if needed
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. CORS Handling
  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Outlet-Id',
        'X-Company-Id',
        'Idempotency-Key',
      ],
    })
  );

  // 3. Parsers & Logger
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  // 4. Root Health Ping
  app.get('/', (req: Request, res: Response) => {
    return sendSuccess(res, {
      system: 'APEX Multi-Outlet Restaurant ERP Backend',
      version: '2.0.0-greenfield',
      status: 'operational',
      apiPrefix: env.apiPrefix,
      healthCheck: `${env.apiPrefix}/health`,
    });
  });

  // 5. Mount API Routes
  app.use(env.apiPrefix, apiRouter);

  // 6. 404 Not Found Handler
  app.use((req: Request, res: Response) => {
    return sendError(
      res,
      404,
      'ROUTE_NOT_FOUND',
      `Cannot ${req.method} ${req.originalUrl} — endpoint does not exist`
    );
  });

  // 7. Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
