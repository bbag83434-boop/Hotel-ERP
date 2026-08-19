'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { organizationApi } from '@/api/organization';
import { Branch, Warehouse, Department, Staff } from '@/types/organization.types';
import { useOutlet } from '@/context/OutletContext';
import {
  Building2,
  Warehouse as WarehouseIcon,
  Users,
  Briefcase,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Mail,
  Phone,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';

export const OrganizationManager: React.FC = () => {
  const { currentOutlet, refreshOutlets } = useOutlet();
  const [subTab, setSubTab] = useState<'branches' | 'warehouses' | 'departments' | 'staff'>('branches');
  
  // Entity State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Loading & Feedback State
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Form states
  const [branchForm, setBranchForm] = useState({ name: '', code: '', type: 'RESTAURANT', email: '', phone: '', address: '' });
  const [warehouseForm, setWarehouseForm] = useState({ name: '', code: '', branch_id: '', is_central: false });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', branch_id: '' });
  const [staffForm, setStaffForm] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    branch_id: '',
    base_salary: 0,
    hourly_rate: 0,
    status: 'ACTIVE',
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [brData, whData, deptData, staffData] = await Promise.all([
        organizationApi.getBranches().catch(() => []),
        organizationApi.getWarehouses().catch(() => []),
        organizationApi.getDepartments().catch(() => []),
        organizationApi.getStaff().catch(() => []),
      ]);
      setBranches(brData);
      setWarehouses(whData);
      setDepartments(deptData);
      setStaffList(staffData);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load organization data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Set default branch for forms when branches load
  useEffect(() => {
    if (branches.length > 0) {
      const defaultId = currentOutlet?.id || branches[0].id;
      setWarehouseForm((prev) => ({ ...prev, branch_id: prev.branch_id || defaultId }));
      setDeptForm((prev) => ({ ...prev, branch_id: prev.branch_id || defaultId }));
      setStaffForm((prev) => ({ ...prev, branch_id: prev.branch_id || defaultId }));
    }
  }, [branches, currentOutlet]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await organizationApi.createBranch(branchForm);
      setFeedback({ type: 'success', message: `Branch "${branchForm.name}" created successfully.` });
      setShowCreateModal(false);
      setBranchForm({ name: '', code: '', type: 'RESTAURANT', email: '', phone: '', address: '' });
      await loadAllData();
      await refreshOutlets();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Branch creation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await organizationApi.createWarehouse(warehouseForm);
      setFeedback({ type: 'success', message: `Warehouse "${warehouseForm.name}" created successfully.` });
      setShowCreateModal(false);
      setWarehouseForm({ name: '', code: '', branch_id: branches[0]?.id || '', is_central: false });
      await loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Warehouse creation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await organizationApi.createDepartment(deptForm);
      setFeedback({ type: 'success', message: `Department "${deptForm.name}" created successfully.` });
      setShowCreateModal(false);
      setDeptForm({ name: '', code: '', branch_id: branches[0]?.id || '', });
      await loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Department creation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await organizationApi.createStaff({
        ...staffForm,
        base_salary: Number(staffForm.base_salary),
        hourly_rate: Number(staffForm.hourly_rate),
      });
      setFeedback({ type: 'success', message: `Staff member "${staffForm.first_name} ${staffForm.last_name}" registered.` });
      setShowCreateModal(false);
      setStaffForm({
        employee_code: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        designation: '',
        department: '',
        branch_id: branches[0]?.id || '',
        base_salary: 0,
        hourly_rate: 0,
        status: 'ACTIVE',
      });
      await loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Staff registration failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Lists
  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWarehouses = warehouses.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) || w.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStaff = staffList.filter((s) =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#C79A3B]" />
            Organization & Enterprise Topology
          </h2>
          <p className="text-xs text-[#707070] mt-0.5">
            Manage branches, storage warehouses, operating departments, and staff allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New {subTab === 'branches' ? 'Branch' : subTab === 'warehouses' ? 'Warehouse' : subTab === 'departments' ? 'Department' : 'Staff'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-[#2E8B57]/10 border-[#2E8B57]/30 text-[#2E8B57]'
              : 'bg-[#D9534F]/10 border-[#D9534F]/30 text-[#D9534F]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => { setSubTab('branches'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'branches'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Branches</span>
            <Building2 className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{branches.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">Live PostgreSQL Records</p>
        </button>

        <button
          onClick={() => { setSubTab('warehouses'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'warehouses'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Warehouses</span>
            <WarehouseIcon className="w-4 h-4 text-[#3978B8]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{warehouses.length}</p>
          <p className="text-[10px] text-[#3978B8] mt-1 font-medium">{warehouses.filter((w) => w.is_central).length} Central Hubs</p>
        </button>

        <button
          onClick={() => { setSubTab('departments'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'departments'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Departments</span>
            <Briefcase className="w-4 h-4 text-[#B8862D]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{departments.length}</p>
          <p className="text-[10px] text-[#707070] mt-1">Cross-Outlet Operations</p>
        </button>

        <button
          onClick={() => { setSubTab('staff'); setSearchQuery(''); }}
          className={`p-4 rounded-xl text-left border transition-all ${
            subTab === 'staff'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/80 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Staff Directory</span>
            <Users className="w-4 h-4 text-[#2E8B57]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{staffList.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium">{staffList.filter((s) => s.is_active).length} Active Personnel</p>
        </button>
      </div>

      {/* Search and Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex border-b border-[rgba(45,45,45,0.08)] space-x-3 overflow-x-auto">
          {(['branches', 'warehouses', 'departments', 'staff'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setSubTab(tab); setSearchQuery(''); }}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                subTab === tab
                  ? 'border-[#C79A3B] text-[#B8862D]'
                  : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]" />
          <input
            type="text"
            placeholder={`Search ${subTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[rgba(45,45,45,0.12)] focus:outline-none focus:border-[#C79A3B] text-[#1C1C1C]"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
          <span>Synchronizing live organization data from Neon PostgreSQL...</span>
        </div>
      ) : (
        <div>
          {/* TAB: Branches */}
          {subTab === 'branches' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBranches.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#C79A3B]/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{b.name}</h4>
                      <p className="text-[11px] font-mono text-[#B8862D] mt-0.5">[{b.code}]</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30">
                      {b.type}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-[#707070]">
                    {b.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[#C79A3B] shrink-0" />
                        <span className="truncate">{b.address}</span>
                      </div>
                    )}
                    {b.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-[#707070] shrink-0" />
                        <span className="truncate">{b.email}</span>
                      </div>
                    )}
                    {b.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-[#707070] shrink-0" />
                        <span>{b.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-[10px] text-[#707070]">
                    <span className="font-mono truncate max-w-[140px]">UUID: {b.id.slice(0, 8)}...</span>
                    <span className={`font-semibold ${b.is_active ? 'text-[#2E8B57]' : 'text-[#D9534F]'}`}>
                      {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: Warehouses */}
          {subTab === 'warehouses' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWarehouses.map((w) => {
                const parentBranch = branches.find((b) => b.id === w.branch_id);
                return (
                  <div
                    key={w.id}
                    className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#3978B8]/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{w.name}</h4>
                        <p className="text-[11px] font-mono text-[#3978B8] mt-0.5">[{w.code}]</p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          w.is_central
                            ? 'bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/30'
                            : 'bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.12)]'
                        }`}
                      >
                        {w.is_central ? 'CENTRAL STORE' : 'OUTLET STORE'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#707070]">
                      <span className="font-medium text-[#1C1C1C]">Associated Outlet:</span>{' '}
                      {parentBranch ? `${parentBranch.name} [${parentBranch.code}]` : 'Enterprise Wide'}
                    </div>

                    <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-[10px] text-[#707070]">
                      <span className="font-mono truncate max-w-[140px]">UUID: {w.id.slice(0, 8)}...</span>
                      <span className={`font-semibold ${w.is_active ? 'text-[#2E8B57]' : 'text-[#D9534F]'}`}>
                        {w.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: Departments */}
          {subTab === 'departments' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartments.map((d) => {
                const parentBranch = branches.find((b) => b.id === d.branch_id);
                return (
                  <div
                    key={d.id}
                    className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#B8862D]/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{d.name}</h4>
                        <p className="text-[11px] font-mono text-[#B8862D] mt-0.5">[{d.code}]</p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.12)]">
                        DEPARTMENT
                      </span>
                    </div>

                    <div className="text-[11px] text-[#707070]">
                      <span className="font-medium text-[#1C1C1C]">Assigned Unit:</span>{' '}
                      {parentBranch ? `${parentBranch.name} [${parentBranch.code}]` : 'All Branches'}
                    </div>

                    <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-[10px] text-[#707070]">
                      <span className="font-mono truncate max-w-[140px]">UUID: {d.id.slice(0, 8)}...</span>
                      <span className={`font-semibold ${d.is_active ? 'text-[#2E8B57]' : 'text-[#D9534F]'}`}>
                        {d.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: Staff */}
          {subTab === 'staff' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((s) => {
                const parentBranch = branches.find((b) => b.id === s.branch_id);
                return (
                  <div
                    key={s.id}
                    className="p-4 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#2E8B57]/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">
                          {s.first_name} {s.last_name}
                        </h4>
                        <p className="text-[11px] font-medium text-[#707070]">{s.designation}</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FAF8F5] text-[#1C1C1C] border border-[rgba(45,45,45,0.12)]">
                        {s.employee_code}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-[#707070]">
                      <div>
                        <span className="font-medium text-[#1C1C1C]">Branch:</span>{' '}
                        {parentBranch ? `${parentBranch.name}` : 'General Pool'}
                      </div>
                      {s.department && (
                        <div>
                          <span className="font-medium text-[#1C1C1C]">Dept:</span> {s.department}
                        </div>
                      )}
                      {s.email && (
                        <div className="truncate">
                          <span className="font-medium text-[#1C1C1C]">Email:</span> {s.email}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-[#2E8B57] font-semibold">
                        <span>Base: ${Number(s.base_salary).toFixed(2)}</span>
                        {Number(s.hourly_rate) > 0 && <span>· ${Number(s.hourly_rate).toFixed(2)}/hr</span>}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between text-[10px] text-[#707070]">
                      <span className="font-mono truncate max-w-[140px]">UUID: {s.id.slice(0, 8)}...</span>
                      <span
                        className={`font-semibold px-1.5 py-0.5 rounded ${
                          s.status === 'ACTIVE' ? 'bg-[#2E8B57]/10 text-[#2E8B57]' : 'bg-[#D9534F]/10 text-[#D9534F]'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Entity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">
                Add New {subTab === 'branches' ? 'Branch' : subTab === 'warehouses' ? 'Warehouse' : subTab === 'departments' ? 'Department' : 'Staff Member'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Branch Form */}
            {subTab === 'branches' && (
              <form onSubmit={handleCreateBranch} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Branch Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Apex Rooftop Lounge"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Branch Code *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. OUT-ROOFTOP"
                      value={branchForm.code}
                      onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Type *</label>
                    <select
                      value={branchForm.type}
                      onChange={(e) => setBranchForm({ ...branchForm, type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    >
                      <option value="RESTAURANT">Restaurant Outlet</option>
                      <option value="HOTEL">Hotel Resort</option>
                      <option value="HYBRID">Hybrid HQ</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Address</label>
                  <input
                    type="text"
                    placeholder="Full physical address"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="outlet@apex.com"
                      value={branchForm.email}
                      onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Phone</label>
                    <input
                      type="text"
                      placeholder="+1-555-0199"
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                  >
                    {actionLoading ? 'Creating...' : 'Create Branch'}
                  </button>
                </div>
              </form>
            )}

            {/* Warehouse Form */}
            {subTab === 'warehouses' && (
              <form onSubmit={handleCreateWarehouse} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Warehouse Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Dry Food Storage Vault"
                    value={warehouseForm.name}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Warehouse Code *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. WH-DRY-01"
                      value={warehouseForm.code}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Branch Association *</label>
                    <select
                      value={warehouseForm.branch_id}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, branch_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} [{b.code}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_central"
                    checked={warehouseForm.is_central}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, is_central: e.target.checked })}
                    className="w-4 h-4 rounded text-[#C79A3B]"
                  />
                  <label htmlFor="is_central" className="text-[#1C1C1C] font-medium">
                    Central Distribution Store (serves all outlets)
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                  >
                    {actionLoading ? 'Creating...' : 'Create Warehouse'}
                  </button>
                </div>
              </form>
            )}

            {/* Department Form */}
            {subTab === 'departments' && (
              <form onSubmit={handleCreateDepartment} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Department Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Pastry & Bakery Production"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Department Code *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. DEPT-PASTRY"
                      value={deptForm.code}
                      onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Assigned Branch</label>
                    <select
                      value={deptForm.branch_id}
                      onChange={(e) => setDeptForm({ ...deptForm, branch_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    >
                      <option value="">All Branches (Corporate Wide)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} [{b.code}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                  >
                    {actionLoading ? 'Creating...' : 'Create Department'}
                  </button>
                </div>
              </form>
            )}

            {/* Staff Form */}
            {subTab === 'staff' && (
              <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">First Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="Jane"
                      value={staffForm.first_name}
                      onChange={(e) => setStaffForm({ ...staffForm, first_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Last Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="Doe"
                      value={staffForm.last_name}
                      onChange={(e) => setStaffForm({ ...staffForm, last_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Employee Code *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. EMP-9021"
                      value={staffForm.employee_code}
                      onChange={(e) => setStaffForm({ ...staffForm, employee_code: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Designation *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Head Chef / Storekeeper"
                      value={staffForm.designation}
                      onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Branch Allocation *</label>
                    <select
                      required
                      value={staffForm.branch_id}
                      onChange={(e) => setStaffForm({ ...staffForm, branch_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} [{b.code}]
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="Kitchen / Service"
                      value={staffForm.department}
                      onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="staff@apex.com"
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Phone</label>
                    <input
                      type="text"
                      placeholder="+1-555-4321"
                      value={staffForm.phone}
                      onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Base Monthly Salary ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={staffForm.base_salary}
                      onChange={(e) => setStaffForm({ ...staffForm, base_salary: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#707070] font-semibold mb-1">Hourly Rate ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={staffForm.hourly_rate}
                      onChange={(e) => setStaffForm({ ...staffForm, hourly_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                  >
                    {actionLoading ? 'Registering...' : 'Register Staff'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationManager;
