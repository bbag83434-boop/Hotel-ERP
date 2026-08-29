'use client';

import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, KeyRound, RefreshCw, Send, ShieldCheck, XCircle } from 'lucide-react';
import { aiProviderApi, AIProviderStatus } from '@/api/aiProvider';
import { Button } from '@/components/ui/Button';

export default function AIProviderWorkspace() {
  const [status, setStatus] = useState<AIProviderStatus | null>(null);
  const [provider, setProvider] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try { const data = await aiProviderApi.status(); setStatus(data); setProvider(data.default_provider); }
    catch (e: any) { setError(e?.response?.data?.detail || 'Unable to load provider status.'); }
  };
  useEffect(() => { load(); }, []);

  const testProvider = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(''); setAnswer('');
    try {
      const data = await aiProviderApi.generate({ provider: provider || undefined, messages: [
        { role: 'system', content: 'You are a concise business assistant for a restaurant ERP. Do not invent database facts.' },
        { role: 'user', content: prompt.trim() },
      ]});
      setAnswer(data.text);
    } catch (e: any) { setError(e?.response?.data?.detail || 'Provider request failed.'); }
    finally { setLoading(false); }
  };

  return <div className="space-y-4">
    <div className="bg-white rounded-2xl border border-[rgba(45,45,45,.08)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Bot className="w-5 h-5 text-[#C79A3B]"/><h2 className="text-lg font-bold">AI Provider Control</h2></div><p className="text-xs text-[#707070] mt-1">Provider abstraction layer. API keys remain server-side.</p></div>
        <Button variant="secondary" size="sm" onClick={load} icon={<RefreshCw className="w-3.5 h-3.5"/>}>Refresh</Button>
      </div>
    </div>
    {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2"><XCircle className="w-4 h-4 shrink-0"/>{error}</div>}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {['openai','gemini','anthropic'].map(name => <div key={name} className="bg-white rounded-2xl border border-[rgba(45,45,45,.08)] p-4"><div className="flex justify-between"><b className="text-sm capitalize">{name}</b>{status?.configured_providers.includes(name) ? <CheckCircle2 className="w-4 h-4 text-[#2E8B57]"/> : <XCircle className="w-4 h-4 text-[#999]"/>}</div><p className="text-[10px] text-[#707070] mt-2">{status?.configured_providers.includes(name) ? 'Configured on server' : 'Not configured'}</p></div>)}
    </div>
    <div className="bg-white rounded-2xl border border-[rgba(45,45,45,.08)] p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold"><KeyRound className="w-4 h-4 text-[#C79A3B]"/>Provider Test</div>
      <select value={provider} onChange={e=>setProvider(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,.1)] text-xs"><option value="">Default provider</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="anthropic">Anthropic</option></select>
      <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Test a provider with a simple question..." rows={4} className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,.1)] text-xs outline-none"/>
      <Button variant="primary" onClick={testProvider} disabled={loading || !prompt.trim()} icon={<Send className="w-3.5 h-3.5"/>}>{loading ? 'Testing…' : 'Test Provider'}</Button>
      {answer && <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#C79A3B]/20 text-xs leading-relaxed whitespace-pre-wrap">{answer}</div>}
    </div>
    <div className="p-3 rounded-xl bg-[#F1E4C5]/50 border border-[#C79A3B]/20 text-[10px] text-[#6B5726] flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0"/>This Part only provides the provider layer. AI tools, approvals and business actions remain separately permission-controlled.</div>
  </div>;
}
