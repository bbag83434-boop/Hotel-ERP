export type AuditModule =
  | 'INVENTORY'
  | 'PURCHASING'
  | 'PRODUCTION'
  | 'RESTAURANT'
  | 'HOTEL'
  | 'ACCOUNTING'
  | 'HR'
  | 'APPROVAL'
  | 'SECURITY'
  | 'SYSTEM';

export interface AuditLogDetails {
  module?: AuditModule;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  changedKeys?: string[];
  reason?: string | null;
  actor?: string;
  [key: string]: any;
}

export interface AuditLogEntry {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: AuditLogDetails | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: { name: string };
  } | null;
}

export interface PaginatedAuditLogs {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  logs: AuditLogEntry[];
}

export interface ComplianceSummary {
  totalEvents: number;
  todayEvents: number;
  activeAuditedUsers: number;
  highRiskBreakdown: {
    stockEvents: number;
    refundEvents: number;
    approvalEvents: number;
    securityEvents: number;
  };
  topActions: Array<{ action: string; count: number }>;
}

export interface AuditLogFilters {
  entity?: string;
  action?: string;
  userId?: string;
  module?: AuditModule;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}
