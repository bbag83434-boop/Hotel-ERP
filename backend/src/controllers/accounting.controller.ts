import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AccountingService } from '../services/accounting.service';
import { sendSuccess, AppError } from '../utils/response.utils';
import { prisma } from '../config/database';
import {
  createAccountSchema,
  createJournalEntrySchema,
  createExpenseSchema
} from '../schemas/accounting.schema';

const resolveCompanyId = async (req: AuthenticatedRequest): Promise<string> => {
  if (req.user?.companyId) return req.user.companyId;
  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) throw new AppError('No active company found in system', 400);
  return company.id;
};

const getClientIp = (req: AuthenticatedRequest): string => {
  const xf = req.headers['x-forwarded-for'];
  if (Array.isArray(xf)) return xf[0] || '';
  if (typeof xf === 'string') return xf.split(',')[0].trim();
  return req.ip || '';
};

export class AccountingController {
  // Chart of Accounts
  public static async getAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const accounts = await AccountingService.getAccounts(companyId, branchId);
      return sendSuccess(res, accounts, 'Chart of Accounts retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createAccountSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const account = await AccountingService.createAccount(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, account, 'Account created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  // Journal Entries
  public static async getGeneralLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const accountId = (req.query.accountId as string) || undefined;
      const branchId = (req.query.branchId as string) || undefined;
      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;
      const entries = await AccountingService.getGeneralLedger(companyId, {
        accountId,
        branchId,
        startDate,
        endDate
      });
      return sendSuccess(res, entries, 'General ledger entries retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async createJournalEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createJournalEntrySchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const entry = await AccountingService.createJournalEntry(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, entry, 'Journal entry posted successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  // Expenses
  public static async createExpense(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const data = createExpenseSchema.parse(req.body);
      const userAgent = Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'];
      const expense = await AccountingService.createExpense(
        companyId,
        data,
        req.user?.userId,
        getClientIp(req),
        userAgent
      );
      return sendSuccess(res, expense, 'Expense recorded and GL journal posted successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  // AP / AR
  public static async getAccountsPayable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const payables = await AccountingService.getAccountsPayable(companyId, branchId);
      return sendSuccess(res, payables, 'Accounts Payable retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getAccountsReceivable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const receivables = await AccountingService.getAccountsReceivable(companyId, branchId);
      return sendSuccess(res, receivables, 'Accounts Receivable retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  // Financial Reports
  public static async getProfitAndLoss(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;
      const pnl = await AccountingService.getProfitAndLoss(companyId, {
        branchId,
        startDate,
        endDate
      });
      return sendSuccess(res, pnl, 'Profit and Loss report generated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public static async getCashFlow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = await resolveCompanyId(req);
      const branchId = (req.query.branchId as string) || undefined;
      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;
      const cashFlow = await AccountingService.getCashFlow(companyId, {
        branchId,
        startDate,
        endDate
      });
      return sendSuccess(res, cashFlow, 'Cash Flow statement generated successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}
