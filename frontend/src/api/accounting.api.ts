import { apiClient } from './axios';
import {
  ChartOfAccount,
  JournalEntry,
  AccountsPayable,
  AccountsReceivable,
  ExpenseEntry,
  ProfitAndLossReport,
  CashFlowReport
} from '../types/accounting.types';

export const accountingApi = {
  // Chart of Accounts
  getAccounts: async (branchId?: string): Promise<ChartOfAccount[]> => {
    const res = await apiClient.get('/accounting/accounts', { params: { branchId } });
    return res.data.data;
  },

  createAccount: async (data: Partial<ChartOfAccount>): Promise<ChartOfAccount> => {
    const res = await apiClient.post('/accounting/accounts', data);
    return res.data.data;
  },

  // General Ledger
  getGeneralLedger: async (params?: { accountId?: string; branchId?: string; startDate?: string; endDate?: string }): Promise<JournalEntry[]> => {
    const res = await apiClient.get('/accounting/general-ledger', { params });
    return res.data.data;
  },

  createJournalEntry: async (data: any): Promise<JournalEntry> => {
    const res = await apiClient.post('/accounting/journal-entries', data);
    return res.data.data;
  },

  // Expenses
  createExpense: async (data: any): Promise<ExpenseEntry> => {
    const res = await apiClient.post('/accounting/expenses', data);
    return res.data.data;
  },

  // AP / AR
  getAccountsPayable: async (branchId?: string): Promise<AccountsPayable[]> => {
    const res = await apiClient.get('/accounting/accounts-payable', { params: { branchId } });
    return res.data.data;
  },

  getAccountsReceivable: async (branchId?: string): Promise<AccountsReceivable[]> => {
    const res = await apiClient.get('/accounting/accounts-receivable', { params: { branchId } });
    return res.data.data;
  },

  // Reports
  getProfitAndLoss: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<ProfitAndLossReport> => {
    const res = await apiClient.get('/accounting/reports/pnl', { params });
    return res.data.data;
  },

  getCashFlow: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<CashFlowReport> => {
    const res = await apiClient.get('/accounting/reports/cash-flow', { params });
    return res.data.data;
  }
};
