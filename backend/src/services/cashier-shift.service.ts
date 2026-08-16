import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/response.utils';
import { AuditService } from './audit.service';

export class CashierShiftService {
  // ==========================================
  // 1. GET ACTIVE SHIFT
  // ==========================================
  public static async getActiveSession(
    companyId: string,
    branchId?: string,
    userId?: string
  ) {
    const session = await prisma.cashSession.findFirst({
      where: {
        companyId,
        status: 'OPEN',
        ...(branchId ? { branchId } : {}),
        ...(userId ? { openedById: userId } : {})
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        movements: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { openedAt: 'desc' }
    });

    if (!session) return null;

    // Calculate real-time sales & cash drawer metrics during this open session
    const startTime = session.openedAt;
    const now = new Date();

    // Query payments settled during shift
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startTime, lte: now },
        status: 'SUCCESS',
        order: {
          companyId,
          ...(session.branchId ? { branchId: session.branchId } : {})
        }
      },
      include: {
        order: { select: { id: true, orderNumber: true, orderType: true, grandTotal: true } }
      }
    });

    let liveCashSales = new Prisma.Decimal(0);
    let liveCardSales = new Prisma.Decimal(0);
    let liveUpiSales = new Prisma.Decimal(0);
    let liveTotalSales = new Prisma.Decimal(0);

    for (const p of payments) {
      const amt = new Prisma.Decimal(p.amount);
      liveTotalSales = liveTotalSales.plus(amt);

      if (p.method === 'CASH') {
        liveCashSales = liveCashSales.plus(amt);
      } else if (p.method === 'CREDIT_CARD' || p.method === 'DEBIT_CARD') {
        liveCardSales = liveCardSales.plus(amt);
      } else if (p.method === 'MOBILE_BANKING') {
        liveUpiSales = liveUpiSales.plus(amt);
      }
    }

    // Movements during shift
    let cashInTotal = new Prisma.Decimal(0);
    let cashOutTotal = new Prisma.Decimal(0);
    let closingDropTotal = new Prisma.Decimal(0);

    for (const m of session.movements) {
      const amt = new Prisma.Decimal(m.amount);
      if (m.movementType === 'CASH_IN') {
        cashInTotal = cashInTotal.plus(amt);
      } else if (m.movementType === 'CASH_OUT') {
        cashOutTotal = cashOutTotal.plus(amt);
      } else if (m.movementType === 'CLOSING_DROP') {
        closingDropTotal = closingDropTotal.plus(amt);
      }
    }

    const openingFloat = new Prisma.Decimal(session.openingFloat || 0);
    const expectedDrawerCash = openingFloat
      .plus(liveCashSales)
      .plus(cashInTotal)
      .minus(cashOutTotal)
      .minus(closingDropTotal);

    return {
      ...session,
      liveMetrics: {
        ordersCount: payments.length,
        totalSales: liveTotalSales.toNumber(),
        cashSales: liveCashSales.toNumber(),
        cardSales: liveCardSales.toNumber(),
        upiSales: liveUpiSales.toNumber(),
        cashInTotal: cashInTotal.toNumber(),
        cashOutTotal: cashOutTotal.toNumber(),
        closingDropTotal: closingDropTotal.toNumber(),
        openingFloat: openingFloat.toNumber(),
        expectedDrawerCash: expectedDrawerCash.toNumber()
      },
      payments
    };
  }

  // ==========================================
  // 2. OPEN CASHIER SHIFT
  // ==========================================
  public static async openSession(
    companyId: string,
    branchId: string,
    userId: string,
    openingFloat: number = 0,
    notes?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Check if cashier or branch already has an active session
    const active = await prisma.cashSession.findFirst({
      where: {
        companyId,
        branchId,
        openedById: userId,
        status: 'OPEN'
      }
    });

    if (active) {
      throw new AppError(
        `Active cashier session #${active.sessionNumber} is already open for this terminal. Please close or reconcile it before opening a new shift.`,
        409
      );
    }

    return prisma.$transaction(async (tx) => {
      const sessionCount = await tx.cashSession.count({ where: { companyId } });
      const sessionNumber = `CS-${new Date().getFullYear()}-${String(sessionCount + 1).padStart(5, '0')}`;

      const floatDecimal = new Prisma.Decimal(openingFloat || 0);

      const session = await tx.cashSession.create({
        data: {
          companyId,
          branchId,
          sessionNumber,
          openedById: userId,
          status: 'OPEN',
          openingFloat: floatDecimal,
          notes,
          openedAt: new Date()
        },
        include: {
          openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          branch: { select: { id: true, name: true, code: true } }
        }
      });

      // Record initial Float Movement if float > 0
      if (floatDecimal.greaterThan(0)) {
        await tx.cashMovement.create({
          data: {
            sessionId: session.id,
            movementType: 'FLOAT_START',
            amount: floatDecimal,
            reason: 'Opening Float Tender',
            recordedById: userId
          }
        });
      }

      await AuditService.log({
        userId,
        action: 'CASHIER_SHIFT_OPENED',
        entity: 'CashSession',
        entityId: session.id,
        details: {
          sessionNumber,
          openingFloat: floatDecimal.toString(),
          branchId
        },
        ipAddress,
        userAgent
      });

      return session;
    });
  }

  // ==========================================
  // 3. RECORD CASH MOVEMENT (CASH IN / CASH OUT / SAFE DROP)
  // ==========================================
  public static async recordCashMovement(
    companyId: string,
    sessionId: string,
    userId: string,
    data: {
      movementType: 'CASH_IN' | 'CASH_OUT' | 'FLOAT_START' | 'CLOSING_DROP';
      amount: number;
      reason: string;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await prisma.cashSession.findFirst({
      where: { id: sessionId, companyId }
    });

    if (!session) {
      throw new AppError('Cashier session not found', 404);
    }

    if (session.status !== 'OPEN') {
      throw new AppError('Cannot record cash movement on a closed or reconciled session', 400);
    }

    const amountDecimal = new Prisma.Decimal(data.amount);
    if (amountDecimal.lessThanOrEqualTo(0)) {
      throw new AppError('Movement amount must be positive', 400);
    }

    const movement = await prisma.cashMovement.create({
      data: {
        sessionId,
        movementType: data.movementType,
        amount: amountDecimal,
        reason: data.reason,
        recordedById: userId
      }
    });

    await AuditService.log({
      userId,
      action: 'CASH_DRAWER_MOVEMENT',
      entity: 'CashMovement',
      entityId: movement.id,
      details: {
        sessionId,
        movementType: data.movementType,
        amount: amountDecimal.toString(),
        reason: data.reason
      },
      ipAddress,
      userAgent
    });

    return movement;
  }

  // ==========================================
  // 4. CLOSE SHIFT & COMPUTE VARIANCE
  // ==========================================
  public static async closeSession(
    companyId: string,
    sessionId: string,
    userId: string,
    data: {
      closingCash: number;
      notes?: string;
      varianceReason?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await prisma.cashSession.findFirst({
      where: { id: sessionId, companyId, status: 'OPEN' },
      include: {
        movements: true,
        branch: true
      }
    });

    if (!session) {
      throw new AppError('Active open cashier session not found', 404);
    }

    // 1. Calculate Realized Sales from Payments
    const startTime = session.openedAt;
    const endTime = new Date();

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startTime, lte: endTime },
        status: 'SUCCESS',
        order: {
          companyId,
          branchId: session.branchId
        }
      }
    });

    let totalCashSales = new Prisma.Decimal(0);
    let totalCardSales = new Prisma.Decimal(0);
    let totalUpiSales = new Prisma.Decimal(0);

    for (const p of payments) {
      const amt = new Prisma.Decimal(p.amount);
      if (p.method === 'CASH') {
        totalCashSales = totalCashSales.plus(amt);
      } else if (p.method === 'CREDIT_CARD' || p.method === 'DEBIT_CARD') {
        totalCardSales = totalCardSales.plus(amt);
      } else if (p.method === 'MOBILE_BANKING') {
        totalUpiSales = totalUpiSales.plus(amt);
      }
    }

    // 2. Sum Movements
    let cashIn = new Prisma.Decimal(0);
    let cashOut = new Prisma.Decimal(0);
    let closingDrop = new Prisma.Decimal(0);

    for (const m of session.movements) {
      const amt = new Prisma.Decimal(m.amount);
      if (m.movementType === 'CASH_IN') cashIn = cashIn.plus(amt);
      else if (m.movementType === 'CASH_OUT') cashOut = cashOut.plus(amt);
      else if (m.movementType === 'CLOSING_DROP') closingDrop = closingDrop.plus(amt);
    }

    const openingFloat = new Prisma.Decimal(session.openingFloat || 0);
    const expectedCash = openingFloat
      .plus(totalCashSales)
      .plus(cashIn)
      .minus(cashOut)
      .minus(closingDrop);

    const countedCash = new Prisma.Decimal(data.closingCash);
    const cashVariance = countedCash.minus(expectedCash);

    let finalNotes = data.notes || '';
    if (data.varianceReason && !cashVariance.isZero()) {
      finalNotes = finalNotes ? `${finalNotes} | Variance: ${data.varianceReason}` : `Variance Reason: ${data.varianceReason}`;
    }

    const updatedSession = await prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedById: userId,
        closedAt: endTime,
        closingCash: countedCash,
        expectedCash,
        cashVariance,
        totalCashSales,
        totalCardSales,
        totalUpiSales,
        notes: finalNotes || null
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        movements: true
      }
    });

    await AuditService.log({
      userId,
      action: 'CASHIER_SHIFT_CLOSED',
      entity: 'CashSession',
      entityId: sessionId,
      details: {
        sessionNumber: updatedSession.sessionNumber,
        countedCash: countedCash.toString(),
        expectedCash: expectedCash.toString(),
        cashVariance: cashVariance.toString(),
        totalSales: totalCashSales.plus(totalCardSales).plus(totalUpiSales).toString()
      },
      ipAddress,
      userAgent
    });

    return updatedSession;
  }

  // ==========================================
  // 5. RECONCILE SHIFT (MANAGER SIGN-OFF)
  // ==========================================
  public static async reconcileSession(
    companyId: string,
    sessionId: string,
    userId: string,
    notes?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const session = await prisma.cashSession.findFirst({
      where: { id: sessionId, companyId }
    });

    if (!session) {
      throw new AppError('Cashier session not found', 404);
    }

    if (session.status !== 'CLOSED') {
      throw new AppError('Only closed sessions can be reconciled', 400);
    }

    const updated = await prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        status: 'RECONCILED',
        notes: notes ? (session.notes ? `${session.notes} | Signoff: ${notes}` : `Signoff: ${notes}`) : session.notes
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true, code: true } }
      }
    });

    await AuditService.log({
      userId,
      action: 'CASHIER_SHIFT_RECONCILED',
      entity: 'CashSession',
      entityId: sessionId,
      details: {
        sessionNumber: session.sessionNumber,
        managerId: userId
      },
      ipAddress,
      userAgent
    });

    return updated;
  }

  // ==========================================
  // 6. SHIFT HISTORY & AUDIT LOGS
  // ==========================================
  public static async getSessionHistory(
    companyId: string,
    filters?: {
      branchId?: string;
      cashierId?: string;
      status?: 'OPEN' | 'CLOSED' | 'RECONCILED';
      startDate?: string;
      endDate?: string;
    }
  ) {
    const { branchId, cashierId, status, startDate, endDate } = filters || {};

    return prisma.cashSession.findMany({
      where: {
        companyId,
        ...(branchId ? { branchId } : {}),
        ...(cashierId ? { openedById: cashierId } : {}),
        ...(status ? { status } : {}),
        ...(startDate || endDate
          ? {
              openedAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {})
              }
            }
          : {})
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        movements: true
      },
      orderBy: { openedAt: 'desc' }
    });
  }

  // ==========================================
  // 7. GET SINGLE SHIFT SUMMARY
  // ==========================================
  public static async getSessionSummary(companyId: string, sessionId: string) {
    const session = await prisma.cashSession.findFirst({
      where: { id: sessionId, companyId },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true, code: true } },
        movements: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!session) throw new AppError('Cashier session not found', 404);

    const endTime = session.closedAt || new Date();

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: session.openedAt, lte: endTime },
        status: 'SUCCESS',
        order: {
          companyId,
          branchId: session.branchId
        }
      },
      include: {
        order: { select: { id: true, orderNumber: true, grandTotal: true, orderType: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return {
      session,
      payments
    };
  }
}
