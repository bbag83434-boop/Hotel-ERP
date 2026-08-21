'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { procurementApi } from '@/api/procurement';
import { useOutlet } from '@/context/OutletContext';
import { Outlet } from '@/types';
import { SmartAIAskResponse } from '@/types/purchase.types';
import {
  Sparkles,
  Minus,
  Plus,
  ShoppingCart,
  Send,
  Bot,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Boxes,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Badge, Button, AlertBanner, EmptyState, StatCard } from '@/components/ui';

interface Recommendation {
  item_id: string;
  item_name: string;
  current_quantity: number;
  min_stock_level: number;
  suggested_order_quantity: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

interface AIAssistantWorkspaceProps {
  activeOutlet: Outlet;
}

export const AIAssistantWorkspace: React.FC<AIAssistantWorkspaceProps> = ({ activeOutlet }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Natural Language AI Q&A Assistant State
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<SmartAIAskResponse | null>(null);
  const [aiAsking, setAiAsking] = useState<boolean>(false);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await apiClient.get('/ai/recommendations/stock');
      const dataList = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setRecommendations(dataList);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Failed to fetch AI recommendations',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAskAI = async (questionText?: string) => {
    const q = (questionText || aiQuestion).trim();
    if (!q || !activeOutlet.id) return;
    setAiAsking(true);
    try {
      const res = await procurementApi.askSmartRequirementAssistant({
        branch_id: activeOutlet.id,
        question: q,
      });
      setAiAnswer(res);
      setAiQuestion('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'AI Assistant query failed.',
      });
    } finally {
      setAiAsking(false);
    }
  };

  const handleSendPurchaseRequest = async (rec: Recommendation) => {
    try {
      setSubmittingId(rec.item_id);
      await apiClient.post('/procurement/requests', {
        branch_id: activeOutlet.id,
        items: [
          {
            item_id: rec.item_id,
            requested_qty: rec.suggested_order_quantity,
          },
        ],
        priority: rec.priority,
        notes: `AI Assistant recommendation: ${rec.recommendation}`,
      });
      setFeedback({
        type: 'success',
        message: `Purchase Request issued for ${rec.suggested_order_quantity} units of ${rec.item_name}.`,
      });
      fetchRecommendations();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.response?.data?.message || 'Failed to send purchase request',
      });
    } finally {
      setSubmittingId(null);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [activeOutlet.id]);

  const updateQuantity = (itemId: string, delta: number) => {
    setRecommendations((prev) =>
      prev.map((rec) =>
        rec.item_id === itemId
          ? { ...rec, suggested_order_quantity: Math.max(0, rec.suggested_order_quantity + delta) }
          : rec
      )
    );
  };

  const criticalCount = recommendations.filter((r) => r.priority === 'HIGH').length;

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#C79A3B]" />
              Smart Inventory AI Assistant
            </h2>
            <Badge variant="outlet">[{activeOutlet.code}]</Badge>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Automated stock requirement intelligence, consumption forecasting, and real-time inventory query engine.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchRecommendations}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#C79A3B]" />}
          >
            Sync Intel
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      <AlertBanner feedback={feedback} onClose={() => setFeedback(null)} />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <StatCard
          title="Active Scope"
          value={activeOutlet.name}
          subtitle={`Unit Code: [${activeOutlet.code}]`}
          icon={<ShieldCheck className="w-4 h-4 text-[#B8862D]" />}
          iconBgColor="bg-[#F1E4C5]/40"
        />
        <StatCard
          title="Critical Items"
          value={criticalCount}
          subtitle={criticalCount > 0 ? 'Urgent reorders required' : 'Stock levels healthy'}
          icon={<AlertCircle className="w-4 h-4 text-red-600" />}
          iconBgColor="bg-red-50 text-red-600"
        />
        <StatCard
          title="AI Monitored Items"
          value={recommendations.length}
          subtitle="Real-time min-max tracking"
          icon={<Boxes className="w-4 h-4 text-[#3978B8]" />}
          iconBgColor="bg-blue-50 text-[#3978B8]"
        />
      </div>

      {/* Interactive Natural Language AI Q&A Panel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(45,45,45,0.06)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#F1E4C5] flex items-center justify-center text-[#B8862D] shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-[#1C1C1C] font-['Outfit']">Interactive Inventory Q&A</h4>
              <p className="text-[10px] sm:text-[11px] text-[#707070]">Ask instant stock, deficit, incoming PR, and run-rate questions</p>
            </div>
          </div>
          <Badge variant="success" className="self-start sm:self-auto">Scoped: {activeOutlet.code}</Badge>
        </div>

        {/* Quick Question Chips (Horizontal Scrollable on Mobile) */}
        <div className="space-y-1.5">
          <span className="text-[10px] sm:text-[11px] text-[#707070] font-semibold flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-[#C79A3B]" /> Quick Queries:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { label: '🔥 What is critical today?', q: 'What is critical today?' },
              { label: '⚠️ What stock is low today?', q: 'What stock is low today?' },
              { label: '📦 What do I need to order?', q: 'What do I need to order?' },
              { label: '⏳ What is already pending?', q: 'What is already pending?' },
              { label: '🔮 What do I need for tomorrow?', q: 'What do I need for tomorrow?' },
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleAskAI(chip.q)}
                disabled={aiAsking}
                className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F1E4C5] text-[#1C1C1C] hover:text-[#B8862D] border border-[rgba(45,45,45,0.08)] text-[11px] font-semibold transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAskAI();
            }}
            placeholder={`Ask AI Assistant about stock levels, consumption or orders for ${activeOutlet.name}...`}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] focus:outline-none focus:border-[#C79A3B] focus:ring-1 focus:ring-[#C79A3B]/30"
          />
          <Button
            variant="gold"
            size="md"
            onClick={() => handleAskAI()}
            disabled={aiAsking || !aiQuestion.trim()}
            loading={aiAsking}
            icon={<Send className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto"
          >
            {aiAsking ? 'Analyzing...' : 'Ask AI'}
          </Button>
        </div>

        {/* AI Answer Card */}
        {aiAnswer && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-[#FAF8F5] to-white border border-[#C79A3B]/30 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="purple">Intent: {aiAnswer.intent}</Badge>
                <span className="text-xs font-semibold text-[#1C1C1C] truncate">
                  &ldquo;{aiAnswer.question}&rdquo;
                </span>
              </div>
              <button
                onClick={() => setAiAnswer(null)}
                aria-label="Close answer"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Answer Text */}
            <div className="p-3 rounded-lg bg-white border border-[rgba(45,45,45,0.06)] text-xs text-[#1C1C1C] whitespace-pre-line leading-relaxed font-sans shadow-2xs">
              {aiAnswer.answer_text}
            </div>

            {/* Metrics Breakdown */}
            {aiAnswer.metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)]">
                  <span className="text-[10px] text-[#707070] block truncate">Monitored</span>
                  <span className="font-bold text-[#1C1C1C]">{aiAnswer.metrics.total_monitored_items ?? 0}</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)]">
                  <span className="text-[10px] text-red-600 font-bold block truncate">Critical</span>
                  <span className="font-bold text-red-600">{aiAnswer.metrics.critical_count ?? 0}</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)]">
                  <span className="text-[10px] text-amber-700 block truncate">Below Min</span>
                  <span className="font-bold text-amber-700">{aiAnswer.metrics.low_stock_count ?? 0}</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)]">
                  <span className="text-[10px] text-blue-700 block truncate">Need Order</span>
                  <span className="font-bold text-blue-700">{aiAnswer.metrics.need_order_count ?? 0}</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-[rgba(45,45,45,0.06)] col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-[#2E8B57] block truncate">Pending Orders</span>
                  <span className="font-bold text-[#2E8B57]">{aiAnswer.metrics.pending_items_count ?? 0}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stock Reorder Recommendations List */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#C79A3B]" />
            Deterministic Reorder Recommendations ({recommendations.length})
          </h3>
          <span className="text-[11px] text-[#707070] hidden sm:inline">Calculated against outlet min stock buffers</span>
        </div>

        {recommendations.length === 0 ? (
          <EmptyState
            title="All Stock Levels Optimal"
            description={`No items are currently below minimum reorder points in ${activeOutlet.name}.`}
            icon={<CheckCircle2 className="w-6 h-6 text-[#2E8B57]" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {recommendations.map((rec) => {
              const isSubmittingThis = submittingId === rec.item_id;
              const isCritical = rec.priority === 'HIGH';

              return (
                <div
                  key={rec.item_id}
                  className="p-4 sm:p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs space-y-3 hover:border-[#C79A3B]/30 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-[#1C1C1C] font-['Outfit'] truncate">{rec.item_name}</h4>
                        <p className="text-xs text-[#707070] mt-0.5 leading-relaxed">{rec.recommendation}</p>
                      </div>
                      <Badge variant={isCritical ? 'danger' : 'warning'}>
                        {rec.priority}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 sm:p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.06)] text-xs">
                      <div>
                        <span className="text-[10px] text-[#707070] block">Current Stock</span>
                        <span className="font-bold font-mono text-[#1C1C1C]">{rec.current_quantity}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#707070] block">Min Required</span>
                        <span className="font-bold font-mono text-[#707070]">{rec.min_stock_level}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#707070]">Suggested Order:</span>
                      <div className="flex items-center gap-1.5 border border-[rgba(45,45,45,0.12)] rounded-xl p-1 bg-[#FAF8F5]">
                        <button
                          onClick={() => updateQuantity(rec.item_id, -1)}
                          disabled={rec.suggested_order_quantity <= 1}
                          className="p-1 hover:bg-white rounded-lg text-gray-600 disabled:opacity-30 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold font-mono text-xs w-9 text-center text-[#1C1C1C]">
                          {rec.suggested_order_quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(rec.item_id, 1)}
                          className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleSendPurchaseRequest(rec)}
                      disabled={isSubmittingThis}
                      loading={isSubmittingThis}
                      icon={<ShoppingCart className="w-3.5 h-3.5" />}
                      className="w-full"
                    >
                      {isSubmittingThis ? 'Submitting PR...' : 'Convert to Purchase Request'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistantWorkspace;
