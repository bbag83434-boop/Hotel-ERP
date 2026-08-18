"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const accounting_controller_1 = require("../controllers/accounting.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const rbac_middleware_1 = require("../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Chart of Accounts
router.get('/accounts', accounting_controller_1.AccountingController.getAccounts);
router.post('/accounts', (0, rbac_middleware_1.requirePermission)('accounting:manage'), accounting_controller_1.AccountingController.createAccount);
// General Ledger (Double-Entry Journals)
router.get('/general-ledger', accounting_controller_1.AccountingController.getGeneralLedger);
router.post('/journal-entries', (0, rbac_middleware_1.requirePermission)('accounting:manage'), accounting_controller_1.AccountingController.createJournalEntry);
// Expenses
router.post('/expenses', (0, rbac_middleware_1.requirePermission)('accounting:manage'), accounting_controller_1.AccountingController.createExpense);
// AP / AR
router.get('/accounts-payable', accounting_controller_1.AccountingController.getAccountsPayable);
router.get('/accounts-receivable', accounting_controller_1.AccountingController.getAccountsReceivable);
// Financial Statements & Reports (Part 18 Advanced Accounting)
router.get('/reports/pnl', accounting_controller_1.AccountingController.getProfitAndLoss);
router.get('/reports/cash-flow', accounting_controller_1.AccountingController.getCashFlow);
router.get('/reports/trial-balance', accounting_controller_1.AccountingController.getTrialBalance);
router.get('/reports/balance-sheet', accounting_controller_1.AccountingController.getBalanceSheet);
router.get('/reports/tax-breakup', accounting_controller_1.AccountingController.getTaxBreakupReport);
router.get('/reports/cash-bank-reconciliation', accounting_controller_1.AccountingController.getBankCashReconciliation);
exports.default = router;
