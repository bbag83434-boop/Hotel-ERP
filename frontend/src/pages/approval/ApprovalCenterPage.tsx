import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Check,
  AlertCircle,
  FileText,
  Sliders
} from 'lucide-react';
import { approvalApi } from '../../api/approval.api';
import {
  ApprovalRequest,
  ApprovalRule,
  ApprovalStatus,
  ApprovalType,
  ApprovalSummary
} from '../../types/approval.types';
import { formatINR, formatDateTimeIN } from '../../utils/formatters';

export const ApprovalCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'HISTORY' | 'RULES'>('QUEUE');
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('PENDING');
  const [typeFilter, setTypeFilter] = useState<ApprovalType | 'ALL'>('ALL');

  // Action Modal State (Approve / Reject)
  const [activeRequest, setActiveRequest] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [comment, setComment] = useState('');

  // Create Rule Modal State
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [newRuleType, setNewRuleType] = useState<ApprovalType>('EXPENSE');
  const [newRuleMinAmount, setNewRuleMinAmount] = useState<number>(5000);
  const [newRuleRole, setNewRuleRole] = useState('BRANCH_MANAGER');
  const [newRuleStep, setNewRuleStep] = useState<number>(1);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [reqData, rulesData, sumData] = await Promise.all([
        approvalApi.getRequests({
          status: activeTab === 'QUEUE' ? 'PENDING' : statusFilter === 'ALL' ? undefined : statusFilter,
          transactionType: typeFilter === 'ALL' ? undefined : typeFilter
        }).catch(() => []),
        approvalApi.getRules().catch(() => []),
        approvalApi.getSummary().catch(() => null)
      ]);
      setRequests(reqData);
      setRules(rulesData);
      setSummary(sumData);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load approval center data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, statusFilter, typeFilter]);

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
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || `Failed to ${actionType.toLowerCase()} request`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await approvalApi.createRule({
        transactionType: newRuleType,
        minAmount: Number(newRuleMinAmount),
        requiredRole: newRuleRole,
        stepNumber: Number(newRuleStep)
      });
      setShowCreateRuleModal(false);
      showToast(`New approval rule created for ${newRuleType}`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create approval rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this approval rule?')) return;
    try {
      setLoading(true);
      await approvalApi.deleteRule(ruleId);
      showToast('Approval rule removed successfully.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete approval rule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRuleActive = async (rule: ApprovalRule) => {
    try {
      setLoading(true);
      await approvalApi.updateRule(rule.id, { isActive: !rule.isActive });
      showToast(`Rule ${!rule.isActive ? 'activated' : 'deactivated'}.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update rule status');
    } finally {
      setLoading(false);
    }
  };

  const formatTypeLabel = (type: ApprovalType) => {
    return type.replace(/_/g, ' ');
  };

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-neutral-100 pb-20 md:pb-8 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d4a437]/10 border border-[#d4a437]/20 rounded-2xl text-[#d4a437] font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Approval Center & Governance
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#d4a437]/20 text-[#d4a437] font-bold border border-[#d4a437]/30">
                  PART 20
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                Multi-tier transactional authorization, threshold rule matrices, and immutable audit logs
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
              onClick={() => setShowCreateRuleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              Configure Rule
            </button>
          </div>
        </div>

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.06]">
          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Pending Authorizations</span>
            <div className="text-lg font-bold font-mono text-[#e5a33d] mt-1">
              {summary?.pendingCount ?? requests.filter((r) => r.status === 'PENDING').length}
            </div>
            <span className="text-[10px] text-neutral-500">Requires review</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Approved Transactions</span>
            <div className="text-lg font-bold font-mono text-[#3fbf6f] mt-1">
              {summary?.approvedCount ?? 0}
            </div>
            <span className="text-[10px] text-neutral-500">Authorized & executed</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-white/[0.06]">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Rejected / Voided</span>
            <div className="text-lg font-bold font-mono text-[#e5544d] mt-1">
              {summary?.rejectedCount ?? 0}
            </div>
            <span className="text-[10px] text-neutral-500">Disapproved by manager</span>
          </div>

          <div className="bg-[#0c0c0e] p-3.5 rounded-2xl border border-[#d4a437]/30">
            <span className="text-[10px] text-[#d4a437] uppercase font-bold">Active Approval Rules</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {summary?.totalRules ?? rules.length}
            </div>
            <span className="text-[10px] text-neutral-400">Configured policy tiers</span>
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-4 bg-[#e5544d]/10 border border-[#e5544d]/20 text-[#e5544d] rounded-2xl text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-neutral-400 hover:text-white ml-3"><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-[#3fbf6f]/10 border border-[#3fbf6f]/20 text-[#3fbf6f] rounded-2xl text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-neutral-400 hover:text-white ml-3"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
        <button
          onClick={() => setActiveTab('QUEUE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'QUEUE'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Pending Approvals Queue
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'HISTORY'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Approval History & Audit Trail
        </button>
        <button
          onClick={() => setActiveTab('RULES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'RULES'
              ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Configurable Rules Matrix ({rules.length})
        </button>
      </div>

      {/* TAB 1 & 2: QUEUE & HISTORY LIST */}
      {(activeTab === 'QUEUE' || activeTab === 'HISTORY') && (
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.08] gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#d4a437]" />
              <h3 className="text-base font-bold text-white">
                {activeTab === 'QUEUE' ? 'Pending Approval Requests' : 'Approval Audit Stream'}
              </h3>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'HISTORY' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-[#0c0c0e] text-neutral-300 text-xs p-2 rounded-xl border border-white/[0.08] outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-[#0c0c0e] text-neutral-300 text-xs p-2 rounded-xl border border-white/[0.08] outline-none"
              >
                <option value="ALL">All Transaction Types</option>
                <option value="PURCHASE_REQUEST">Purchase Request</option>
                <option value="PURCHASE_ORDER">Purchase Order</option>
                <option value="EXPENSE">Expense Voucher</option>
                <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
                <option value="STOCK_TRANSFER">Stock Transfer</option>
                <option value="DISCOUNT">Discount</option>
                <option value="REFUND">Refund</option>
                <option value="SALARY_CHANGE">Salary Change</option>
              </select>
            </div>
          </div>

          {/* Requests Grid */}
          <div className="space-y-3">
            {requests.length === 0 && (
              <div className="text-center py-12 text-neutral-500 italic text-xs">
                No {activeTab === 'QUEUE' ? 'pending' : ''} approval requests found matching filter criteria.
              </div>
            )}

            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-[#0c0c0e] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-4 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#d4a437]">{req.requestNumber}</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-neutral-300 text-[10px] font-bold">
                      {formatTypeLabel(req.transactionType)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      req.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {req.amount && (
                      <span className="text-sm font-mono font-bold text-white">
                        {formatINR(Number(req.amount))}
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-500">
                      Step {req.currentStep} of {req.totalSteps}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white">{req.title}</h4>
                  {req.description && (
                    <p className="text-[11px] text-neutral-400 mt-0.5">{req.description}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-white/[0.04] text-[10px] text-neutral-500 gap-2">
                  <div>
                    Requested by <strong className="text-neutral-300 font-normal">{req.requestedBy?.firstName} {req.requestedBy?.lastName}</strong> ({req.requestedBy?.role?.name || 'Staff'}) on {formatDateTimeIN(req.createdAt)}
                    {req.branch?.name && <span> | Branch: <strong className="text-[#d4a437] font-normal">{req.branch.name}</strong></span>}
                  </div>

                  {/* Actions for Pending Requests */}
                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveRequest(req);
                          setActionType('APPROVED');
                          setComment('');
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-[#3fbf6f]/10 hover:bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30 font-bold text-[11px] rounded-lg transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve (Step {req.currentStep})
                      </button>
                      <button
                        onClick={() => {
                          setActiveRequest(req);
                          setActionType('REJECTED');
                          setComment('');
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-[#e5544d]/10 hover:bg-[#e5544d]/20 text-[#e5544d] border border-[#e5544d]/30 font-bold text-[11px] rounded-lg transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Audit Action Log Timeline */}
                {req.actions && req.actions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-1.5 bg-[#17171b] p-2.5 rounded-xl">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Action Audit Trail</span>
                    {req.actions.map((act) => (
                      <div key={act.id} className="text-[11px] flex items-center justify-between text-neutral-300">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${act.action === 'APPROVED' ? 'text-[#3fbf6f]' : 'text-[#e5544d]'}`}>
                            {act.action}
                          </span>
                          <span>by {act.user?.firstName} {act.user?.lastName} ({act.userRole})</span>
                          {act.comment && <span className="italic text-neutral-400">"{act.comment}"</span>}
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">{formatDateTimeIN(act.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CONFIGURABLE RULES MATRIX */}
      {activeTab === 'RULES' && (
        <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#d4a437]" />
              <h3 className="text-base font-bold text-white">Configurable Multi-Tier Approval Rules Matrix</h3>
            </div>
            <button
              onClick={() => setShowCreateRuleModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a437] hover:bg-[#b88c2a] text-black font-bold text-xs rounded-xl shadow-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Policy Rule
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-white/[0.03] text-[10px] uppercase text-neutral-400 border-b border-white/[0.08]">
                <tr>
                  <th className="px-4 py-3">Transaction Type</th>
                  <th className="px-4 py-3">Threshold / Tier (Min Amount)</th>
                  <th className="px-4 py-3">Required Approver Role</th>
                  <th className="px-4 py-3 text-center">Step Sequence</th>
                  <th className="px-4 py-3">Branch Scope</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500 italic">
                      No approval rules configured. Click "Add Policy Rule" to create one.
                    </td>
                  </tr>
                )}
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-bold text-white">
                      {formatTypeLabel(rule.transactionType)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-[#d4a437]">
                      {Number(rule.minAmount) > 0 ? formatINR(Number(rule.minAmount)) : 'All Amounts (₹0+)'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-200">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-neutral-300">
                        {rule.requiredRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-white">
                      Step {rule.stepNumber}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {rule.branch?.name ? rule.branch.name : 'Global (All Branches)'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleRuleActive(rule)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                          rule.isActive
                            ? 'bg-[#3fbf6f]/20 text-[#3fbf6f] border border-[#3fbf6f]/30'
                            : 'bg-neutral-800 text-neutral-400 border border-white/[0.08]'
                        }`}
                      >
                        {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-neutral-400 hover:text-[#e5544d] rounded-lg transition"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: APPROVE / REJECT ACTION MODAL */}
      {activeRequest && actionType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {actionType === 'APPROVED' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#3fbf6f]" />
                ) : (
                  <XCircle className="w-5 h-5 text-[#e5544d]" />
                )}
                {actionType === 'APPROVED' ? 'Authorize & Approve Request' : 'Disapprove & Reject Request'}
              </h3>
              <button onClick={() => { setActiveRequest(null); setActionType(null); }}>
                <X className="w-5 h-5 text-neutral-400 hover:text-white" />
              </button>
            </div>

            <div className="bg-[#0c0c0e] p-3 rounded-xl border border-white/[0.06] text-xs space-y-1">
              <p className="text-neutral-400">Request: <strong className="text-white font-mono">{activeRequest.requestNumber}</strong></p>
              <p className="text-neutral-400">Type: <strong className="text-white">{formatTypeLabel(activeRequest.transactionType)}</strong></p>
              {activeRequest.amount && (
                <p className="text-neutral-400">Amount: <strong className="text-[#d4a437] font-mono">{formatINR(Number(activeRequest.amount))}</strong></p>
              )}
              <p className="text-neutral-400">Step: <strong className="text-white">Step {activeRequest.currentStep} of {activeRequest.totalSteps}</strong></p>
            </div>

            <form onSubmit={handleExecuteAction} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">
                  Review Remarks / Justification {actionType === 'REJECTED' && '*'}
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={actionType === 'APPROVED' ? 'e.g. Verified quotes with vendor. Approved.' : 'e.g. Budget ceiling exceeded. Rejected.'}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none resize-none"
                  required={actionType === 'REJECTED'}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => { setActiveRequest(null); setActionType(null); }}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 text-xs rounded-xl font-bold transition ${
                    actionType === 'APPROVED'
                      ? 'bg-[#3fbf6f] hover:bg-[#34a35e] text-black'
                      : 'bg-[#e5544d] hover:bg-[#c9453f] text-white'
                  }`}
                >
                  Confirm {actionType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE APPROVAL RULE MODAL */}
      {showCreateRuleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#d4a437]" /> Create Approval Policy Rule
              </h3>
              <button onClick={() => setShowCreateRuleModal(false)}>
                <X className="w-5 h-5 text-neutral-400 hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Transaction Type *</label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as ApprovalType)}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                >
                  <option value="PURCHASE_REQUEST">Purchase Request (PR)</option>
                  <option value="PURCHASE_ORDER">Purchase Order (PO)</option>
                  <option value="EXPENSE">Expense Voucher</option>
                  <option value="STOCK_ADJUSTMENT">Stock Physical Adjustment</option>
                  <option value="STOCK_TRANSFER">Stock Warehouse Transfer</option>
                  <option value="DISCOUNT">Order Discount</option>
                  <option value="REFUND">Customer Refund</option>
                  <option value="SALARY_CHANGE">Employee Salary Change</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Threshold Amount (₹) *</label>
                <input
                  type="number"
                  min="0"
                  value={newRuleMinAmount}
                  onChange={(e) => setNewRuleMinAmount(Number(e.target.value))}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] font-mono focus:border-[#d4a437] outline-none text-[#d4a437]"
                  required
                />
                <span className="text-[10px] text-neutral-500">Transactions at or above this amount will require this tier</span>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Required Approver Role *</label>
                <select
                  value={newRuleRole}
                  onChange={(e) => setNewRuleRole(e.target.value)}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                >
                  <option value="STORE_MANAGER">Store / Department Manager</option>
                  <option value="BRANCH_MANAGER">Branch Manager</option>
                  <option value="ADMIN">Finance Controller / Admin</option>
                  <option value="SUPER_ADMIN">Managing Director / Super Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-semibold block mb-1">Step Sequence Number *</label>
                <select
                  value={newRuleStep}
                  onChange={(e) => setNewRuleStep(Number(e.target.value))}
                  className="w-full bg-[#0c0c0e] text-white text-xs p-2.5 rounded-xl border border-white/[0.1] focus:border-[#d4a437] outline-none"
                >
                  <option value={1}>Step 1 (First Line Authorization)</option>
                  <option value={2}>Step 2 (Second Tier Authorization)</option>
                  <option value={3}>Step 3 (Executive Final Sign-off)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowCreateRuleModal(false)}
                  className="px-4 py-2 bg-white/[0.04] text-neutral-300 text-xs rounded-xl font-semibold hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#d4a437] hover:bg-[#b88c2a] text-black text-xs rounded-xl font-bold"
                >
                  Save Policy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalCenterPage;
