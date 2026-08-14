"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const logger_middleware_1 = require("./middlewares/logger.middleware");
const errorHandler_middleware_1 = require("./middlewares/errorHandler.middleware");
const health_controller_1 = require("./controllers/health.controller");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
// Security Headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: env_1.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
}));
// CORS configuration
const allowedOrigins = env_1.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, ''));
const knownOrigins = [
    'https://hotel-erp-1-o13c.onrender.com', // 1, o, 1, 3, c
    'https://hotel-erp-1-013c.onrender.com', // 1, 0, 1, 3, c
    'https://hotel-erp-1-ol3c.onrender.com', // 1, o, l, 3, c
    'https://hotel-erp-1-0l3c.onrender.com', // 1, 0, l, 3, c
    'https://hotel-erp-l-o13c.onrender.com', // l, o, 1, 3, c
    'https://hotel-erp-l-013c.onrender.com', // l, 0, 1, 3, c
    'https://hotel-erp-l-ol3c.onrender.com', // l, o, l, 3, c
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];
knownOrigins.forEach((orig) => {
    if (!allowedOrigins.includes(orig)) {
        allowedOrigins.push(orig);
    }
});
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
        // 1. Check exact/known allowed origins (case-insensitive)
        const isExplicitlyAllowed = allowedOrigins.some((o) => o.trim().replace(/\/+$/, '').toLowerCase() === normalizedOrigin);
        // 2. Wildcard or any *.onrender.com subdomain or localhost
        const isRenderSubdomain = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(normalizedOrigin);
        const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
        if (isExplicitlyAllowed || allowedOrigins.includes('*') || isRenderSubdomain || isLocalhost) {
            callback(null, true);
        }
        else {
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
// Body Parsing & Cookies
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// Request Logging
app.use(logger_middleware_1.requestLogger);
// Direct Health Endpoint per requirement
app.get('/api/health', health_controller_1.HealthController.check);
app.get('/health', health_controller_1.HealthController.check);
// Versioned API Routes
app.use(env_1.env.API_PREFIX, routes_1.default);
// 404 Handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: 'API Endpoint not found'
    });
});
// Centralized Error Handler
app.use(errorHandler_middleware_1.errorHandler);
exports.default = app;
