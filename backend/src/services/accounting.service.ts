import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';

export class AccountingService {
  // ==========================================
  // CHART OF ACCOUNTS
  // ==========================================

  public static async getAccounts(companyId: string, branchId?: string) {
    return prisma.chartOfAccount.findMany({
      where: {
        companyId,
        isActive: true,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {})
      },
      orderBy: { code: 'asc' }
    });
  }

  public static async getAccountByCode(companyId: string, code: string) {
    return prisma.chartOfAccount.findFirst({
      where: { companyId, code }
    });
  }

  public static async createAccount(
    companyId: string,
    data: {
      branchId?: string | null;
      code: string;
      name: string;
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
      subType: any;
      balance?: number;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await prisma.chartOfAccount.findFirst({
      where: { companyId, code: data.code }
    });
    if (existing) {
      throw new AppError(`Account with code ${data.code} already exists`, 409);
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        companyId,
        branchId: data.branchId || null,
        code: data.code,
        name: data.name,
        type: data.type,
        subType: data.subType,
        balance: new Prisma.Decimal(data.balance || 0)
      }
    });

    await AuditService.log({
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

  public static async createJournalEntry(
    companyId: string,
    data: {
      branchId?: string | null;
      date?: Date | string;
      referenceType: string;
      referenceId?: string;
      narration: string;
      lines: Array<{
        accountId: string;
        debit: number | Prisma.Decimal;
        credit: number | Prisma.Decimal;
        narration?: string;
      }>;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Validate Double-Entry Balance: sum(debit) MUST equal sum(credit)
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of data.lines) {
      const d = new Prisma.Decimal(line.debit || 0);
      const c = new Prisma.Decimal(line.credit || 0);
      totalDebit = totalDebit.plus(d);
      totalCredit = totalCredit.plus(c);
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new AppError(
        `Journal entry is unbalanced! Total Debit ($${totalDebit.toFixed(2)}) does not equal Total Credit ($${totalCredit.toFixed(2)})`,
        400
      );
    }

    if (totalDebit.isZero()) {
      throw new AppError('Journal entry amounts cannot be zero', 400);
    }

    return prisma.$transaction(async (tx) => {
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
              debit: new Prisma.Decimal(l.debit || 0),
              credit: new Prisma.Decimal(l.credit || 0),
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
        const debit = new Prisma.Decimal(line.debit || 0);
        const credit = new Prisma.Decimal(line.credit || 0);

        const account = await tx.chartOfAccount.findUnique({ where: { id: line.accountId } });
        if (!account) continue;

        let delta = new Prisma.Decimal(0);
        if (account.type === 'ASSET' || account.type === 'EXPENSE') {
          delta = debit.minus(credit);
        } else {
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

      await AuditService.log({
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
  public static async recordPosSaleJournal(params: {
    companyId: string;
    branchId: string;
    orderId: string;
    orderNumber: string;
    grandTotal: number | Prisma.Decimal;
    taxAmount: number | Prisma.Decimal;
    totalCogs: number | Prisma.Decimal;
    paymentMethod: string;
    actorId?: string;
  }) {
    const { companyId, branchId, orderId, orderNumber, grandTotal, taxAmount, totalCogs, paymentMethod, actorId } = params;

    // Accounts: 1010 (Cash) / 1020 (Bank Card), 4010 (F&B Revenue), 2020 (Tax Payable), 5010 (COGS), 1300 (Inventory Asset)
    const [cashAcc, bankAcc, revAcc, taxAcc, cogsAcc, invAcc] = await Promise.all([
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '1010' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '1020' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '4010' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '2020' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '5010' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '1300' } })
    ]);

    if (!revAcc) return null;

    const debitAcc = paymentMethod === 'CASH' ? (cashAcc || revAcc) : (bankAcc || cashAcc || revAcc);
    const total = new Prisma.Decimal(grandTotal);
    const tax = new Prisma.Decimal(taxAmount || 0);
    const netRevenue = total.minus(tax);

    const lines: any[] = [
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
    const cogs = new Prisma.Decimal(totalCogs || 0);
    if (cogs.greaterThan(0) && cogsAcc && invAcc) {
      lines.push(
        {
          accountId: cogsAcc.id,
          debit: cogs,
          credit: 0,
          narration: `Cost of Goods Sold (Recipe BOM) for Order #${orderNumber}`
        },
        {
          accountId: invAcc.id,
          debit: 0,
          credit: cogs,
          narration: `Inventory raw materials consumed for Order #${orderNumber}`
        }
      );
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
  public static async recordPurchaseGrnJournal(params: {
    companyId: string;
    branchId?: string | null;
    supplierId: string;
    grnId: string;
    grnNumber: string;
    totalAmount: number | Prisma.Decimal;
    actorId?: string;
  }) {
    const { companyId, branchId, supplierId, grnId, grnNumber, totalAmount, actorId } = params;

    const [invAcc, apAcc] = await Promise.all([
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '1300' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '2010' } })
    ]);

    if (!invAcc || !apAcc) return null;

    const total = new Prisma.Decimal(totalAmount);

    // Create AccountsPayable Record
    await prisma.accountsPayable.create({
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
  public static async recordHotelFolioJournal(params: {
    companyId: string;
    branchId: string;
    bookingId: string;
    bookingNumber: string;
    totalAmount: number | Prisma.Decimal;
    roomRevenueAmount: number | Prisma.Decimal;
    taxAmount: number | Prisma.Decimal;
    paymentMethod: string;
    actorId?: string;
  }) {
    const { companyId, branchId, bookingId, bookingNumber, totalAmount, roomRevenueAmount, taxAmount, paymentMethod, actorId } = params;

    const [cashAcc, bankAcc, roomRevAcc, otherRevAcc, taxAcc] = await Promise.all([
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '1010' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '1020' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '4020' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '4010' } }),
      prisma.chartOfAccount.findFirst({ where: { companyId, code: '2020' } })
    ]);

    if (!roomRevAcc) return null;

    const total = new Prisma.Decimal(totalAmount);
    const roomRev = new Prisma.Decimal(roomRevenueAmount);
    const tax = new Prisma.Decimal(taxAmount || 0);
    const extraCharges = total.minus(roomRev).minus(tax);
    const debitAcc = paymentMethod === 'CASH' ? (cashAcc || roomRevAcc) : (bankAcc || cashAcc || roomRevAcc);

    const lines: any[] = [
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
        accountId: (otherRevAcc || roomRevAcc)!.id,
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

  public static async createExpense(
    companyId: string,
    data: {
      branchId?: string | null;
      category: string;
      expenseAccountId: string;
      paidFromAccountId: string;
      amount: number;
      taxAmount?: number;
      paymentMethod?: any;
      paidTo: string;
      date?: string;
      receiptUrl?: string;
      notes?: string;
    },
    actorId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return prisma.$transaction(async (tx) => {
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
          amount: new Prisma.Decimal(data.amount),
          taxAmount: new Prisma.Decimal(data.taxAmount || 0),
          paymentMethod: data.paymentMethod || 'CASH',
          paidTo: data.paidTo,
          date: data.date ? new Date(data.date) : new Date(),
          receiptUrl: data.receiptUrl,
          notes: data.notes,
          createdById: actorId || null
        }
      });

      // Post Balanced Double-Entry Journal
      const totalAmount = new Prisma.Decimal(data.amount);
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
                credit: new Prisma.Decimal(0),
                narration: `Expense: ${data.category} (${data.notes || ''})`
              },
              {
                accountId: data.paidFromAccountId,
                debit: new Prisma.Decimal(0),
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

      await AuditService.log({
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
  public static async getProfitAndLoss(companyId: string, params: { branchId?: string; startDate?: string; endDate?: string }) {
    const start = params.startDate ? new Date(params.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = params.endDate ? new Date(params.endDate) : new Date();

    const journalLines = await prisma.journalEntryLine.findMany({
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

    const revenueMap: Record<string, { code: string; name: string; amount: number }> = {};
    const cogsMap: Record<string, { code: string; name: string; amount: number }> = {};
    const expenseMap: Record<string, { code: string; name: string; amount: number }> = {};

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
      } else if (acc.subType === 'COST_OF_GOODS_SOLD') {
        if (!cogsMap[acc.code]) {
          cogsMap[acc.code] = { code: acc.code, name: acc.name, amount: 0 };
        }
        cogsMap[acc.code].amount += netDebit;
        totalCogs += netDebit;
      } else if (acc.type === 'EXPENSE') {
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
  public static async getCashFlow(companyId: string, params: { branchId?: string; startDate?: string; endDate?: string }) {
    const start = params.startDate ? new Date(params.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = params.endDate ? new Date(params.endDate) : new Date();

    const cashAccounts = await prisma.chartOfAccount.findMany({
      where: {
        companyId,
        type: 'ASSET',
        subType: 'CURRENT_ASSET',
        code: { in: ['1010', '1020'] }
      }
    });
    const cashAccountIds = cashAccounts.map((a) => a.id);

    const cashLines = await prisma.journalEntryLine.findMany({
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
  public static async getGeneralLedger(
    companyId: string,
    params: { accountId?: string; branchId?: string; startDate?: string; endDate?: string }
  ) {
    return prisma.journalEntry.findMany({
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
  public static async getAccountsPayable(companyId: string, branchId?: string) {
    return prisma.accountsPayable.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {})
      },
      include: { supplier: true },
      orderBy: { invoiceDate: 'desc' }
    });
  }

  // Accounts Receivable List
  public static async getAccountsReceivable(companyId: string, branchId?: string) {
    return prisma.accountsReceivable.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {})
      },
      include: { guest: true, booking: true },
      orderBy: { invoiceDate: 'desc' }
    });
  }
}
