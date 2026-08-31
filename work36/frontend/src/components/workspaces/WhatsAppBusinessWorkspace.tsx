'use client';
import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, Badge, StatCard } from '@/components/ui';
import { whatsappApi, WhatsAppLink, WhatsAppStatus } from '@/api/whatsapp';

export default function WhatsAppBusinessWorkspace(){
 const [status,setStatus]=useState<WhatsAppStatus|null>(null),[links,setLinks]=useState<WhatsAppLink[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const load=useCallback(async()=>{setLoading(true);setMessage('');try{const [s,l]=await Promise.all([whatsappApi.status(),whatsappApi.links()]);setStatus(s);setLinks(l);}catch(e:any){setMessage(e?.response?.data?.detail||'Unable to load WhatsApp integration.')}finally{setLoading(false)}},[]);
 useEffect(()=>{load()},[load]);
 return <div className="space-y-5">
  <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-[#C79A3B]"/><h2 className="text-xl font-bold">WhatsApp Business Integration</h2><Badge variant="outlet">Meta Cloud API</Badge></div><p className="text-xs text-[#707070] mt-1">Production webhook, verified user mapping and controlled ERP queries. No unofficial WhatsApp automation.</p></div><Button variant="secondary" size="sm" onClick={load} loading={loading} icon={<RefreshCw className="w-3.5 h-3.5"/>}>Refresh</Button></div></div>
  {message&&<div className="rounded-xl border border-[#C79A3B]/30 bg-[#FAF8F5] px-4 py-3 text-xs font-medium">{message}</div>}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><StatCard title="API" value={status?.configured?'READY':'SETUP'} subtitle="Cloud API" icon={<MessageCircle className="w-4 h-4"/>}/><StatCard title="Webhook" value={status?.webhook_configured?'READY':'CONFIG'} subtitle="HTTPS endpoint" icon={<ShieldCheck className="w-4 h-4"/>}/><StatCard title="Signature" value={status?.signature_verification?'ON':'OFF'} subtitle="HMAC verification" icon={<ShieldCheck className="w-4 h-4"/>}/><StatCard title="Linked Users" value={String(links.filter(x=>x.is_active).length)} subtitle="ERP mappings" icon={<MessageCircle className="w-4 h-4"/>}/></div>
  <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] p-4 shadow-sm"><h3 className="font-bold text-sm mb-3">Integration boundary</h3><div className="space-y-2 text-xs text-[#707070]"><p>• Inbound messages require Meta webhook signature validation.</p><p>• Only linked ERP users can query business data.</p><p>• Outlet-linked users remain restricted to their assigned outlet.</p><p>• WhatsApp cannot approve purchases, mutate stock or bypass RBAC.</p><p>• Outbound replies are dispatched in background work to keep webhook latency low.</p></div></div>
  <div className="rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] p-4 shadow-sm"><h3 className="font-bold text-sm mb-3">Linked WhatsApp users</h3>{links.length===0?<p className="text-xs text-[#707070]">No WhatsApp users linked yet.</p>:<div className="space-y-2">{links.map(x=><div key={x.id} className="flex items-center justify-between border-b border-black/5 pb-2 text-xs"><div><div className="font-semibold">{x.display_name||x.wa_user_id}</div><div className="text-[#707070]">User: {x.user_id} · Outlet: {x.branch_id||'HQ'}</div></div><Badge variant={x.is_active?'success':'neutral'}>{x.is_active?'ACTIVE':'INACTIVE'}</Badge></div>)}</div>}</div>
 </div>
}
