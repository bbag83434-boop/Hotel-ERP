'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { organizationApi } from '@/api/organization';
import {
  Company,
  Branch,
  Warehouse,
  Department,
  Staff,
  OrganizationOverview,
  BranchDetail,
} from '@/types/organization.types';
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
  Edit3,
  Eye,
  Layers,
  Compass,
  Settings,
  Sparkles,
  ExternalLink,
  Truck,
  Tags,
  Scale,
  Package,
} from 'lucide-react';
import { MasterVendors } from './masterdata/MasterVendors';
import { MasterCategories } from './masterdata/MasterCategories';
import { MasterUnits } from './masterdata/MasterUnits';
import { MasterItems } from './masterdata/MasterItems';
import { MasterVendorItems } from './masterdata/MasterVendorItems';
import { ConfirmModal, DeleteBtn } from './masterdata/ui';

export type OrganizationSubTab =
  | 'branches'
  | 'vendors'
  | 'categories'
  | 'units'
  | 'items'
  | 'vendor_items'
  | 'warehouses'
  | 'departments'
  | 'staff';

export const OrganizationManager: React.FC = () => {
  const { currentOutlet, activeOutlet, setActiveOutlet, refreshOutlets } = useOutlet();
  const [subTab, setSubTab] = useState<OrganizationSubTab>('branches');

  // Entity State
  const [overview, setOverview] = useState<OrganizationOverview | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Branch Detail Drawer / Inspect State
  const [selectedBranchDetail, setSelectedBranchDetail] = useState<BranchDetail | null>(null);
  const [loadingBranchDetail, setLoadingBranchDetail] = useState<boolean>(false);

  // Edit Modals State
  const [editingCompany, setEditingCompany] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<Branch | null>(null);
  const [deleteBranchReferences, setDeleteBranchReferences] = useState<string[]>([]);

  // Loading & Feedback State
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Form states for Creation
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

  // Company Edit Form State
  const [companyForm, setCompanyForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    logo_url: '',
  });

  // Branch Edit Form State
  const [branchEditForm, setBranchEditForm] = useState({
    name: '',
    code: '',
    type: 'RESTAURANT',
    email: '',
    phone: '',
    address: '',
    is_active: true,
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [overviewData, compData, brData, whData, deptData, staffData] = await Promise.all([
        organizationApi.getOverview().catch(() => null),
        organizationApi.getCompany().catch(() => null),
        organizationApi.getBranches().catch(() => []),
        organizationApi.getWarehouses().catch(() => []),
        organizationApi.getDepartments().catch(() => []),
        organizationApi.getStaff().catch(() => []),
      ]);

      if (overviewData) setOverview(overviewData);
      if (compData) {
        setCompany(compData);
        setCompanyForm({
          name: compData.name || '',
          code: compData.code || '',
          email: compData.email || '',
          phone: compData.phone || '',
          address: compData.address || '',
          logo_url: compData.logo_url || '',
        });
      }
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

  // Set default branch for creation forms
  useEffect(() => {
    if (branches.length > 0) {
      const defaultId = currentOutlet?.id || branches[0].id;
      setWarehouseForm((prev) => ({ ...prev, branch_id: prev.branch_id || defaultId }));
      setDeptForm((prev) => ({ ...prev, branch_id: prev.branch_id || defaultId }));
      setStaffForm((prev) => ({ ...prev, branch_id: prev.branch_id || defaultId }));
    }
  }, [branches, currentOutlet]);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const updated = await organizationApi.updateCompany(companyForm);
      setCompany(updated);
      setEditingCompany(false);
      setFeedback({ type: 'success', message: 'Company master profile updated successfully.' });
      await loadAllData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Failed to update company' });
    } finally {
      setActionLoading(false);
    }
  };

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

  const handleEditBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setActionLoading(true);
    try {
      await organizationApi.updateBranch(editingBranch.id, branchEditForm);
      setFeedback({ type: 'success', message: `Branch "${branchEditForm.name}" updated successfully.` });
      setEditingBranch(null);
      await loadAllData();
      await refreshOutlets();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Branch update failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deleteBranchTarget) return;
    setActionLoading(true);
    try {
      const res: any = await organizationApi.deleteBranch(deleteBranchTarget.id);
      const refs = res?.references as string[] | undefined;
      if (refs && refs.length) {
        setFeedback({
          type: 'error',
          message: `Cannot delete branch "${deleteBranchTarget.name}": ${refs.join(' · ')}. Set branch Inactive instead.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: res?.message || `Branch "${deleteBranchTarget.name}" deleted successfully.`,
        });
      }
      setDeleteBranchTarget(null);
      setDeleteBranchReferences([]);
      await loadAllData();
      await refreshOutlets();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.references) {
        setDeleteBranchReferences(detail.references);
        setFeedback({
          type: 'error',
          message: `${detail.message || 'Cannot delete branch.'} ${detail.references.join(' · ')}`,
        });
      } else {
        setFeedback({ type: 'error', message: err?.response?.data?.detail || err.message || 'Failed to delete branch' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleInspectBranch = async (branchId: string) => {
    setLoadingBranchDetail(true);
    try {
      const details = await organizationApi.getBranchDetails(branchId);
      setSelectedBranchDetail(details);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.detail || 'Failed to load branch details' });
    } finally {
      setLoadingBranchDetail(false);
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
      setDeptForm({ name: '', code: '', branch_id: branches[0]?.id || '' });
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

  const handleScopeToOutlet = (branch: Branch) => {
    setActiveOutlet({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      type: branch.type as any,
      isActive: branch.is_active,
    });
    setFeedback({
      type: 'success',
      message: `Active operational workspace scoped to: ${branch.name} [${branch.code}]`,
    });
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
      {/* Top Company Master Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-white via-[#FAF8F5] to-white border border-[rgba(45,45,45,0.08)] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#F1E4C5] border border-[#B8862D]/30 flex items-center justify-center text-[#B8862D] shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">
                {company?.name || 'CB Hotel Management'}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
                {company?.code || 'CB-HOTEL'}
              </span>
            </div>
            <p className="text-xs text-[#707070] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {company?.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#C79A3B]" /> {company.email}
                </span>
              )}
              {company?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#C79A3B]" /> {company.phone}
                </span>
              )}
              {company?.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#C79A3B]" /> {company.address}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditingCompany(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95"
          >
            <Settings className="w-3.5 h-3.5 text-[#C79A3B]" />
            <span>Edit Company Master</span>
          </button>
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-xs font-semibold text-[#1C1C1C] transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C79A3B] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          {['branches', 'warehouses', 'departments', 'staff'].includes(subTab) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New {subTab === 'branches' ? 'Branch' : subTab === 'warehouses' ? 'Warehouse' : subTab === 'departments' ? 'Department' : 'Staff'}</span>
            </button>
          )}
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
          className={`p-4 rounded-2xl text-left border transition-all ${
            subTab === 'branches'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/85 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Total Outlets</span>
            <Building2 className="w-4 h-4 text-[#C79A3B]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{branches.length}</p>
          <p className="text-[10px] text-[#2E8B57] mt-1 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {branches.filter((b) => b.is_active).length} Active Outlets
          </p>
        </button>

        <button
          onClick={() => { setSubTab('warehouses'); setSearchQuery(''); }}
          className={`p-4 rounded-2xl text-left border transition-all ${
            subTab === 'warehouses'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/85 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
          }`}
        >
          <div className="flex items-center justify-between text-[#707070] mb-1">
            <span className="text-xs font-semibold">Warehouses</span>
            <WarehouseIcon className="w-4 h-4 text-[#3978B8]" />
          </div>
          <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit']">{warehouses.length}</p>
          <p className="text-[10px] text-[#3978B8] mt-1 font-medium">{warehouses.filter((w) => w.is_central).length} Central Distribution Hubs</p>
        </button>

        <button
          onClick={() => { setSubTab('departments'); setSearchQuery(''); }}
          className={`p-4 rounded-2xl text-left border transition-all ${
            subTab === 'departments'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/85 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
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
          className={`p-4 rounded-2xl text-left border transition-all ${
            subTab === 'staff'
              ? 'bg-white border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
              : 'bg-white/85 border-[rgba(45,45,45,0.08)] hover:bg-[#FAF8F5]'
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

      {/* Search and Sub-Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex border-b border-[rgba(45,45,45,0.08)] space-x-3 overflow-x-auto pb-1">
          {([
            { id: 'branches', label: '14+ Outlets' },
            { id: 'vendors', label: 'Vendors / Suppliers' },
            { id: 'categories', label: 'Item Categories' },
            { id: 'units', label: 'Units' },
            { id: 'items', label: 'Item Master' },
            { id: 'vendor_items', label: 'Vendor Items & Rates' },
            { id: 'warehouses', label: 'Warehouses' },
            { id: 'departments', label: 'Departments' },
            { id: 'staff', label: 'Staff Directory' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setSubTab(tab.id as OrganizationSubTab); setSearchQuery(''); }}
              className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                subTab === tab.id
                  ? 'border-[#C79A3B] text-[#B8862D]'
                  : 'border-transparent text-[#707070] hover:text-[#1C1C1C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {['branches', 'warehouses', 'departments', 'staff'].includes(subTab) && (
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
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-[#707070] text-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#C79A3B]" />
          <span>Synchronizing live organization data from Neon PostgreSQL...</span>
        </div>
      ) : (
        <div>
          {/* TAB: Branches Matrix */}
          {subTab === 'branches' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBranches.map((b) => {
                const isCurrent = b.id === activeOutlet.id;
                const branchWarehouses = warehouses.filter((w) => w.branch_id === b.id);
                const branchDepts = departments.filter((d) => d.branch_id === b.id);
                const branchStaff = staffList.filter((s) => s.branch_id === b.id);

                return (
                  <div
                    key={b.id}
                    className={`p-5 rounded-2xl border transition-all space-y-3.5 ${
                      isCurrent
                        ? 'bg-[#FAF8F5] border-[#C79A3B] shadow-md shadow-[#C79A3B]/10 ring-1 ring-[#C79A3B]'
                        : 'bg-white border-[rgba(45,45,45,0.08)] shadow-sm hover:border-[#C79A3B]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{b.name}</h4>
                          {isCurrent && (
                            <span className="text-[10px] bg-[#F1E4C5] text-[#B8862D] font-extrabold px-1.5 py-0.5 rounded border border-[#B8862D]/30">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#B8862D] mt-0.5">[{b.code}]</p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          b.type === 'HEAD_OFFICE' || b.type === 'HYBRID'
                            ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30'
                            : b.type === 'CENTRAL_STORE'
                            ? 'bg-[#3978B8]/10 text-[#3978B8] border border-[#3978B8]/25'
                            : b.type === 'DESSERT_KITCHEN'
                            ? 'bg-[#D99625]/10 text-[#D99625] border border-[#D99625]/25'
                            : 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/25'
                        }`}
                      >
                        {b.type.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-white/80 border border-[rgba(45,45,45,0.06)] text-center text-xs">
                      <div>
                        <span className="text-[10px] text-[#707070] block">Stores</span>
                        <span className="font-bold text-[#1C1C1C]">{branchWarehouses.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#707070] block">Depts</span>
                        <span className="font-bold text-[#1C1C1C]">{branchDepts.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#707070] block">Staff</span>
                        <span className="font-bold text-[#2E8B57]">{branchStaff.length}</span>
                      </div>
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
                    </div>

                    <div className="pt-3 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleInspectBranch(b.id)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-[11px] font-semibold text-[#1C1C1C] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-[#C79A3B]" />
                          <span>Roster</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingBranch(b);
                            setBranchEditForm({
                              name: b.name,
                              code: b.code,
                              type: b.type,
                              email: b.email || '',
                              phone: b.phone || '',
                              address: b.address || '',
                              is_active: b.is_active,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-[11px] font-semibold text-[#707070] hover:text-[#1C1C1C] flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3 text-[#707070]" />
                          <span>Edit</span>
                        </button>
                        <DeleteBtn
                          onClick={() => {
                            setDeleteBranchTarget(b);
                            setDeleteBranchReferences([]);
                          }}
                        />
                      </div>

                      {!isCurrent ? (
                        <button
                          onClick={() => handleScopeToOutlet(b)}
                          className="px-3 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F1E4C5] text-[11px] font-bold text-[#B8862D] border border-[#B8862D]/30 transition-all"
                        >
                          Scope Here
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#2E8B57] font-semibold">Active Scope</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: Vendors Master */}
          {subTab === 'vendors' && <MasterVendors />}

          {/* TAB: Categories Master */}
          {subTab === 'categories' && <MasterCategories />}

          {/* TAB: Units Master */}
          {subTab === 'units' && <MasterUnits />}

          {/* TAB: Items Master */}
          {subTab === 'items' && <MasterItems />}

          {/* TAB: Vendor Items & Rates */}
          {subTab === 'vendor_items' && <MasterVendorItems />}

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

      {/* Slide-over / Modal for Branch Detail & Roster */}
      {selectedBranchDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">
                    {selectedBranchDetail.name}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#F1E4C5] text-[#B8862D]">
                    [{selectedBranchDetail.code}]
                  </span>
                </div>
                <p className="text-xs text-[#707070] mt-0.5">
                  Type: {selectedBranchDetail.type.replace('_', ' ')} · Address: {selectedBranchDetail.address || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedBranchDetail(null)}
                className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Sub-sections */}
            <div className="space-y-4 text-xs">
              {/* Linked Warehouses */}
              <div>
                <h4 className="font-bold text-[#1C1C1C] mb-2 flex items-center gap-1.5">
                  <WarehouseIcon className="w-3.5 h-3.5 text-[#3978B8]" />
                  <span>Assigned Warehouses ({selectedBranchDetail.warehouses.length})</span>
                </h4>
                {selectedBranchDetail.warehouses.length === 0 ? (
                  <p className="text-[#707070] italic">No independent warehouses assigned.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedBranchDetail.warehouses.map((w) => (
                      <div key={w.id} className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                        <div className="font-bold text-[#1C1C1C]">{w.name}</div>
                        <div className="text-[10px] text-[#3978B8] font-mono">[{w.code}] · {w.is_central ? 'Central Hub' : 'Local Store'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Operating Departments */}
              <div>
                <h4 className="font-bold text-[#1C1C1C] mb-2 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[#B8862D]" />
                  <span>Departments ({selectedBranchDetail.departments.length})</span>
                </h4>
                {selectedBranchDetail.departments.length === 0 ? (
                  <p className="text-[#707070] italic">No local departments configured.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedBranchDetail.departments.map((d) => (
                      <div key={d.id} className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                        <div className="font-bold text-[#1C1C1C]">{d.name}</div>
                        <div className="text-[10px] text-[#707070] font-mono">[{d.code}]</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Staff Roster */}
              <div>
                <h4 className="font-bold text-[#1C1C1C] mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#2E8B57]" />
                  <span>Assigned Personnel ({selectedBranchDetail.staff.length})</span>
                </h4>
                {selectedBranchDetail.staff.length === 0 ? (
                  <p className="text-[#707070] italic">No staff assigned to this branch.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedBranchDetail.staff.map((s) => (
                      <div key={s.id} className="p-2 rounded-xl bg-white border border-[rgba(45,45,45,0.08)] flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#1C1C1C]">{s.first_name} {s.last_name}</span>
                          <span className="text-[10px] text-[#707070] ml-2">({s.designation} · {s.department || 'General'})</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#2E8B57] font-semibold">${Number(s.base_salary).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[rgba(45,45,45,0.08)]">
              <button
                onClick={() => setSelectedBranchDetail(null)}
                className="px-4 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-semibold hover:bg-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Company Profile Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#C79A3B]" />
                Edit Company Master Profile
              </h3>
              <button
                onClick={() => setEditingCompany(false)}
                className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Company Legal Name *</label>
                <input
                  required
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Company Code / Tax ID</label>
                <input
                  type="text"
                  value={companyForm.code}
                  onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Corporate Email</label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Head Office Phone</label>
                  <input
                    type="text"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#707070] font-semibold mb-1">HQ Physical Address</label>
                <input
                  type="text"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCompany(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
              <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#C79A3B]" />
                Edit Branch: {editingBranch.name}
              </h3>
              <button
                onClick={() => setEditingBranch(null)}
                className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditBranchSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Branch Name *</label>
                <input
                  required
                  type="text"
                  value={branchEditForm.name}
                  onChange={(e) => setBranchEditForm({ ...branchEditForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Branch Code *</label>
                  <input
                    required
                    type="text"
                    value={branchEditForm.code}
                    onChange={(e) => setBranchEditForm({ ...branchEditForm, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Branch Type *</label>
                  <select
                    value={branchEditForm.type}
                    onChange={(e) => setBranchEditForm({ ...branchEditForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  >
                    <option value="RESTAURANT">Restaurant Outlet</option>
                    <option value="HOTEL">Hotel Resort</option>
                    <option value="HYBRID">Hybrid HQ</option>
                    <option value="CENTRAL_STORE">Central Store</option>
                    <option value="DESSERT_KITCHEN">Dessert Kitchen</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[#707070] font-semibold mb-1">Physical Address</label>
                <input
                  type="text"
                  value={branchEditForm.address}
                  onChange={(e) => setBranchEditForm({ ...branchEditForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={branchEditForm.email}
                    onChange={(e) => setBranchEditForm({ ...branchEditForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
                <div>
                  <label className="block text-[#707070] font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={branchEditForm.phone}
                    onChange={(e) => setBranchEditForm({ ...branchEditForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="branch_active"
                  checked={branchEditForm.is_active}
                  onChange={(e) => setBranchEditForm({ ...branchEditForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-[#C79A3B]"
                />
                <label htmlFor="branch_active" className="text-[#1C1C1C] font-semibold">
                  Branch is Active & Operational
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-[#707070] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold disabled:opacity-60"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
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
                      <option value="CENTRAL_STORE">Central Store</option>
                      <option value="DESSERT_KITCHEN">Dessert Kitchen</option>
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

      {/* Delete Branch Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deleteBranchTarget)}
        title="Delete Outlet / Branch"
        message={`Are you sure you want to delete branch "${deleteBranchTarget?.name}"? If this outlet is referenced by warehouses, staff, purchase orders, requisitions, or transactions, backend dependency protection will block destructive deletion.`}
        details={deleteBranchReferences}
        loading={actionLoading}
        onCancel={() => {
          setDeleteBranchTarget(null);
          setDeleteBranchReferences([]);
        }}
        onConfirm={handleDeleteBranch}
      />
    </div>
  );
};

export default OrganizationManager;
