/**
 * APEX ERP — Core Enterprise Types & Constants (Greenfield Architecture)
 * Unified Restaurant ERP + Central Kitchen + Multi-Outlet Operations
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'HQ_ADMIN'
  | 'CENTRAL_PURCHASE_MANAGER'
  | 'CENTRAL_STORE_MANAGER'
  | 'DESSERT_KITCHEN_HEAD'
  | 'OUTLET_MANAGER'
  | 'OUTLET_CASHIER'
  | 'KITCHEN_CHEF'
  | 'ACCOUNTANT'
  | 'AUDITOR';

export type BranchType =
  | 'HEAD_OFFICE'
  | 'CENTRAL_STORE'
  | 'DESSERT_KITCHEN'
  | 'RESTAURANT_OUTLET'
  | 'HOTEL'
  | 'HYBRID';

export interface OutletScope {
  outletId: string;
  outletCode: string;
  outletName: string;
  type: BranchType;
  isActive: boolean;
}

export type ClosingPeriod = 'FIRST_HALF' | 'SECOND_HALF'; // 1-15 or 16-month-end

export interface BiMonthlyPeriodInfo {
  year: number;
  month: number;
  period: ClosingPeriod;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g. "Aug 1 - Aug 15, 2026"
}

export type TransactionCategory =
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'SUPPLIER_INVOICE'
  | 'STOCK_MUTATION'
  | 'PRODUCTION_RUN'
  | 'POS_SALE'
  | 'OUTLET_CLOSING'
  | 'WASTAGE_ENTRY'
  | 'JOURNAL_ENTRY';

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  memoryUsage: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  database: {
    status: 'connected' | 'disconnected' | 'error';
    latencyMs?: number;
    message?: string;
  };
  features: {
    multiOutletScope: boolean;
    centralPurchaseControl: boolean;
    linkedTransactions: boolean;
    biMonthlyClosing: boolean;
    aiAutomationReady: boolean;
  };
}
