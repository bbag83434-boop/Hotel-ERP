"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleLoginSchema = exports.refreshTokenSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        identifier: zod_1.z.string().min(1, 'Username or Email is required'),
        password: zod_1.z.string().min(1, 'Password is required')
    })
});
exports.refreshTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().optional()
    })
});
exports.googleLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        credential: zod_1.z.string().min(1, 'Google credential token or email is required'),
        email: zod_1.z.string().email('Valid email is required').optional(),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        avatarUrl: zod_1.z.string().url().optional()
    })
});
