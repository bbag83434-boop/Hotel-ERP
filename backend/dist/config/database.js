"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
const environment_1 = require("./environment");
exports.prisma = globalThis.prismaGlobal ??
    new client_1.PrismaClient({
        log: environment_1.env.isProduction ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'],
    });
if (!environment_1.env.isProduction) {
    globalThis.prismaGlobal = exports.prisma;
}
async function connectDatabase() {
    try {
        await exports.prisma.$connect();
        console.log('✅ Neon PostgreSQL Database Connected Successfully');
        return true;
    }
    catch (error) {
        console.error('❌ Failed to connect to Neon PostgreSQL Database:', error);
        return false;
    }
}
async function disconnectDatabase() {
    try {
        await exports.prisma.$disconnect();
        console.log('🔌 Database disconnected cleanly');
    }
    catch (error) {
        console.error('Error during database disconnect:', error);
    }
}
