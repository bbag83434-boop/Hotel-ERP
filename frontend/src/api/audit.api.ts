import { apiClient } from './axios';
import {
  AuditLogEntry,
  PaginatedAuditLogs,
  ComplianceSummary,
  AuditLogFilters
} from '../types/audit.types';

export const auditApi = {
  // Summary Metrics & Risk KPIs
  getSummary: async (): Promise<ComplianceSummary> => {
    const res = await apiClient.get('/audit/summary');
    return res.data.data;
  },

  // Filterable Audit Stream
  getLogs: async (params?: AuditLogFilters): Promise<PaginatedAuditLogs> => {
    const res = await apiClient.get('/audit/logs', { params });
    return res.data.data;
  },

  // Record-Level Lifecycle History
  getEntityTrail: async (entity: string, entityId: string): Promise<AuditLogEntry[]> => {
    const res = await apiClient.get(`/audit/trail/${entity}/${entityId}`);
    return res.data.data;
  },

  // Export Compliance Dossier
  exportDossier: async (params?: AuditLogFilters): Promise<any[]> => {
    const res = await apiClient.get('/audit/export', { params });
    return res.data.data;
  }
};
