"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalController = void 0;
const approval_service_1 = require("../services/approval.service");
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const approval_schema_1 = require("../schemas/approval.schema");
const resolveCompanyId = async (req) => {
    if (req.user?.companyId)
        return req.user.companyId;
    const company = await database_1.prisma.company.findFirst({ where: { isActive: true } });
    if (!company)
        throw new response_utils_1.AppError('No active company found in system', 400);
    return company.id;
};
const getClientIp = (req) => {
    const xf = req.headers['x-forwarded-for'];
    if (Array.isArray(xf))
        return xf[0] || '';
    if (typeof xf === 'string')
        return xf.split(',')[0].trim();
    return req.ip || '';
};
class ApprovalController {
    // Requests
    static async getRequests(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId, status, transactionType } = req.query;
            const requests = await approval_service_1.ApprovalService.getApprovalRequests(companyId, {
                branchId: branchId,
                status: status,
                transactionType: transactionType
            });
            return (0, response_utils_1.sendSuccess)(res, requests, 'Approval requests retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createRequest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = approval_schema_1.createApprovalRequestSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const request = await approval_service_1.ApprovalService.createApprovalRequest(companyId, data, req.user.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, request, 'Approval request submitted', 201);
        }
        catch (err) {
            next(err);
        }
    }
    static async actOnRequest(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { id } = req.params;
            const data = approval_schema_1.actOnApprovalSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const request = await approval_service_1.ApprovalService.actOnApproval(companyId, String(id), data, req.user.userId, req.user.role, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, request, `Approval request ${data.action.toLowerCase()}`, 200);
        }
        catch (err) {
            next(err);
        }
    }
    // Rules
    static async getRules(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const { branchId } = req.query;
            const rules = await approval_service_1.ApprovalService.getApprovalRules(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, rules, 'Approval rules retrieved', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createRule(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = approval_schema_1.createApprovalRuleSchema.parse(req.body);
            const rule = await approval_service_1.ApprovalService.createApprovalRule(companyId, data);
            return (0, response_utils_1.sendSuccess)(res, rule, 'Approval rule created', 201);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ApprovalController = ApprovalController;
