import React, { useState } from 'react';
import { Bot, Send, X, Sparkles, ArrowRight } from 'lucide-react';
import { aiApi } from '../../api/ai.api';
import { useNavigate } from 'react-router-dom';

export const AIAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; actions?: any[]; isBlocked?: boolean }>>([
    {
      role: 'assistant',
      text: 'Hello! I am your **Hospitality Enterprise AI Advisor**. Ask me about real-time room occupancy, stores inventory, POS dining sales, GST breakdowns, or pending approval requests.'
    }
  ]);
  const navigate = useNavigate();

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim() || loading) return;

    const userMsg = q.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await aiApi.queryAssistant(userMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.answer,
          actions: res.suggestedActions,
          isBlocked: res.intent === 'MUTATION_BLOCKED'
        }
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '⚠️ Failed to contact enterprise AI backend. Please check network connectivity.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-18 lg:bottom-6 right-4 z-40 p-3.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white rounded-full shadow-2xl shadow-indigo-500/40 flex items-center gap-2 border border-purple-400/30 transition-transform active:scale-95"
        title="Enterprise AI Assistant (Section 15)"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
        <span className="text-xs font-bold hidden sm:inline">AI Advisor</span>
      </button>

      {/* Slide-over Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-20 lg:bottom-20 right-2 sm:right-6 w-[94vw] sm:w-[420px] max-h-[580px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-xl text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Hospitality AI Executive Advisor
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                    Read-Only
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">Section 15 Financial Safety Enforced</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 max-h-[380px] text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : m.isBlocked
                      ? 'bg-rose-950/60 border border-rose-800/80 text-rose-200 rounded-bl-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <div className="whitespace-pre-line leading-relaxed">{m.text}</div>

                  {/* Action Shortcuts */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                      {m.actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          onClick={() => {
                            setIsOpen(false);
                            navigate(act.path);
                          }}
                          className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded text-[10px] font-semibold flex items-center gap-1 border border-indigo-500/30 transition"
                        >
                          {act.label} <ArrowRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-950 border border-slate-800 text-slate-400 p-3 rounded-2xl rounded-bl-none flex items-center gap-2 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  Analyzing real-time enterprise metrics...
                </div>
              </div>
            )}
          </div>

          {/* Suggestion Chips */}
          <div className="px-3 py-1.5 bg-slate-950/60 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[10px]">
            {[
              'Daily Executive Summary',
              'Low Stock Alerts',
              'Hotel Occupancy',
              'Pending Approvals'
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full whitespace-nowrap transition"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Query Input */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask enterprise question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-slate-900 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !query.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
