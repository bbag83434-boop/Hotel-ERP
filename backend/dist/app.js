"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const environment_1 = require("./config/environment");
const requestLogger_1 = require("./middlewares/requestLogger");
const errorHandler_1 = require("./middlewares/errorHandler");
const routes_1 = __importDefault(require("./routes"));
const response_1 = require("./utils/response");
// Validate environment on boot
(0, environment_1.validateEnvironment)();
function createApp() {
    const app = (0, express_1.default)();
    // 1. Security Headers
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false, // Static frontend handles its own CSP if needed
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    // 2. CORS Handling
    app.use((0, cors_1.default)({
        origin: environment_1.env.corsOrigin === '*' ? true : environment_1.env.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-Outlet-Id',
            'X-Company-Id',
            'Idempotency-Key',
        ],
    }));
    // 3. Parsers & Logger
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    app.use((0, cookie_parser_1.default)());
    app.use(requestLogger_1.requestLogger);
    // 4. Root Health Ping
    app.get('/', (req, res) => {
        return (0, response_1.sendSuccess)(res, {
            system: 'APEX Multi-Outlet Restaurant ERP Backend',
            version: '2.0.0-greenfield',
            status: 'operational',
            apiPrefix: environment_1.env.apiPrefix,
            healthCheck: `${environment_1.env.apiPrefix}/health`,
        });
    });
    // 5. Mount API Routes
    app.use(environment_1.env.apiPrefix, routes_1.default);
    // 6. 404 Not Found Handler
    app.use((req, res) => {
        return (0, response_1.sendError)(res, 404, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.originalUrl} — endpoint does not exist`);
    });
    // 7. Global Error Handler
    app.use(errorHandler_1.errorHandler);
    return app;
}
exports.app = createApp();
