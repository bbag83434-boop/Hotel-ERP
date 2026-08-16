import React, { useState, useEffect } from 'react';
import {
  FileText,
  Filter,
  RefreshCw,
  Search,
  Download,
  Eye,
  X,
  Code2
} from 'lucide-react';
import { auditApi } from '../../api/audit.api';
import {
  AuditLogEntry,
  ComplianceSummary,
  AuditModule
} from '../../types/audit.types';
import { formatDateTimeIN } from '../../utils/formatters';

export const AuditCompliancePage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'STOCK' | 'PURCHASE' | 'BILLING' | 'APPROVAL' | 'SECURITY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      let moduleParam: AuditModule | undefined;
      let entityParam: string | undefined;
      let actionParam: string | undefined;

      if (activeCategory === 'STOCK') {
        moduleParam = 'INVENTORY';
      } else if (activeCategory === 'PURCHASE') {
        moduleParam = 'PURCHASING';
      } else if (activeCategory === 'BILLING') {
        moduleParam = 'RESTAURANT';
      } else if (activeCategory === 'APPROVAL') {
        moduleParam = 'APPROVAL';
      } else if (activeCategory === 'SECURITY') {
        moduleParam = 'SECURITY';
      }

      const [logRes, sumRes] = await Promise.all([
        auditApi.getLogs({
          page,
          limit: 30,
          module: moduleParam,
          entity: entityParam,
          action: actionParam,
          search: searchQuery || undefined
        }),
        auditApi.getSummary().catch(() => null)
      ]);

      setLogs(logRes.logs);
      setTotalCount(logRes.total);
      setTotalPages(logRes.totalPages || 1);
      setSummary(sumRes);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load audit and compliance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, activeCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const data = await auditApi.exportDossier();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compliance-audit-dossier-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg('Failed to export compliance dossier');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('VOID') || action.includes('REJECT') || action.includes('REFUND')) {
      return 'bg-[#e5544d]/20 text-[#e5544d] border-[#e5544d]/30';
    }
    if (action.includes('CREATE') || action.includes('APPROVE') || action.includes('OPEN') || action.includes('POSTED')) {
      return 'bg-[#3fbf6f]/20 text-[#3fbf6f] border-[#3fbf6f]/30';
    }
    if (action.includes('UPDATE') || action.includes('ADJUST') || action.includes('CHANGE') || action.includes('MOVEMENT')) {
      return 'bg-[#d4a437]/20 text-[#d4a437] border-[#d4a437]/30';
    }
    return 'bg-neutral-800 text-neutral-300 border-white/[0.08]';
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-neutral-100 pb-20 md:pb-8 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d4a437]/10 border border-[#d4a437]/20 rounded-2xl text-[#d4a437] font-bold">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Audit & Regulatory Compliance
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold border border-[#d4a437]/30">
                  PART 21
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                Immutable forensic activity ledger, state snapshot diffs, and security authorization logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.08] font-semibold text-xs rounded-xl transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              Export Dossier (JSON)
            </button>
          </div>
        </div>

        {/* Compliance Risk KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.06]">
          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Forensic Logs</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {summary?.totalEvents ?? totalCount}
            </div>
            <span className="text-[10px] text-neutral-500">Immutable ledger entries</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Financial & Refunds</span>
            <div className="text-lg font-bold font-mono text-[#e5544d] mt-1">
              {summary?.highRiskBreakdown.refundEvents ?? 0}
            </div>
            <span className="text-[10px] text-neutral-500">Refunds & Discounts</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Stock Adjustments</span>
            <div className="text-lg font-bold font-mono text-[#d4a437] mt-1">
              {summary?.highRiskBreakdown.stockEvents ?? 0}
            </div>
            <span className="text-[10px] text-neutral-500">Shrinkage & Counts</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-[#d4a437]/30">
            <span className="text-[10px] text-[#d4a437] uppercase font-bold">Security & Roles</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {summary?.highRiskBreakdown.securityEvents ?? 0}
            </div>
            <span className="text-[10px] text-neutral-400">Access changes & Logins</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-[#e5544d]/10 border border-[#e5544d]/20 text-[#e5544d] rounded-2xl text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-neutral-400 hover:text-white ml-3"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filter Chips & Search Bar */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick Categories */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setActiveCategory('ALL'); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeCategory === 'ALL'
                  ? 'bg-[#d4a437] text-black shadow-md'
                  : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => { setActiveCategory('STOCK'); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeCategory === 'STOCK'
                  ? 'bg-[#d4a437] text-black shadow-md'
                  : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'
              }`}
            >
              Stock & Inventory
            </button>
            <button
              onClick={() => { setActiveCategory('PURCHASE'); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeCategory === 'PURCHASE'
                  ? 'bg-[#d4a437] text-black shadow-md'
                  : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'
              }`}
            >
              Purchases & GRN
            </button>
            <button
              onClick={() => { setActiveCategory('BILLING'); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeCategory === 'BILLING'
                  ? 'bg-[#d4a437] text-black shadow-md'
                  : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'
              }`}
            >
              Billing & Refunds
            </button>
            <button
              onClick={() => { setActiveCategory('APPROVAL'); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeCategory === 'APPROVAL'
                  ? 'bg-[#d4a437] text-black shadow-md'
                  : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'
              }`}
            >
              Approval Decisions
            </button>
            <button
              onClick={() => { setActiveCategory('SECURITY'); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                activeCategory === 'SECURITY'
                  ? 'bg-[#d4a437] text-black shadow-md'
                  : 'bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08]'
              }`}
            >
              Security & Access
            </button>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search action, entity, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0c0c0e] text-white text-xs pl-8 pr-3 py-1.5 rounded-xl border border-white/[0.08] focus:border-[#d4a437] outline-none w-48 sm:w-64"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold rounded-xl text-neutral-200"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Audit Log Stream Table */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#d4a437]" />
            <h3 className="text-base font-bold text-white">Forensic Audit Activity Ledger</h3>
          </div>
          <span className="text-xs text-neutral-400">
            Showing {logs.length} of {totalCount} records (Page {page} of {totalPages})
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-white/[0.03] text-[10px] uppercase text-neutral-400 border-b border-white/[0.08]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor / User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity & Record Ref</th>
                <th className="px-4 py-3">Reason / Context</th>
                <th className="px-4 py-3 text-center">Snapshot Diff</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500 italic">
                    No audit records found.
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const hasDiff = log.details?.oldValue && log.details?.newValue;
                const reason = log.details?.reason || log.details?.notes || '-';
                return (
                  <tr
                    key={log.id}
                    className="hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 font-mono text-neutral-400 whitespace-nowrap">
                      {formatDateTimeIN(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System / Automated'}
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {log.user?.role?.name || 'Automated Hook'} • {log.ipAddress || 'Internal'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-neutral-200">{log.entity}</span>
                      {log.entityId && (
                        <p className="text-[10px] font-mono text-neutral-500 mt-0.5 truncate max-w-[140px]">
                          #{log.entityId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 max-w-[200px] truncate">
                      {reason}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasDiff ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#d4a437]/20 text-[#d4a437] text-[10px] font-bold">
                          {log.details?.changedKeys?.length || 1} field(s) changed
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-600">Event Snapshot</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.04]"
                      >
                        <Eye className="w-4 h-4 text-[#d4a437]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs text-neutral-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 rounded-xl text-white font-semibold transition"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 rounded-xl text-white font-semibold transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: FORENSIC SNAPSHOT DIFF INSPECTOR */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#d4a437]" />
                <div>
                  <h3 className="text-base font-bold text-white">Forensic Snapshot & State Diff Inspector</h3>
                  <p className="text-[11px] text-neutral-400 font-mono">Log ID: {selectedLog.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)}>
                <X className="w-5 h-5 text-neutral-400 hover:text-white" />
              </button>
            </div>

            {/* Event Metadata Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06] text-xs">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase">Action Type</span>
                <p className="font-bold text-white">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase">Actor Identity</span>
                <p className="font-semibold text-[#d4a437]">
                  {selectedLog.user ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : 'System'}
                </p>
                <span className="text-[10px] text-neutral-400">{selectedLog.user?.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase">Entity Target</span>
                <p className="font-semibold text-white">{selectedLog.entity}</p>
                <span className="text-[10px] font-mono text-neutral-400">#{selectedLog.entityId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase">Timestamp & IP</span>
                <p className="font-mono text-white text-[11px]">{formatDateTimeIN(selectedLog.createdAt)}</p>
                <span className="text-[10px] text-neutral-400 font-mono">{selectedLog.ipAddress || 'Internal'}</span>
              </div>
            </div>

            {/* Reason Justification */}
            {selectedLog.details?.reason && (
              <div className="p-3 bg-[#d4a437]/10 border border-[#d4a437]/20 rounded-xl text-xs">
                <span className="text-[10px] uppercase font-bold text-[#d4a437] block">Stated Reason / Justification:</span>
                <p className="text-white mt-0.5">{selectedLog.details.reason}</p>
              </div>
            )}

            {/* Side-by-Side Diff or Raw Payload Inspector */}
            {selectedLog.details?.oldValue && selectedLog.details?.newValue ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300">State Transition Diff</span>
                  {selectedLog.details.changedKeys && (
                    <span className="text-[10px] text-[#d4a437] font-semibold">
                      Modified Attributes: {selectedLog.details.changedKeys.join(', ')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Previous State */}
                  <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-red-500/20 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-[#e5544d] block pb-1 border-b border-red-500/20">
                      Previous State (Old Snapshot)
                    </span>
                    <pre className="text-[11px] font-mono text-neutral-300 whitespace-pre-wrap overflow-x-auto max-h-60">
                      {JSON.stringify(selectedLog.details.oldValue, null, 2)}
                    </pre>
                  </div>

                  {/* New State */}
                  <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-emerald-500/20 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-[#3fbf6f] block pb-1 border-b border-emerald-500/20">
                      New State (Applied Snapshot)
                    </span>
                    <pre className="text-[11px] font-mono text-neutral-300 whitespace-pre-wrap overflow-x-auto max-h-60">
                      {JSON.stringify(selectedLog.details.newValue, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06] space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block pb-1 border-b border-white/[0.06]">
                  Event Payload & Context Details
                </span>
                <pre className="text-[11px] font-mono text-[#d4a437] whitespace-pre-wrap overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs rounded-xl font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditCompliancePage;
