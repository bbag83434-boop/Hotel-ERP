import { apiClient } from './axios';
import {
  ChartOfAccount,
  JournalEntry,
  AccountsPayable,
  AccountsReceivable,
  ExpenseEntry,
  ProfitAndLossReport,
  CashFlowReport,
  TrialBalanceReport,
  BalanceSheetReport,
  TaxBreakupReport,
  BankCashReconciliationReport
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

  // Reports (Part 18 Advanced Accounting)
  getProfitAndLoss: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<ProfitAndLossReport> => {
    const res = await apiClient.get('/accounting/reports/pnl', { params });
    return res.data.data;
  },

  getCashFlow: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<CashFlowReport> => {
    const res = await apiClient.get('/accounting/reports/cash-flow', { params });
    return res.data.data;
  },

  getTrialBalance: async (params?: { branchId?: string; asOfDate?: string }): Promise<TrialBalanceReport> => {
    const res = await apiClient.get('/accounting/reports/trial-balance', { params });
    return res.data.data;
  },

  getBalanceSheet: async (params?: { branchId?: string; asOfDate?: string }): Promise<BalanceSheetReport> => {
    const res = await apiClient.get('/accounting/reports/balance-sheet', { params });
    return res.data.data;
  },

  getTaxBreakup: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<TaxBreakupReport> => {
    const res = await apiClient.get('/accounting/reports/tax-breakup', { params });
    return res.data.data;
  },

  getCashBankReconciliation: async (params?: { branchId?: string; startDate?: string; endDate?: string }): Promise<BankCashReconciliationReport> => {
    const res = await apiClient.get('/accounting/reports/cash-bank-reconciliation', { params });
    return res.data.data;
  }
};
