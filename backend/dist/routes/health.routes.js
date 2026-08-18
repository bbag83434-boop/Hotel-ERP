"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const environment_1 = require("../config/environment");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const startTime = Date.now();
/**
 * GET /api/v1/health
 * General System Health & Runtime Telemetry
 */
router.get('/', async (req, res) => {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    let dbStatus = 'disconnected';
    let dbLatencyMs;
    try {
        const dbStart = Date.now();
        await database_1.prisma.$queryRaw `SELECT 1`;
        dbLatencyMs = Date.now() - dbStart;
        dbStatus = 'connected';
    }
    catch (error) {
        dbStatus = 'error';
    }
    const healthData = {
        status: dbStatus === 'connected' ? 'healthy' : 'degraded',
        version: '2.0.0-greenfield',
        environment: environment_1.env.nodeEnv,
        timestamp: new Date().toISOString(),
        uptimeSeconds,
        memoryUsage: {
            heapUsedMB: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
            heapTotalMB: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
            rssMB: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
        },
        database: {
            status: dbStatus,
            latencyMs: dbLatencyMs,
        },
        features: {
            multiOutletScope: true,
            centralPurchaseControl: true,
            linkedTransactions: true,
            biMonthlyClosing: true,
            aiAutomationReady: true,
        },
    };
    return (0, response_1.sendSuccess)(res, healthData, 200, {
        project: 'APEX Multi-Outlet Restaurant ERP',
        part: 'PART 1 — FOUNDATION & ARCHITECTURAL BASELINE',
    });
});
/**
 * GET /api/v1/health/db
 * Database specific health & non-destructive connectivity verification
 */
router.get('/db', async (req, res) => {
    try {
        const start = Date.now();
        await database_1.prisma.$queryRaw `SELECT current_database(), current_user, version()`;
        const latencyMs = Date.now() - start;
        // Non-destructive count checks
        const branchCount = await database_1.prisma.branch.count().catch(() => 0);
        const userCount = await database_1.prisma.user.count().catch(() => 0);
        return (0, response_1.sendSuccess)(res, {
            database: 'Neon PostgreSQL',
            status: 'connected',
            latencyMs,
            verifiedAt: new Date().toISOString(),
            topology: {
                registeredBranches: branchCount,
                registeredUsers: userCount,
            },
        });
    }
    catch (error) {
        return (0, response_1.sendError)(res, 503, 'DB_UNAVAILABLE', 'Database connection check failed', {
            error: error.message,
        });
    }
});
/**
 * GET /api/v1/health/outlets
 * Verification endpoint for 14+ Outlets & Business Unit topology
 */
router.get('/outlets', async (req, res) => {
    try {
        const branches = await database_1.prisma.branch.findMany({
            select: {
                id: true,
                name: true,
                code: true,
                type: true,
                isActive: true,
            },
            orderBy: { code: 'asc' },
        });
        return (0, response_1.sendSuccess)(res, {
            totalOutlets: branches.length,
            outlets: branches,
            businessUnits: [
                { code: 'HQ', name: 'Head Office Central Control', type: 'HEAD_OFFICE' },
                { code: 'CS-01', name: 'Central Store (Warehouse & Distribution)', type: 'CENTRAL_STORE' },
                { code: 'DK-01', name: 'Dessert Kitchen (Central Sweet/Bakery Unit)', type: 'DESSERT_KITCHEN' },
            ],
            rules: {
                centralPurchaseControl: 'All outlet purchase requests flow to Central Purchase review',
                closingCycles: 'Bi-monthly: 1st-15th and 16th-MonthEnd',
                directSupplierDelivery: 'Supported with destination-specific GRN',
            },
        });
    }
    catch (error) {
        return (0, response_1.sendError)(res, 500, 'OUTLET_FETCH_ERROR', 'Failed to retrieve outlet topology', {
            error: error.message,
        });
    }
});
exports.default = router;
