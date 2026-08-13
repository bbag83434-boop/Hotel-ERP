import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Filter,
  Receipt,
  ShoppingCart,
  Percent,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { approvalApi } from '../../api/approval.api';
import { ApprovalRequest, ApprovalStatus, ApprovalType } from '../../types/approval.types';
import { formatINR, formatDateTimeIN } from '../../utils/formatters';

export const ApprovalCenterPage: React.FC = () => {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('PENDING');
  const [typeFilter, setTypeFilter] = useState<ApprovalType | 'ALL'>('ALL');

  // Action Modal State
  const [activeRequest, setActiveRequest] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [comment, setComment] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await approvalApi.getRequests({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        transactionType: typeFilter === 'ALL' ? undefined : typeFilter
      });
      setRequests(data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load approval requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter, typeFilter]);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest || !actionType) return;

    try {
      setLoading(true);
      await approvalApi.actOnRequest(activeRequest.id, {
        action: actionType,
        comment: comment || undefined
      });
      showToast(`Request #${activeRequest.requestNumber} ${actionType.toLowerCase()} successfully!`);
      setActiveRequest(null);
      setActionType(null);
      setComment('');
      loadRequests();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || `Failed to ${actionType.toLowerCase()} request`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 md:pb-8">
      {/* Top Banner */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-900/20 text-slate-950 font-bold">
              <ShieldCheck className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Approval Center
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                  Section 13 Real Engine
                </span>
              </h1>
              <p className="text-xs text-slate-400">Unified governance & multi-step transaction authorization across all modules</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadRequests}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" /> Filter Status:
          </div>
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-slate-950 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-800"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="PURCHASE_REQUEST">Purchase Requests</option>
              <option value="PURCHASE_ORDER">Purchase Orders</option>
              <option value="EXPENSE">Operating Expenses</option>
              <option value="DISCOUNT">POS Discounts</option>
              <option value="REFUND">Refunds</option>
              <option value="SALARY_CHANGE">Salary Changes</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 space-y-4">
        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/80 border border-rose-800/80 text-rose-200 rounded-lg text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 font-bold ml-3">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 rounded-lg text-sm flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 font-bold ml-3">✕</button>
          </div>
        )}

        {/* Requests List */}
        <div className="space-y-3">
          {requests.length === 0 && !loading && (
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
              <h3 className="font-bold text-white text-base">Inbox Clear</h3>
              <p className="text-xs">No approval requests currently matching the selected filter.</p>
            </div>
          )}

          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
                    {req.transactionType === 'PURCHASE_REQUEST' && <ShoppingCart className="w-4 h-4 text-sky-400" />}
                    {req.transactionType === 'EXPENSE' && <Receipt className="w-4 h-4 text-rose-400" />}
                    {req.transactionType === 'DISCOUNT' && <Percent className="w-4 h-4 text-amber-400" />}
                    {!['PURCHASE_REQUEST', 'EXPENSE', 'DISCOUNT'].includes(req.transactionType) && (
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm">{req.title}</span>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-slate-300">{req.requestNumber}</span>
                      <span>•</span>
                      <span>Requested by: {req.requestedBy?.firstName} {req.requestedBy?.lastName}</span>
                      <span>•</span>
                      <span>{formatDateTimeIN(req.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {req.amount && (
                    <span className="font-mono font-bold text-sm text-emerald-400 px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
                      {formatINR(req.amount)}
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                      req.status === 'PENDING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : req.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>

              {req.description && (
                <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                  {req.description}
                </p>
              )}

              {/* Action History Trail */}
              {req.actions && req.actions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Audit Trail</span>
                  {req.actions.map((act) => (
                    <div
                      key={act.id}
                      className="text-xs text-slate-400 flex items-center justify-between bg-slate-950/60 p-2 rounded border border-slate-800/60"
                    >
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-slate-500" />
                        <span className="font-semibold text-slate-300">{act.user?.firstName} ({act.userRole})</span>:
                        <span className="italic">{act.comment || 'No comment recorded'}</span>
                      </div>
                      <span className={`font-bold text-[10px] ${act.action === 'APPROVED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {act.action}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Approval Actions Buttons */}
              {req.status === 'PENDING' && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setActiveRequest(req);
                      setActionType('REJECTED');
                    }}
                    className="px-3.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 font-semibold text-xs rounded-lg transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => {
                      setActiveRequest(req);
                      setActionType('APPROVED');
                    }}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg shadow-md transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ACTION MODAL */}
      {activeRequest && actionType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {actionType === 'APPROVED' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400" />
              )}
              {actionType === 'APPROVED' ? 'Authorize Request' : 'Reject Request'}
            </h3>
            <p className="text-xs text-slate-400">
              {activeRequest.title} ({activeRequest.requestNumber})
            </p>

            <form onSubmit={handleExecuteAction} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Audit Comment (Optional / Reason)
                </label>
                <textarea
                  rows={3}
                  placeholder={`Reason for ${actionType.toLowerCase()}...`}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRequest(null);
                    setActionType(null);
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 text-xs rounded-lg font-bold transition ${
                    actionType === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  Confirm {actionType === 'APPROVED' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
