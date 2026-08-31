export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type AccountSubType =
  | 'CURRENT_ASSET'
  | 'FIXED_ASSET'
  | 'CURRENT_LIABILITY'
  | 'LONG_TERM_LIABILITY'
  | 'EQUITY_CAPITAL'
  | 'RETAINED_EARNINGS'
  | 'OPERATING_REVENUE'
  | 'COST_OF_GOODS_SOLD'
  | 'OPERATING_EXPENSE'
  | 'OTHER_EXPENSE';

export interface ChartOfAccount {
  id: string;
  branchId?: string | null;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  balance: number | string;
  isSystem: boolean;
  isActive: boolean;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: number | string;
  credit: number | string;
  narration?: string;
  account?: ChartOfAccount;
}

export interface JournalEntry {
  id: string;
  branchId?: string | null;
  entryNumber: string;
  date: string;
  referenceType: string;
  referenceId?: string;
  narration: string;
  status: 'DRAFT' | 'POSTED' | 'VOID';
  totalDebit: number | string;
  totalCredit: number | string;
  lines: JournalEntryLine[];
  createdAt: string;
}

export interface AccountsPayable {
  id: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number | string;
  paidAmount: number | string;
  balance: number | string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  referenceType?: string;
  referenceId?: string;
  supplier?: { id: string; name: string; code: string };
}

export interface AccountsReceivable {
  id: string;
  guestId?: string;
  bookingId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number | string;
  paidAmount: number | string;
  balance: number | string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  guest?: { id: string; firstName: string; lastName: string; email?: string };
  booking?: { id: string; bookingNumber: string };
}

export interface ExpenseEntry {
  id: string;
  expenseNumber: string;
  category: string;
  expenseAccountId: string;
  paidFromAccountId: string;
  amount: number | string;
  taxAmount: number | string;
  paymentMethod: string;
  paidTo: string;
  date: string;
  receiptUrl?: string;
  notes?: string;
  expenseAccount?: ChartOfAccount;
  paidFromAccount?: ChartOfAccount;
  createdAt: string;
}

export interface ProfitAndLossReport {
  period: { startDate: string; endDate: string };
  revenue: {
    items: Array<{ code: string; name: string; amount: number }>;
    total: number;
  };
  cogs: {
    items: Array<{ code: string; name: string; amount: number }>;
    total: number;
  };
  grossProfit: number;
  operatingExpenses: {
    items: Array<{ code: string; name: string; amount: number }>;
    total: number;
  };
  netIncome: number;
}

export interface CashFlowReport {
  period: { startDate: string; endDate: string };
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  transactions: Array<{
    date: string;
    entryNumber: string;
    referenceType: string;
    narration: string;
    accountName: string;
    inflow: number;
    outflow: number;
    netCash: number;
  }>;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  totalDebits: number;
  totalCredits: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceReport {
  asOfDate: string;
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  variance: number;
  accounts: TrialBalanceRow[];
}

export interface BalanceSheetReport {
  asOfDate: string;
  isBalanced: boolean;
  assets: {
    currentAssets: Array<{ code: string; name: string; amount: number }>;
    nonCurrentAssets: Array<{ code: string; name: string; amount: number }>;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: Array<{ code: string; name: string; amount: number }>;
    longTermLiabilities: Array<{ code: string; name: string; amount: number }>;
    totalLiabilities: number;
  };
  equity: {
    items: Array<{ code: string; name: string; amount: number }>;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export interface TaxBreakupReport {
  period: { startDate: string; endDate: string };
  outputTaxCollected: number;
  inputTaxCredit: number;
  netTaxPayable: number;
  taxEntries: Array<{
    date: string;
    entryNumber: string;
    referenceType: string;
    accountCode: string;
    accountName: string;
    narration: string;
    taxCollected: number;
    taxPaid: number;
  }>;
}

export interface BankCashReconciliationReport {
  period: { startDate: string; endDate: string };
  cashDrawerBalance: number;
  bankAccountBalance: number;
  totalLiquidFunds: number;
  periodInflows: number;
  periodOutflows: number;
  netChange: number;
  recentCashTransactions: Array<{
    date: string;
    entryNumber: string;
    referenceType: string;
    narration: string;
    accountName: string;
    inflow: number;
    outflow: number;
    netCash: number;
  }>;
}
