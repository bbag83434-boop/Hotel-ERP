"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleARInvoiceSchema = exports.settleAPInvoiceSchema = exports.createExpenseSchema = exports.createJournalEntrySchema = exports.createAccountSchema = void 0;
const zod_1 = require("zod");
exports.createAccountSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid().optional().nullable(),
    code: zod_1.z.string().min(1, 'Account code is required'),
    name: zod_1.z.string().min(1, 'Account name is required'),
    type: zod_1.z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
    subType: zod_1.z.enum([
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
    balance: zod_1.z.number().default(0)
});
exports.createJournalEntrySchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid().optional().nullable(),
    date: zod_1.z.string().optional(),
    referenceType: zod_1.z.string().default('GENERAL_JOURNAL'),
    referenceId: zod_1.z.string().optional(),
    narration: zod_1.z.string().min(1, 'Narration/description is required'),
    lines: zod_1.z.array(zod_1.z.object({
        accountId: zod_1.z.string().uuid('Valid Account ID is required'),
        debit: zod_1.z.number().min(0).default(0),
        credit: zod_1.z.number().min(0).default(0),
        narration: zod_1.z.string().optional()
    })).min(2, 'Journal entry must have at least 2 lines (double-entry)')
});
exports.createExpenseSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid().optional().nullable(),
    category: zod_1.z.string().min(1, 'Expense category is required'),
    expenseAccountId: zod_1.z.string().uuid('Valid Expense Account ID is required'),
    paidFromAccountId: zod_1.z.string().uuid('Valid Paid-From Account ID is required'),
    amount: zod_1.z.number().min(0.01, 'Expense amount must be positive'),
    taxAmount: zod_1.z.number().min(0).default(0),
    paymentMethod: zod_1.z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']).default('CASH'),
    paidTo: zod_1.z.string().min(1, 'Payee name is required'),
    date: zod_1.z.string().optional(),
    receiptUrl: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional()
});
exports.settleAPInvoiceSchema = zod_1.z.object({
    amount: zod_1.z.number().min(0.01, 'Payment amount must be greater than 0'),
    paidFromAccountId: zod_1.z.string().uuid('Paid-from account is required'),
    paymentMethod: zod_1.z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']).default('CASH'),
    notes: zod_1.z.string().optional()
});
exports.settleARInvoiceSchema = zod_1.z.object({
    amount: zod_1.z.number().min(0.01, 'Payment amount must be greater than 0'),
    depositAccountId: zod_1.z.string().uuid('Deposit account is required'),
    paymentMethod: zod_1.z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_BANKING', 'ROOM_POSTING', 'SPLIT']).default('CASH'),
    notes: zod_1.z.string().optional()
});
