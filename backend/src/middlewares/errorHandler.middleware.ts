import { Request, Response, NextFunction } from 'express';
import { AppError, sendError } from '../utils/response.utils';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(`Error on ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.errors);
  }

  // Prisma Unique Constraint Error
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      const field = prismaErr.meta?.target ? prismaErr.meta.target.join(', ') : 'field';
      return sendError(res, `A record with this ${field} already exists.`, 409);
    }
  }

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return sendError(res, message, 500);
};
