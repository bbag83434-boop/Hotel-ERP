"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_utils_1 = require("../utils/jwt.utils");
const response_utils_1 = require("../utils/response.utils");
const authenticate = (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new response_utils_1.AppError('Authentication required. Missing Bearer token.', 401);
        }
        const token = authHeader.split(' ')[1];
        const decoded = (0, jwt_utils_1.verifyAccessToken)(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof response_utils_1.AppError) {
            next(error);
        }
        else {
            next(new response_utils_1.AppError('Invalid or expired access token', 401));
        }
    }
};
exports.authenticate = authenticate;
