/**
 * APEX ERP — Frontend Core Types & Interfaces (Greenfield Architecture)
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

export interface Outlet {
  id: string;
  code: string;
  name: string;
  type: BranchType;
  isActive: boolean;
}

export interface SystemHealthData {
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
  };
  features: {
    multiOutletScope: boolean;
    centralPurchaseControl: boolean;
    linkedTransactions: boolean;
    biMonthlyClosing: boolean;
    aiAutomationReady: boolean;
  };
}

export interface ClosingPeriod {
  year: number;
  month: number;
  period: 'FIRST_HALF' | 'SECOND_HALF';
  startDate: string;
  endDate: string;
  label: string;
  daysRemaining: number;
}

export type SystemHealth = SystemHealthData;

export * from './user.types';

