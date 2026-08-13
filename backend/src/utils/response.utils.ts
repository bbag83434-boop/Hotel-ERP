import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
  meta?: Record<string, unknown>;
}

export class AppError extends Error {
  public statusCode: number;
  public errors?: unknown;

  constructor(message: string, statusCode = 500, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Operation successful',
  statusCode = 200,
  meta?: Record<string, unknown>
) => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {})
  };
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message = 'An error occurred',
  statusCode = 500,
  errors?: unknown
) => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(errors ? { errors } : {})
  };
  return res.status(statusCode).json(response);
};
