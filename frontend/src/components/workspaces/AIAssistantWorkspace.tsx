'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { Sparkles, Minus, Plus, ShoppingCart, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useOutlet } from '@/context/OutletContext';

interface Recommendation {
  item_id: string;
  item_name: string;
  current_quantity: number;
  min_stock_level: number;
  suggested_order_quantity: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

import { Outlet } from '@/types';

interface AIAssistantWorkspaceProps {
  activeOutlet: Outlet;
}

export const AIAssistantWorkspace: React.FC<AIAssistantWorkspaceProps> = ({ activeOutlet }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/ai/recommendations/stock');
      setRecommendations(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPurchaseRequest = async (rec: Recommendation) => {
    try {
      setSubmitting(true);
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
      // Refresh to remove requested items
      fetchRecommendations();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to send purchase request');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#707070]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C79A3B]" />
        <p className="mt-4 text-sm">Analyzing outlet patterns...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm font-semibold">{error}</p>
        <button onClick={fetchRecommendations} className="mt-4 text-xs underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[rgba(45,45,45,0.08)]">
        <h2 className="text-lg font-bold text-[#1C1C1C] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#C79A3B]" />
          Smart Assistant
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
          {activeOutlet.name}
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="p-8 text-center text-[#707070] bg-white rounded-2xl border border-[rgba(45,45,45,0.08)]">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[#2E8B57] mb-3" />
          <p className="font-semibold text-[#1C1C1C]">No action required</p>
          <p className="text-xs">All stock levels are within optimal parameters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div key={rec.item_id} className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-[#1C1C1C]">{rec.item_name}</h3>
                  <p className="text-xs text-[#707070] mt-0.5">{rec.recommendation}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  rec.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {rec.priority}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[10px] text-[#707070]">
                  Current Stock: <span className="font-bold text-[#1C1C1C]">{rec.current_quantity}</span>
                </div>
                <div className="flex items-center gap-2 border border-[rgba(45,45,45,0.08)] rounded-lg p-1">
                  <button onClick={() => updateQuantity(rec.item_id, -1)} className="p-1 hover:bg-[#FAF8F5] rounded">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-sm w-8 text-center">{rec.suggested_order_quantity}</span>
                  <button onClick={() => updateQuantity(rec.item_id, 1)} className="p-1 hover:bg-[#FAF8F5] rounded">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <button 
                onClick={() => handleSendPurchaseRequest(rec)}
                disabled={submitting}
                className="w-full py-2 flex items-center justify-center gap-2 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:bg-[#2D2D2D] transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                {submitting ? 'Sending...' : 'Send Purchase Request'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIAssistantWorkspace;
