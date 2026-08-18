import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { env } from '../config/environment';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Handle Prisma Known Request Errors
  if ('code' in err && typeof (err as any).code === 'string' && (err as any).code.startsWith('P')) {
    const prismaCode = (err as any).code;
    if (prismaCode === 'P2002') {
      return sendError(
        res,
        409,
        'DUPLICATE_ENTRY',
        'A unique constraint violation occurred on one or more fields',
        env.isProduction ? undefined : (err as any).meta
      );
    }
    if (prismaCode === 'P2025') {
      return sendError(res, 404, 'NOT_FOUND', 'The requested record was not found in the database');
    }
  }

  // Generic unhandled internal error
  console.error(`💥 [Unhandled Error] ${req.method} ${req.originalUrl}:`, err);

  const message = env.isProduction
    ? 'An unexpected internal server error occurred'
    : err.message || 'Internal Server Error';

  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    message,
    env.isProduction ? undefined : { stack: err.stack }
  );
}
