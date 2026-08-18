import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const icon = statusCode >= 500 ? '🔥' : statusCode >= 400 ? '⚠️' : '⚡';
    console.log(`${icon} [${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} - ${duration}ms [${ip}]`);
  });

  next();
}
