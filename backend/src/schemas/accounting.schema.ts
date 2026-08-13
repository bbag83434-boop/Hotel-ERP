import { z } from 'zod';

export const createAccountSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  code: z.string().min(1, 'Account code is required'),
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  subType: z.enum([
    'CURRENT_ASSET',
    'FIXED_ASSET',
    'CURRENT_LIABILITY',
    'LONG_TERM_LIABILITY',
    'EQUITY_CAPITAL',
    'RETAINED_EARNINGS',
    'OPERATING_REVENUE',
    'COST_OF_GOODS_SOLD',
    'OPERATING_EXPENSE',
    'OTHER_EXPENSE'
  ]),
  balance: z.number().default(0)
});

export const createJournalEntrySchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  date: z.string().optional(),
  referenceType: z.string().default('GENERAL_JOURNAL'),
  referenceId: z.string().optional(),
  narration: z.string().min(1, 'Narration/description is required'),
  lines: z.array(
    z.object({
      accountId: z.string().uuid('Valid Account ID is required'),
      debit: z.number().min(0).default(0),
      credit: z.number().min(0).default(0),
      narration: z.string().optional()
    })
  ).min(2, 'Journal entry must have at least 2 lines (double-entry)')
});

export const createExpenseSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  category: z.string().min(1, 'Expense category is required'),
  expenseAccountId: z.string().uuid('Valid Expense Account ID is required'),
  paidFromAccountId: z.string().uuid('Valid Paid-From Account ID is required'),
  amount: z.number().min(0.01, 'Expense amount must be positive'),
  taxAmount: z.number().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']).default('CASH'),
  paidTo: z.string().min(1, 'Payee name is required'),
  date: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional()
});

export const settleAPInvoiceSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  paidFromAccountId: z.string().uuid('Paid-from account is required'),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']).default('CASH'),
  notes: z.string().optional()
});

export const settleARInvoiceSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  depositAccountId: z.string().uuid('Deposit account is required'),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']).default('CASH'),
  notes: z.string().optional()
});
