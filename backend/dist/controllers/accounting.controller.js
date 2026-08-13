"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingController = void 0;
const accounting_service_1 = require("../services/accounting.service");
const response_utils_1 = require("../utils/response.utils");
const database_1 = require("../config/database");
const accounting_schema_1 = require("../schemas/accounting.schema");
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
class AccountingController {
    // Chart of Accounts
    static async getAccounts(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const accounts = await accounting_service_1.AccountingService.getAccounts(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, accounts, 'Chart of Accounts retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createAccount(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = accounting_schema_1.createAccountSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const account = await accounting_service_1.AccountingService.createAccount(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, account, 'Account created successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    // Journal Entries
    static async getGeneralLedger(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const accountId = req.query.accountId || undefined;
            const branchId = req.query.branchId || undefined;
            const startDate = req.query.startDate || undefined;
            const endDate = req.query.endDate || undefined;
            const entries = await accounting_service_1.AccountingService.getGeneralLedger(companyId, {
                accountId,
                branchId,
                startDate,
                endDate
            });
            return (0, response_utils_1.sendSuccess)(res, entries, 'General ledger entries retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async createJournalEntry(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = accounting_schema_1.createJournalEntrySchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const entry = await accounting_service_1.AccountingService.createJournalEntry(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, entry, 'Journal entry posted successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    // Expenses
    static async createExpense(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const data = accounting_schema_1.createExpenseSchema.parse(req.body);
            const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
            const expense = await accounting_service_1.AccountingService.createExpense(companyId, data, req.user?.userId, getClientIp(req), userAgent);
            return (0, response_utils_1.sendSuccess)(res, expense, 'Expense recorded and GL journal posted successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    // AP / AR
    static async getAccountsPayable(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const payables = await accounting_service_1.AccountingService.getAccountsPayable(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, payables, 'Accounts Payable retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async getAccountsReceivable(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const receivables = await accounting_service_1.AccountingService.getAccountsReceivable(companyId, branchId);
            return (0, response_utils_1.sendSuccess)(res, receivables, 'Accounts Receivable retrieved successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    // Financial Reports
    static async getProfitAndLoss(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const startDate = req.query.startDate || undefined;
            const endDate = req.query.endDate || undefined;
            const pnl = await accounting_service_1.AccountingService.getProfitAndLoss(companyId, {
                branchId,
                startDate,
                endDate
            });
            return (0, response_utils_1.sendSuccess)(res, pnl, 'Profit and Loss report generated successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
    static async getCashFlow(req, res, next) {
        try {
            const companyId = await resolveCompanyId(req);
            const branchId = req.query.branchId || undefined;
            const startDate = req.query.startDate || undefined;
            const endDate = req.query.endDate || undefined;
            const cashFlow = await accounting_service_1.AccountingService.getCashFlow(companyId, {
                branchId,
                startDate,
                endDate
            });
            return (0, response_utils_1.sendSuccess)(res, cashFlow, 'Cash Flow statement generated successfully', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AccountingController = AccountingController;
