'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Search, FileClock, LockKeyhole, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usersApi } from '@/api/users';

interface AuditLog {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

interface PermissionItem {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string | null;
}

export default function SecurityWorkspace() {
  const { user } = useAuth();
  const role = typeof user?.role === 'object' ? user.role.name : (user?.role || '');
  const isAdmin = ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN'].includes(role.toUpperCase());

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [entity, setEntity] = useState('ALL');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setError('');
      setRefreshing(true);
      const [audit, perms] = await Promise.all([usersApi.getAuditLogs({ limit: 100 }), usersApi.getPermissions()]);
      setLogs(audit || []);
      setPermissions(perms || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Security data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const entities = useMemo(() => ['ALL', ...Array.from(new Set(logs.map((l) => l.entity).filter(Boolean))).sort()], [logs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (entity !== 'ALL' && l.entity !== entity) return false;
      if (!q) return true;
      return [l.action, l.entity, l.user_name, l.user_email, l.entity_id, JSON.stringify(l.details)].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [logs, query, entity]);

  const moduleCount = new Set(permissions.map((p) => p.module)).size;
  const userPerms = new Set(Array.isArray((user as any)?.permissions) ? (user as any).permissions : []);

  if (!isAdmin) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">You do not have permission to access Security Center.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#B8862D]" /><h1 className="text-xl font-bold">Security Center</h1></div>
          <p className="mt-1 text-xs text-gray-500">RBAC, permission visibility and security audit trail.</p>
        </div>
        <button onClick={load} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Audit Events', logs.length, FileClock],
          ['Permission Codes', permissions.length, LockKeyhole],
          ['Permission Modules', moduleCount, ShieldCheck],
          ['Your Permissions', userPerms.has('*:*') ? 'ALL' : userPerms.size, Users],
        ].map(([label, value, Icon]: any) => <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4"><Icon className="h-4 w-4 text-[#B8862D]" /><p className="mt-3 text-xl font-bold">{value}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p></div>)}
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">Audit Trail</h2><p className="text-[11px] text-gray-500">Latest 100 recorded events.</p></div><FileClock className="h-4 w-4 text-gray-400" /></div>
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px]">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, entity, user..." className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#C79A3B]" /></div>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none"><option value="ALL">All entities</option>{entities.filter((e) => e !== 'ALL').map((e) => <option key={e}>{e}</option>)}</select>
        </div>
        {loading ? <div className="py-10 text-center text-xs text-gray-500">Loading security events...</div> : filtered.length === 0 ? <div className="py-10 text-center text-xs text-gray-500">No matching audit events.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400"><th className="px-2 py-2">Time</th><th className="px-2 py-2">User</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Entity</th><th className="px-2 py-2">IP</th></tr></thead><tbody>{filtered.map((l) => <tr key={l.id} className="border-b border-gray-50"><td className="px-2 py-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td><td className="px-2 py-3"><div className="font-semibold">{l.user_name || 'System'}</div><div className="text-[10px] text-gray-400">{l.user_email || ''}</div></td><td className="px-2 py-3 font-mono">{l.action}</td><td className="px-2 py-3">{l.entity}{l.entity_id ? <span className="ml-1 text-gray-400">#{l.entity_id.slice(0, 8)}</span> : null}</td><td className="px-2 py-3 text-gray-500">{l.ip_address || '—'}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">Permission Registry</h2><p className="text-[11px] text-gray-500">Granular permission codes available to RBAC.</p></div><LockKeyhole className="h-4 w-4 text-gray-400" /></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{permissions.map((p) => <div key={p.id} className="rounded-xl border border-gray-100 bg-[#FAF8F5] p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] font-bold">{p.code}</span><span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-gray-500">{p.module}</span></div><p className="mt-2 text-[10px] text-gray-500">{p.description || `${p.action} access`}</p></div>)}</div>
      </section>
    </div>
  );
}
