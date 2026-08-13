"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const response_utils_1 = require("../utils/response.utils");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const errorHandler = (err, req, res, _next) => {
    logger_1.logger.error(`Error on ${req.method} ${req.originalUrl}:`, err);
    if (err instanceof response_utils_1.AppError) {
        return (0, response_utils_1.sendError)(res, err.message, err.statusCode, err.errors);
    }
    // Prisma Unique Constraint Error
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err;
        if (prismaErr.code === 'P2002') {
            const field = prismaErr.meta?.target ? prismaErr.meta.target.join(', ') : 'field';
            return (0, response_utils_1.sendError)(res, `A record with this ${field} already exists.`, 409);
        }
    }
    const message = env_1.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
    return (0, response_utils_1.sendError)(res, message, 500);
};
exports.errorHandler = errorHandler;
