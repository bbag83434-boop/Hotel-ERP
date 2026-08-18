/**
 * APEX ERP — Standardized Application & Domain Errors
 * Matching Master Blueprint Section 49 & Multi-Outlet Business Rules
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required to access this resource') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action or access this outlet scope') {
    super(403, 'PERMISSION_DENIED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id?: string) {
    super(404, 'NOT_FOUND', id ? `${resource} with id '${id}' not found` : `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class InsufficientStockError extends AppError {
  constructor(item: string, required: number, available: number, unit = 'units') {
    super(400, 'INSUFFICIENT_STOCK', `Insufficient stock for ${item}: Required ${required} ${unit}, Available ${available} ${unit}. Shortage: ${required - available} ${unit}`, {
      item,
      required,
      available,
      shortage: required - available,
      unit,
    });
  }
}

export class InvoiceMismatchError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'INVOICE_MISMATCH', message, details);
  }
}

export class ApprovalRequiredError extends AppError {
  constructor(action: string, threshold?: any) {
    super(403, 'APPROVAL_REQUIRED', `Approval required for action: ${action}`, { action, threshold });
  }
}

export class DuplicateRequestError extends AppError {
  constructor(idempotencyKey: string) {
    super(409, 'DUPLICATE_REQUEST', `Duplicate request detected with idempotency key: ${idempotencyKey}`, { idempotencyKey });
  }
}

export class ClosingPeriodLockedError extends AppError {
  constructor(period: string, outlet: string) {
    super(400, 'CLOSING_PERIOD_LOCKED', `The closing period '${period}' for outlet '${outlet}' has already been finalized and locked.`, { period, outlet });
  }
}
