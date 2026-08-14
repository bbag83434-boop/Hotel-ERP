"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const response_utils_1 = require("../utils/response.utils");
const env_1 = require("../config/env");
class AuthController {
    static async login(req, res, next) {
        try {
            const { identifier, password } = req.body;
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';
            const userAgent = req.headers['user-agent'] || '';
            const result = await auth_service_1.AuthService.login(identifier, password, ipAddress, userAgent);
            // Set httpOnly cookie for refresh token
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: env_1.env.NODE_ENV === 'production',
                sameSite: env_1.env.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: env_1.env.COOKIE_DOMAIN,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            return (0, response_utils_1.sendSuccess)(res, {
                accessToken: result.accessToken,
                user: result.user
            }, 'Login successful');
        }
        catch (error) {
            next(error);
        }
    }
    static async refreshToken(req, res, next) {
        try {
            const token = req.cookies?.refreshToken || req.body?.refreshToken;
            if (!token) {
                return res.status(401).json({ success: false, message: 'Refresh token missing' });
            }
            const result = await auth_service_1.AuthService.refreshAccessToken(token);
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: env_1.env.NODE_ENV === 'production',
                sameSite: env_1.env.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: env_1.env.COOKIE_DOMAIN,
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            return (0, response_utils_1.sendSuccess)(res, { accessToken: result.accessToken }, 'Token refreshed successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async logout(req, res, next) {
        try {
            if (req.user?.userId) {
                const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';
                const userAgent = req.headers['user-agent'] || '';
                await auth_service_1.AuthService.logout(req.user.userId, ipAddress, userAgent);
            }
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: env_1.env.NODE_ENV === 'production',
                sameSite: env_1.env.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: env_1.env.COOKIE_DOMAIN
            });
            return (0, response_utils_1.sendSuccess)(res, null, 'Logged out successfully');
        }
        catch (error) {
            next(error);
        }
    }
    static async getMe(req, res, next) {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({ success: false, message: 'Unauthenticated' });
            }
            const userProfile = await auth_service_1.AuthService.getMe(req.user.userId);
            return (0, response_utils_1.sendSuccess)(res, userProfile, 'User profile retrieved successfully');
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
