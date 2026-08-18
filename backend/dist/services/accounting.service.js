"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingService = void 0;
const client_1 = require("@prisma/client");
const database_1 = require("../config/database");
const response_utils_1 = require("../utils/response.utils");
const audit_service_1 = require("./audit.service");
class AccountingService {
    // ==========================================
    // CHART OF ACCOUNTS
    // ==========================================
    static async getAccounts(companyId, branchId) {
        return database_1.prisma.chartOfAccount.findMany({
            where: {
                companyId,
                isActive: true,
                ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {})
            },
            orderBy: { code: 'asc' }
        });
    }
    static async getAccountByCode(companyId, code) {
        return database_1.prisma.chartOfAccount.findFirst({
            where: { companyId, code }
        });
    }
    static async createAccount(companyId, data, actorId, ipAddress, userAgent) {
        const existing = await database_1.prisma.chartOfAccount.findFirst({
            where: { companyId, code: data.code }
        });
        if (existing) {
            throw new response_utils_1.AppError(`Account with code ${data.code} already exists`, 409);
        }
        const account = await database_1.prisma.chartOfAccount.create({
            data: {
                companyId,
                branchId: data.branchId || null,
                code: data.code,
                name: data.name,
                type: data.type,
                subType: data.subType,
                balance: new client_1.Prisma.Decimal(data.balance || 0)
            }
        });
        await audit_service_1.AuditService.log({
            userId: actorId,
            action: 'ACCOUNT_CREATED',
            entity: 'ChartOfAccount',
            entityId: account.id,
            details: { code: account.code, name: account.name, type: account.type },
            ipAddress,
            userAgent
        });
        return account;
    }
    // ==========================================
    // CORE DOUBLE-ENTRY JOURNAL ENGINE
    // ==========================================
    static async createJournalEntry(companyId, data, actorId, ipAddress, userAgent) {
        // Validate Double-Entry Balance: sum(debit) MUST equal sum(credit)
        let totalDebit = new client_1.Prisma.Decimal(0);
        let totalCredit = new client_1.Prisma.Decimal(0);
        for (const line of data.lines) {
            const d = new client_1.Prisma.Decimal(line.debit || 0);
            const c = new client_1.Prisma.Decimal(line.credit || 0);
            totalDebit = totalDebit.plus(d);
            totalCredit = totalCredit.plus(c);
        }
        if (!totalDebit.equals(totalCredit)) {
            throw new response_utils_1.AppError(`Journal entry is unbalanced! Total Debit ($${totalDebit.toFixed(2)}) does not equal Total Credit ($${totalCredit.toFixed(2)})`, 400);
        }
        if (totalDebit.isZero()) {
            throw new response_utils_1.AppError('Journal entry amounts cannot be zero', 400);
        }
        return database_1.prisma.$transaction(async (tx) => {
            const entryCount = await tx.journalEntry.count({ where: { companyId } });
            const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(6, '0')}`;
            const journalEntry = await tx.journalEntry.create({
                data: {
                    companyId,
                    branchId: data.branchId || null,
                    entryNumber,
                    date: data.date ? new Date(data.date) : new Date(),
                    referenceType: data.referenceType,
                    referenceId: data.referenceId,
                    narration: data.narration,
                    status: 'POSTED',
                    totalDebit,
                    totalCredit,
                    createdById: actorId || null,
                    lines: {
                        create: data.lines.map((l) => ({
                            accountId: l.accountId,
                            debit: new client_1.Prisma.Decimal(l.debit || 0),
                            credit: new client_1.Prisma.Decimal(l.credit || 0),
                            narration: l.narration
                        }))
                    }
                },
                include: {
                    lines: { include: { account: true } }
                }
            });
            // Update Account Balances in Chart of Accounts
            for (const line of data.lines) {
                const debit = new client_1.Prisma.Decimal(line.debit || 0);
                const credit = new client_1.Prisma.Decimal(line.credit || 0);
                const account = await tx.chartOfAccount.findUnique({ where: { id: line.accountId } });
                if (!account)
                    continue;
                let delta = new client_1.Prisma.Decimal(0);
                if (account.type === 'ASSET' || account.type === 'EXPENSE') {
                    delta = debit.minus(credit);
                }
                else {
                    // LIABILITY, EQUITY, REVENUE
                    delta = credit.minus(debit);
                }
                await tx.chartOfAccount.update({
                    where: { id: line.accountId },
                    data: {
                        balance: { increment: delta }
                    }
                });
            }
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'JOURNAL_ENTRY_POSTED',
                entity: 'JournalEntry',
                entityId: journalEntry.id,
                details: {
                    entryNumber,
                    referenceType: data.referenceType,
                    totalAmount: totalDebit.toString()
                },
                ipAddress,
                userAgent
            });
            return journalEntry;
        }, { maxWait: 10000, timeout: 30000 });
    }
    // ==========================================
    // AUTOMATED MODULE INTEGRATION (CROSS-MODULE HOOKS)
    // ==========================================
    // 1. POS Sale Double-Entry Hook
    static async recordPosSaleJournal(params) {
        const { companyId, branchId, orderId, orderNumber, grandTotal, taxAmount, totalCogs, paymentMethod, actorId } = params;
        // Accounts: 1010 (Cash) / 1020 (Bank Card), 4010 (F&B Revenue), 2020 (Tax Payable), 5010 (COGS), 1300 (Inventory Asset)
        const [cashAcc, bankAcc, revAcc, taxAcc, cogsAcc, invAcc] = await Promise.all([
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '1010' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '1020' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '4010' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '2020' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '5010' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '1300' } })
        ]);
        if (!revAcc)
            return null;
        const debitAcc = paymentMethod === 'CASH' ? (cashAcc || revAcc) : (bankAcc || cashAcc || revAcc);
        const total = new client_1.Prisma.Decimal(grandTotal);
        const tax = new client_1.Prisma.Decimal(taxAmount || 0);
        const netRevenue = total.minus(tax);
        const lines = [
            {
                accountId: debitAcc.id,
                debit: total,
                credit: 0,
                narration: `Payment received via ${paymentMethod}`
            },
            {
                accountId: revAcc.id,
                debit: 0,
                credit: netRevenue,
                narration: `F&B Sales Revenue for Order #${orderNumber}`
            }
        ];
        if (tax.greaterThan(0) && taxAcc) {
            lines.push({
                accountId: taxAcc.id,
                debit: 0,
                credit: tax,
                narration: `Sales Tax Payable on Order #${orderNumber}`
            });
        }
        // COGS & Inventory Asset entry if COGS > 0
        const cogs = new client_1.Prisma.Decimal(totalCogs || 0);
        if (cogs.greaterThan(0) && cogsAcc && invAcc) {
            lines.push({
                accountId: cogsAcc.id,
                debit: cogs,
                credit: 0,
                narration: `Cost of Goods Sold (Recipe BOM) for Order #${orderNumber}`
            }, {
                accountId: invAcc.id,
                debit: 0,
                credit: cogs,
                narration: `Inventory raw materials consumed for Order #${orderNumber}`
            });
        }
        return this.createJournalEntry(companyId, {
            branchId,
            referenceType: 'POS_SALE',
            referenceId: orderId,
            narration: `POS Sale settlement for Order #${orderNumber}`,
            lines
        }, actorId);
    }
    // 2. Purchase GRN Double-Entry Hook
    static async recordPurchaseGrnJournal(params) {
        const { companyId, branchId, supplierId, grnId, grnNumber, totalAmount, actorId } = params;
        const [invAcc, apAcc] = await Promise.all([
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '1300' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '2010' } })
        ]);
        if (!invAcc || !apAcc)
            return null;
        const total = new client_1.Prisma.Decimal(totalAmount);
        // Create AccountsPayable Record
        await database_1.prisma.accountsPayable.create({
            data: {
                companyId,
                branchId,
                supplierId,
                invoiceNumber: `INV-${grnNumber}`,
                amount: total,
                balance: total,
                status: 'UNPAID',
                referenceType: 'GRN',
                referenceId: grnId
            }
        });
        return this.createJournalEntry(companyId, {
            branchId,
            referenceType: 'PURCHASE_INVOICE',
            referenceId: grnId,
            narration: `Inventory received on Goods Receive Note #${grnNumber}`,
            lines: [
                {
                    accountId: invAcc.id,
                    debit: total,
                    credit: 0,
                    narration: `Raw material inventory received #${grnNumber}`
                },
                {
                    accountId: apAcc.id,
                    debit: 0,
                    credit: total,
                    narration: `Accounts Payable to Supplier on GRN #${grnNumber}`
                }
            ]
        }, actorId);
    }
    // 3. Hotel Folio Billing & Settlement Hook
    static async recordHotelFolioJournal(params) {
        const { companyId, branchId, bookingId, bookingNumber, totalAmount, roomRevenueAmount, taxAmount, paymentMethod, actorId } = params;
        const [cashAcc, bankAcc, roomRevAcc, otherRevAcc, taxAcc] = await Promise.all([
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '1010' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '1020' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '4020' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '4010' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '2020' } })
        ]);
        if (!roomRevAcc)
            return null;
        const total = new client_1.Prisma.Decimal(totalAmount);
        const roomRev = new client_1.Prisma.Decimal(roomRevenueAmount);
        const tax = new client_1.Prisma.Decimal(taxAmount || 0);
        const extraCharges = total.minus(roomRev).minus(tax);
        const debitAcc = paymentMethod === 'CASH' ? (cashAcc || roomRevAcc) : (bankAcc || cashAcc || roomRevAcc);
        const lines = [
            {
                accountId: debitAcc.id,
                debit: total,
                credit: 0,
                narration: `Hotel folio payment received via ${paymentMethod}`
            },
            {
                accountId: roomRevAcc.id,
                debit: 0,
                credit: roomRev,
                narration: `Room Revenue for Booking #${bookingNumber}`
            }
        ];
        if (extraCharges.greaterThan(0) && (otherRevAcc || roomRevAcc)) {
            lines.push({
                accountId: (otherRevAcc || roomRevAcc).id,
                debit: 0,
                credit: extraCharges,
                narration: `Hotel Incidentals & F&B/Spa Revenue for Booking #${bookingNumber}`
            });
        }
        if (tax.greaterThan(0) && taxAcc) {
            lines.push({
                accountId: taxAcc.id,
                debit: 0,
                credit: tax,
                narration: `City Hospitality Tax Payable for Booking #${bookingNumber}`
            });
        }
        return this.createJournalEntry(companyId, {
            branchId,
            referenceType: 'HOTEL_FOLIO_BILLING',
            referenceId: bookingId,
            narration: `Hotel checkout settlement for Booking #${bookingNumber}`,
            lines
        }, actorId);
    }
    // ==========================================
    // EXPENSES MANAGEMENT
    // ==========================================
    static async createExpense(companyId, data, actorId, ipAddress, userAgent) {
        return database_1.prisma.$transaction(async (tx) => {
            const expCount = await tx.expenseEntry.count({ where: { companyId } });
            const expenseNumber = `EXP-${new Date().getFullYear()}-${String(expCount + 1).padStart(5, '0')}`;
            const expense = await tx.expenseEntry.create({
                data: {
                    companyId,
                    branchId: data.branchId || null,
                    expenseNumber,
                    category: data.category,
                    expenseAccountId: data.expenseAccountId,
                    paidFromAccountId: data.paidFromAccountId,
                    amount: new client_1.Prisma.Decimal(data.amount),
                    taxAmount: new client_1.Prisma.Decimal(data.taxAmount || 0),
                    paymentMethod: data.paymentMethod || 'CASH',
                    paidTo: data.paidTo,
                    date: data.date ? new Date(data.date) : new Date(),
                    receiptUrl: data.receiptUrl,
                    notes: data.notes,
                    createdById: actorId || null
                }
            });
            // Post Balanced Double-Entry Journal
            const totalAmount = new client_1.Prisma.Decimal(data.amount);
            const entryCount = await tx.journalEntry.count({ where: { companyId } });
            const entryNumber = `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(6, '0')}`;
            await tx.journalEntry.create({
                data: {
                    companyId,
                    branchId: data.branchId || null,
                    entryNumber,
                    date: expense.date,
                    referenceType: 'EXPENSE_PAYMENT',
                    referenceId: expense.id,
                    narration: `Expense payout to ${data.paidTo} for ${data.category} (${expenseNumber})`,
                    status: 'POSTED',
                    totalDebit: totalAmount,
                    totalCredit: totalAmount,
                    createdById: actorId || null,
                    lines: {
                        create: [
                            {
                                accountId: data.expenseAccountId,
                                debit: totalAmount,
                                credit: new client_1.Prisma.Decimal(0),
                                narration: `Expense: ${data.category} (${data.notes || ''})`
                            },
                            {
                                accountId: data.paidFromAccountId,
                                debit: new client_1.Prisma.Decimal(0),
                                credit: totalAmount,
                                narration: `Paid from account to ${data.paidTo}`
                            }
                        ]
                    }
                }
            });
            // Update account balances
            await tx.chartOfAccount.update({
                where: { id: data.expenseAccountId },
                data: { balance: { increment: totalAmount } }
            });
            await tx.chartOfAccount.update({
                where: { id: data.paidFromAccountId },
                data: { balance: { decrement: totalAmount } }
            });
            await audit_service_1.AuditService.log({
                userId: actorId,
                action: 'EXPENSE_RECORDED',
                entity: 'ExpenseEntry',
                entityId: expense.id,
                details: { expenseNumber, paidTo: data.paidTo, amount: totalAmount.toString() },
                ipAddress,
                userAgent
            });
            return expense;
        }, { maxWait: 10000, timeout: 30000 });
    }
    // ==========================================
    // FINANCIAL STATEMENTS & REPORTS
    // ==========================================
    // Profit & Loss Report (Dynamically computed from GL)
    static async getProfitAndLoss(companyId, params) {
        const start = params.startDate ? new Date(params.startDate) : new Date(new Date().getFullYear(), 0, 1);
        const end = params.endDate ? new Date(params.endDate) : new Date();
        const journalLines = await database_1.prisma.journalEntryLine.findMany({
            where: {
                journalEntry: {
                    companyId,
                    status: 'POSTED',
                    date: { gte: start, lte: end },
                    ...(params.branchId ? { branchId: params.branchId } : {})
                }
            },
            include: {
                account: true
            }
        });
        const revenueMap = {};
        const cogsMap = {};
        const expenseMap = {};
        let totalRevenue = 0;
        let totalCogs = 0;
        let totalExpenses = 0;
        for (const line of journalLines) {
            const acc = line.account;
            const netCredit = Number(line.credit) - Number(line.debit);
            const netDebit = Number(line.debit) - Number(line.credit);
            if (acc.type === 'REVENUE') {
                if (!revenueMap[acc.code]) {
                    revenueMap[acc.code] = { code: acc.code, name: acc.name, amount: 0 };
                }
                revenueMap[acc.code].amount += netCredit;
                totalRevenue += netCredit;
            }
            else if (acc.subType === 'COST_OF_GOODS_SOLD') {
                if (!cogsMap[acc.code]) {
                    cogsMap[acc.code] = { code: acc.code, name: acc.name, amount: 0 };
                }
                cogsMap[acc.code].amount += netDebit;
                totalCogs += netDebit;
            }
            else if (acc.type === 'EXPENSE') {
                if (!expenseMap[acc.code]) {
                    expenseMap[acc.code] = { code: acc.code, name: acc.name, amount: 0 };
                }
                expenseMap[acc.code].amount += netDebit;
                totalExpenses += netDebit;
            }
        }
        const grossProfit = totalRevenue - totalCogs;
        const netIncome = grossProfit - totalExpenses;
        return {
            period: { startDate: start, endDate: end },
            revenue: {
                items: Object.values(revenueMap),
                total: totalRevenue
            },
            cogs: {
                items: Object.values(cogsMap),
                total: totalCogs
            },
            grossProfit,
            operatingExpenses: {
                items: Object.values(expenseMap),
                total: totalExpenses
            },
            netIncome
        };
    }
    // Cash Flow Statement (Computed from Cash/Bank GL lines)
    static async getCashFlow(companyId, params) {
        const start = params.startDate ? new Date(params.startDate) : new Date(new Date().getFullYear(), 0, 1);
        const end = params.endDate ? new Date(params.endDate) : new Date();
        const cashAccounts = await database_1.prisma.chartOfAccount.findMany({
            where: {
                companyId,
                type: 'ASSET',
                subType: 'CURRENT_ASSET',
                code: { in: ['1010', '1020'] }
            }
        });
        const cashAccountIds = cashAccounts.map((a) => a.id);
        const cashLines = await database_1.prisma.journalEntryLine.findMany({
            where: {
                accountId: { in: cashAccountIds },
                journalEntry: {
                    companyId,
                    status: 'POSTED',
                    date: { gte: start, lte: end },
                    ...(params.branchId ? { branchId: params.branchId } : {})
                }
            },
            include: {
                journalEntry: true,
                account: true
            },
            orderBy: { journalEntry: { date: 'asc' } }
        });
        let totalInflow = 0;
        let totalOutflow = 0;
        const cashTransactions = cashLines.map((l) => {
            const inflow = Number(l.debit);
            const outflow = Number(l.credit);
            totalInflow += inflow;
            totalOutflow += outflow;
            return {
                date: l.journalEntry.date,
                entryNumber: l.journalEntry.entryNumber,
                referenceType: l.journalEntry.referenceType,
                narration: l.narration || l.journalEntry.narration,
                accountName: l.account.name,
                inflow,
                outflow,
                netCash: inflow - outflow
            };
        });
        return {
            period: { startDate: start, endDate: end },
            totalInflow,
            totalOutflow,
            netCashFlow: totalInflow - totalOutflow,
            transactions: cashTransactions
        };
    }
    // General Ledger
    static async getGeneralLedger(companyId, params) {
        return database_1.prisma.journalEntry.findMany({
            where: {
                companyId,
                status: 'POSTED',
                ...(params.branchId ? { branchId: params.branchId } : {}),
                ...(params.startDate || params.endDate
                    ? {
                        date: {
                            ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
                            ...(params.endDate ? { lte: new Date(params.endDate) } : {})
                        }
                    }
                    : {})
            },
            include: {
                lines: {
                    where: params.accountId ? { accountId: params.accountId } : undefined,
                    include: { account: true }
                }
            },
            orderBy: { date: 'desc' }
        });
    }
    // Accounts Payable List
    static async getAccountsPayable(companyId, branchId) {
        return database_1.prisma.accountsPayable.findMany({
            where: {
                companyId,
                ...(branchId ? { branchId } : {})
            },
            include: { supplier: true },
            orderBy: { invoiceDate: 'desc' }
        });
    }
    // Accounts Receivable List
    static async getAccountsReceivable(companyId, branchId) {
        return database_1.prisma.accountsReceivable.findMany({
            where: {
                companyId,
                ...(branchId ? { branchId } : {})
            },
            include: { guest: true, booking: true },
            orderBy: { invoiceDate: 'desc' }
        });
    }
    // ==========================================
    // ADVANCED ACCOUNTING ENGINE (PART 18)
    // ==========================================
    // Trial Balance (Verifies Double-Entry Equivalence Across All Accounts)
    static async getTrialBalance(companyId, params) {
        const asOf = params.asOfDate ? new Date(params.asOfDate) : new Date();
        const accounts = await database_1.prisma.chartOfAccount.findMany({
            where: {
                companyId,
                isActive: true,
                ...(params.branchId ? { OR: [{ branchId: params.branchId }, { branchId: null }] } : {})
            },
            orderBy: { code: 'asc' }
        });
        const journalLines = await database_1.prisma.journalEntryLine.findMany({
            where: {
                journalEntry: {
                    companyId,
                    status: 'POSTED',
                    date: { lte: asOf },
                    ...(params.branchId ? { branchId: params.branchId } : {})
                }
            }
        });
        // Aggregate debits & credits per account
        const debitMap = {};
        const creditMap = {};
        for (const line of journalLines) {
            debitMap[line.accountId] = (debitMap[line.accountId] || 0) + Number(line.debit);
            creditMap[line.accountId] = (creditMap[line.accountId] || 0) + Number(line.credit);
        }
        let totalDebitSum = 0;
        let totalCreditSum = 0;
        const rows = accounts.map((acc) => {
            const totalDebits = debitMap[acc.id] || 0;
            const totalCredits = creditMap[acc.id] || 0;
            // Determine net closing debit or credit balance
            let closingDebit = 0;
            let closingCredit = 0;
            if (['ASSET', 'EXPENSE'].includes(acc.type)) {
                const net = totalDebits - totalCredits;
                if (net >= 0)
                    closingDebit = net;
                else
                    closingCredit = Math.abs(net);
            }
            else {
                // LIABILITY, EQUITY, REVENUE (Credit Normal)
                const net = totalCredits - totalDebits;
                if (net >= 0)
                    closingCredit = net;
                else
                    closingDebit = Math.abs(net);
            }
            totalDebitSum += closingDebit;
            totalCreditSum += closingCredit;
            return {
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                type: acc.type,
                subType: acc.subType,
                totalDebits,
                totalCredits,
                closingDebit,
                closingCredit
            };
        });
        const isBalanced = Math.abs(totalDebitSum - totalCreditSum) < 0.01;
        return {
            asOfDate: asOf,
            isBalanced,
            totalDebit: Number(totalDebitSum.toFixed(2)),
            totalCredit: Number(totalCreditSum.toFixed(2)),
            variance: Number((totalDebitSum - totalCreditSum).toFixed(2)),
            accounts: rows
        };
    }
    // Balance Sheet (Assets = Liabilities + Equity)
    static async getBalanceSheet(companyId, params) {
        const asOf = params.asOfDate ? new Date(params.asOfDate) : new Date();
        const pnl = await this.getProfitAndLoss(companyId, {
            branchId: params.branchId,
            endDate: asOf.toISOString()
        });
        const accounts = await database_1.prisma.chartOfAccount.findMany({
            where: {
                companyId,
                isActive: true,
                type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
                ...(params.branchId ? { OR: [{ branchId: params.branchId }, { branchId: null }] } : {})
            },
            orderBy: { code: 'asc' }
        });
        const journalLines = await database_1.prisma.journalEntryLine.findMany({
            where: {
                journalEntry: {
                    companyId,
                    status: 'POSTED',
                    date: { lte: asOf },
                    ...(params.branchId ? { branchId: params.branchId } : {})
                }
            }
        });
        const debitMap = {};
        const creditMap = {};
        for (const line of journalLines) {
            debitMap[line.accountId] = (debitMap[line.accountId] || 0) + Number(line.debit);
            creditMap[line.accountId] = (creditMap[line.accountId] || 0) + Number(line.credit);
        }
        const currentAssets = [];
        const nonCurrentAssets = [];
        const currentLiabilities = [];
        const longTermLiabilities = [];
        const equityItems = [];
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        for (const acc of accounts) {
            const d = debitMap[acc.id] || 0;
            const c = creditMap[acc.id] || 0;
            if (acc.type === 'ASSET') {
                const netAsset = d - c;
                if (netAsset !== 0) {
                    totalAssets += netAsset;
                    const item = { code: acc.code, name: acc.name, amount: netAsset };
                    if (acc.subType === 'FIXED_ASSET')
                        nonCurrentAssets.push(item);
                    else
                        currentAssets.push(item);
                }
            }
            else if (acc.type === 'LIABILITY') {
                const netLiab = c - d;
                if (netLiab !== 0) {
                    totalLiabilities += netLiab;
                    const item = { code: acc.code, name: acc.name, amount: netLiab };
                    if (acc.subType === 'LONG_TERM_LIABILITY')
                        longTermLiabilities.push(item);
                    else
                        currentLiabilities.push(item);
                }
            }
            else if (acc.type === 'EQUITY') {
                const netEq = c - d;
                if (netEq !== 0) {
                    totalEquity += netEq;
                    equityItems.push({ code: acc.code, name: acc.name, amount: netEq });
                }
            }
        }
        // Add Net Period Income to Retained Equity
        const retainedEarnings = pnl.netIncome;
        totalEquity += retainedEarnings;
        equityItems.push({ code: '3020', name: 'Net Period Earnings (Retained)', amount: retainedEarnings });
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
        const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;
        return {
            asOfDate: asOf,
            isBalanced,
            assets: {
                currentAssets,
                nonCurrentAssets,
                totalAssets: Number(totalAssets.toFixed(2))
            },
            liabilities: {
                currentLiabilities,
                longTermLiabilities,
                totalLiabilities: Number(totalLiabilities.toFixed(2))
            },
            equity: {
                items: equityItems,
                totalEquity: Number(totalEquity.toFixed(2))
            },
            totalLiabilitiesAndEquity: Number(totalLiabilitiesAndEquity.toFixed(2))
        };
    }
    // Tax / GST Breakdown (Output GST Collected vs Input GST Tax Credits)
    static async getTaxBreakupReport(companyId, params) {
        const start = params.startDate ? new Date(params.startDate) : new Date(new Date().getFullYear(), 0, 1);
        const end = params.endDate ? new Date(params.endDate) : new Date();
        const [taxPayableAccount, inputTaxCreditAccount] = await Promise.all([
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '2020' } }),
            database_1.prisma.chartOfAccount.findFirst({ where: { companyId, code: '1040' } })
        ]);
        const targetAccountIds = [taxPayableAccount?.id, inputTaxCreditAccount?.id].filter(Boolean);
        const taxLines = await database_1.prisma.journalEntryLine.findMany({
            where: {
                accountId: { in: targetAccountIds },
                journalEntry: {
                    companyId,
                    status: 'POSTED',
                    date: { gte: start, lte: end },
                    ...(params.branchId ? { branchId: params.branchId } : {})
                }
            },
            include: {
                journalEntry: true,
                account: true
            },
            orderBy: { journalEntry: { date: 'asc' } }
        });
        let outputTaxCollected = 0; // Tax collected from customers (Sales / Room billing)
        let inputTaxCredit = 0; // Tax paid to suppliers on purchases
        const entries = taxLines.map((l) => {
            const creditAmt = Number(l.credit);
            const debitAmt = Number(l.debit);
            if (l.account.code === '2020') {
                outputTaxCollected += creditAmt - debitAmt;
            }
            else if (l.account.code === '1040') {
                inputTaxCredit += debitAmt - creditAmt;
            }
            return {
                date: l.journalEntry.date,
                entryNumber: l.journalEntry.entryNumber,
                referenceType: l.journalEntry.referenceType,
                accountCode: l.account.code,
                accountName: l.account.name,
                narration: l.narration || l.journalEntry.narration,
                taxCollected: creditAmt,
                taxPaid: debitAmt
            };
        });
        const netTaxPayable = outputTaxCollected - inputTaxCredit;
        return {
            period: { startDate: start, endDate: end },
            outputTaxCollected: Number(outputTaxCollected.toFixed(2)),
            inputTaxCredit: Number(inputTaxCredit.toFixed(2)),
            netTaxPayable: Number(netTaxPayable.toFixed(2)),
            taxEntries: entries
        };
    }
    // Cash & Bank Reconciliation
    static async getBankCashReconciliation(companyId, params) {
        const cashFlow = await this.getCashFlow(companyId, params);
        const trialBalance = await this.getTrialBalance(companyId, { branchId: params.branchId });
        const cashAccount = trialBalance.accounts.find((a) => a.code === '1010');
        const bankAccount = trialBalance.accounts.find((a) => a.code === '1020');
        return {
            period: cashFlow.period,
            cashDrawerBalance: cashAccount?.closingDebit || 0,
            bankAccountBalance: bankAccount?.closingDebit || 0,
            totalLiquidFunds: (cashAccount?.closingDebit || 0) + (bankAccount?.closingDebit || 0),
            periodInflows: cashFlow.totalInflow,
            periodOutflows: cashFlow.totalOutflow,
            netChange: cashFlow.netCashFlow,
            recentCashTransactions: cashFlow.transactions.slice(0, 25)
        };
    }
}
exports.AccountingService = AccountingService;
