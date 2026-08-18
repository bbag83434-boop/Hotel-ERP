import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: Record<string, any>;
  timestamp: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, any>
): Response {
  const responsePayload: ApiResponse<T> = {
    success: true,
    data,
    meta,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(responsePayload);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any
): Response {
  const responsePayload: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(responsePayload);
}
