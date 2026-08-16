import { Router } from 'express';
import { AccountingController } from '../controllers/accounting.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Chart of Accounts
router.get('/accounts', AccountingController.getAccounts);
router.post('/accounts', requirePermission('accounting:manage'), AccountingController.createAccount);

// General Ledger (Double-Entry Journals)
router.get('/general-ledger', AccountingController.getGeneralLedger);
router.post('/journal-entries', requirePermission('accounting:manage'), AccountingController.createJournalEntry);

// Expenses
router.post('/expenses', requirePermission('accounting:manage'), AccountingController.createExpense);

// AP / AR
router.get('/accounts-payable', AccountingController.getAccountsPayable);
router.get('/accounts-receivable', AccountingController.getAccountsReceivable);

// Financial Statements & Reports (Part 18 Advanced Accounting)
router.get('/reports/pnl', AccountingController.getProfitAndLoss);
router.get('/reports/cash-flow', AccountingController.getCashFlow);
router.get('/reports/trial-balance', AccountingController.getTrialBalance);
router.get('/reports/balance-sheet', AccountingController.getBalanceSheet);
router.get('/reports/tax-breakup', AccountingController.getTaxBreakupReport);
router.get('/reports/cash-bank-reconciliation', AccountingController.getBankCashReconciliation);

export default router;
