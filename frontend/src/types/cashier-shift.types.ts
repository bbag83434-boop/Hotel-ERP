export type CashSessionStatus = 'OPEN' | 'CLOSED' | 'RECONCILED';

export type CashMovementType = 'CASH_IN' | 'CASH_OUT' | 'FLOAT_START' | 'CLOSING_DROP';

export interface CashMovement {
  id: string;
  sessionId: string;
  movementType: CashMovementType;
  amount: number | string;
  reason: string;
  recordedById?: string | null;
  createdAt: string;
}

export interface LiveShiftMetrics {
  ordersCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
  cashInTotal: number;
  cashOutTotal: number;
  closingDropTotal: number;
  openingFloat: number;
  expectedDrawerCash: number;
}

export interface CashSession {
  id: string;
  companyId: string;
  branchId: string;
  sessionNumber: string;
  openedById: string;
  closedById?: string | null;
  status: CashSessionStatus;
  openingFloat: number | string;
  closingCash?: number | string | null;
  expectedCash?: number | string | null;
  cashVariance?: number | string | null;
  totalCardSales: number | string;
  totalUpiSales: number | string;
  totalCashSales: number | string;
  notes?: string | null;
  openedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  openedBy?: { id: string; firstName: string; lastName: string; email?: string };
  closedBy?: { id: string; firstName: string; lastName: string; email?: string } | null;
  branch?: { id: string; name: string; code: string };
  movements?: CashMovement[];
  liveMetrics?: LiveShiftMetrics;
}

export interface OpenShiftPayload {
  branchId?: string;
  openingFloat: number;
  notes?: string;
}

export interface CashMovementPayload {
  sessionId: string;
  movementType: CashMovementType;
  amount: number;
  reason: string;
}

export interface CloseShiftPayload {
  sessionId: string;
  closingCash: number;
  notes?: string;
  varianceReason?: string;
}

export interface ReconcileShiftPayload {
  sessionId: string;
  notes?: string;
}
