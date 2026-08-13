"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    errors;
    constructor(message, statusCode = 500, errors) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const sendSuccess = (res, data, message = 'Operation successful', statusCode = 200, meta) => {
    const response = {
        success: true,
        message,
        data,
        ...(meta ? { meta } : {})
    };
    return res.status(statusCode).json(response);
};
exports.sendSuccess = sendSuccess;
const sendError = (res, message = 'An error occurred', statusCode = 500, errors) => {
    const response = {
        success: false,
        message,
        ...(errors ? { errors } : {})
    };
    return res.status(statusCode).json(response);
};
exports.sendError = sendError;
