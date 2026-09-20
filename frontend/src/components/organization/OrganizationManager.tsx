'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { organizationApi } from '@/api/organization';
import { Branch, Company } from '@/types/organization.types';
import { useOutlet } from '@/context/OutletContext';

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Edit3,
  Link2,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Tags,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

import { MasterVendors } from './masterdata/MasterVendors';
import { MasterCategories } from './masterdata/MasterCategories';
import { MasterUnits } from './masterdata/MasterUnits';
import { MasterItems } from './masterdata/MasterItems';
import { MasterVendorItems } from './masterdata/MasterVendorItems';
import { DeleteBtn } from './masterdata/ui';

type SetupPage =
  | 'home'
  | 'outlets'
  | 'vendors'
  | 'categories'
  | 'units'
  | 'items'
  | 'vendor_items';

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

type DeleteStage = 'confirm' | 'deleting' | 'success';

type PageCard = {
  page: Exclude<SetupPage, 'home'>;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PAGE_CARDS: PageCard[] = [
  {
    page: 'outlets',
    title: 'Outlet Master',
    description: 'Create, edit, activate, deactivate and permanently delete outlets.',
    icon: Building2,
  },
  {
    page: 'vendors',
    title: 'Vendor / Supplier Master',
    description: 'Manage suppliers used by the procurement workflow.',
    icon: Truck,
  },
  {
    page: 'categories',
    title: 'Item Category Master',
    description: 'Manage item classification used by the master catalog.',
    icon: Tags,
  },
  {
    page: 'units',
    title: 'Unit Master',
    description: 'Manage stock units and conversion rules used by the ERP.',
    icon: Scale,
  },
  {
    page: 'items',
    title: 'Item Master',
    description: 'Manage raw material, semi-finished, finished and other item records.',
    icon: Package,
  },
  {
    page: 'vendor_items',
    title: 'Vendor Items & Rates',
    description: 'Manage vendor-item mappings, purchase rates and preferred suppliers.',
    icon: Link2,
  },
];

const OUTLET_TYPES = [
  { value: 'RESTAURANT', label: 'Restaurant Outlet' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'HYBRID', label: 'Hybrid HQ' },
  { value: 'CENTRAL_STORE', label: 'Central Store' },
  { value: 'DESSERT_KITCHEN', label: 'Dessert Kitchen' },
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100';

const getTypeLabel = (type?: string) =>
  OUTLET_TYPES.find((item) => item.value === type)?.label || (type || 'Outlet').replace(/_/g, ' ');

const getTypeClass = (type?: string) => {
  switch (type) {
    case 'CENTRAL_STORE':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'HOTEL':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'HYBRID':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'DESSERT_KITCHEN':
      return 'bg-pink-50 text-pink-700 border-pink-200';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
};

const getCardIconStyle = (page: SetupPage) => {
  switch (page) {
    case 'outlets':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'vendors':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'categories':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'units':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'items':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-orange-50 text-orange-700 border-orange-200';
  }
};

export const OrganizationManager: React.FC = () => {
  const { activeOutlet, refreshOutlets } = useOutlet();

  const [page, setPage] = useState<SetupPage>('home');

  const [company, setCompany] = useState<Company | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateOutlet, setShowCreateOutlet] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Branch | null>(null);
  const [savingOutlet, setSavingOutlet] = useState(false);

  const [outletForm, setOutletForm] = useState({
    name: '',
    code: '',
    type: 'RESTAURANT',
    email: '',
    phone: '',
    address: '',
    is_active: true,
  });

  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleteStage, setDeleteStage] = useState<DeleteStage>('confirm');
  const [deleteError, setDeleteError] = useState('');

  const [editingCompany, setEditingCompany] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    logo_url: '',
  });

  const loadSetupData = useCallback(async () => {
    setLoading(true);

    try {
      const [companyData, branchData] = await Promise.all([
        organizationApi.getCompany().catch(() => null),
        organizationApi.getBranches().catch(() => []),
      ]);

      if (companyData) {
        setCompany(companyData);
        setCompanyForm({
          name: companyData.name || '',
          code: companyData.code || '',
          email: companyData.email || '',
          phone: companyData.phone || '',
          address: companyData.address || '',
          logo_url: companyData.logo_url || '',
        });
      }

      setBranches(Array.isArray(branchData) ? branchData : []);
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.detail || error?.message || 'Failed to load project setup.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSetupData();
  }, [loadSetupData]);

  const activeCount = useMemo(
    () => branches.filter((branch) => branch.is_active).length,
    [branches],
  );

  const inactiveCount = branches.length - activeCount;

  const filteredBranches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return branches;

    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(query) ||
        branch.code.toLowerCase().includes(query) ||
        String(branch.type || '').toLowerCase().includes(query),
    );
  }, [branches, searchQuery]);

  const openPage = (nextPage: Exclude<SetupPage, 'home'>) => {
    setFeedback(null);
    setSearchQuery('');
    setPage(nextPage);
  };

  const goHome = () => {
    setFeedback(null);
    setSearchQuery('');
    setPage('home');
  };

  const openCreateOutlet = () => {
    setOutletForm({
      name: '',
      code: '',
      type: 'RESTAURANT',
      email: '',
      phone: '',
      address: '',
      is_active: true,
    });
    setFeedback(null);
    setShowCreateOutlet(true);
  };

  const openEditOutlet = (branch: Branch) => {
    setOutletForm({
      name: branch.name || '',
      code: branch.code || '',
      type: branch.type || 'RESTAURANT',
      email: branch.email || '',
      phone: branch.phone || '',
      address: branch.address || '',
      is_active: Boolean(branch.is_active),
    });
    setFeedback(null);
    setEditingOutlet(branch);
  };

  const closeOutletForm = () => {
    if (savingOutlet) return;
    setShowCreateOutlet(false);
    setEditingOutlet(null);
  };

  const handleCreateOutlet = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingOutlet(true);
    setFeedback(null);

    try {
      const name = outletForm.name.trim();

      await organizationApi.createBranch({
        name,
        code: outletForm.code.trim().toUpperCase(),
        type: outletForm.type,
        email: outletForm.email.trim(),
        phone: outletForm.phone.trim(),
        address: outletForm.address.trim(),
        is_active: outletForm.is_active,
      });

      closeOutletForm();
      await loadSetupData();
      await refreshOutlets();

      setFeedback({
        type: 'success',
        message: `Outlet "${name}" created successfully.`,
      });
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.detail || error?.message || 'Failed to create outlet.',
      });
    } finally {
      setSavingOutlet(false);
    }
  };

  const handleUpdateOutlet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingOutlet) return;

    setSavingOutlet(true);
    setFeedback(null);

    try {
      const name = outletForm.name.trim();

      await organizationApi.updateBranch(editingOutlet.id, {
        name,
        code: outletForm.code.trim().toUpperCase(),
        type: outletForm.type,
        email: outletForm.email.trim(),
        phone: outletForm.phone.trim(),
        address: outletForm.address.trim(),
        is_active: outletForm.is_active,
      });

      closeOutletForm();
      await loadSetupData();
      await refreshOutlets();

      setFeedback({
        type: 'success',
        message: `Outlet "${name}" updated successfully.`,
      });
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.detail || error?.message || 'Failed to update outlet.',
      });
    } finally {
      setSavingOutlet(false);
    }
  };

  const openDeleteOutlet = (branch: Branch) => {
    setDeleteTarget(branch);
    setDeleteStage('confirm');
    setDeleteError('');
  };

  const closeDeleteOutlet = () => {
    if (deleteStage === 'deleting') return;
    setDeleteTarget(null);
    setDeleteStage('confirm');
    setDeleteError('');
  };

  const handleDeleteOutlet = async () => {
    if (!deleteTarget) return;

    setDeleteStage('deleting');
    setDeleteError('');

    try {
      const deletedName = deleteTarget.name;
      const response: any = await organizationApi.deleteBranch(deleteTarget.id);

      await loadSetupData();
      await refreshOutlets();

      setFeedback({
        type: 'success',
        message: response?.message || `Outlet "${deletedName}" deleted successfully.`,
      });
      setDeleteStage('success');
    } catch (error: any) {
      const detail = error?.response?.data?.detail;

      setDeleteError(
        typeof detail === 'string'
          ? detail
          : detail?.message || error?.message || 'Failed to permanently delete the outlet.',
      );
      setDeleteStage('confirm');
    }
  };

  const handleCompanyUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCompanySaving(true);
    setFeedback(null);

    try {
      const updated = await organizationApi.updateCompany(companyForm);
      setCompany(updated);
      setEditingCompany(false);
      setFeedback({
        type: 'success',
        message: 'Company master updated successfully.',
      });
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.detail || error?.message || 'Failed to update company.',
      });
    } finally {
      setCompanySaving(false);
    }
  };

  const renderFeedback = () => {
    if (!feedback) return null;

    return (
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
          feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}
      >
        <div className="flex items-center gap-2">
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>

        <button
          type="button"
          onClick={() => setFeedback(null)}
          className="rounded-lg p-1 transition hover:bg-black/5"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderHome = () => (
    <div className="min-h-full bg-[#F7F5F1] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {renderFeedback()}

        <div className="rounded-3xl border border-[rgba(45,45,45,0.08)] bg-gradient-to-r from-white via-[#FAF8F5] to-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                <Settings className="h-6 w-6" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-['Outfit'] text-2xl font-bold text-slate-900">
                    Project Setup
                  </h1>

                  {company?.code && (
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700">
                      {company.code}
                    </span>
                  )}
                </div>

                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Central place for the ERP master setup. Open each master as an independent workspace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSetupData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 text-amber-600 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setEditingCompany(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Settings className="h-4 w-4 text-amber-600" />
                Company Master
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Master Workspaces</h2>
            <p className="mt-1 text-xs text-slate-500">
              Select a master below. Each one opens as a dedicated workspace.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {PAGE_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <button
                  key={card.page}
                  type="button"
                  onClick={() => openPage(card.page)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${getCardIconStyle(card.page)}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-slate-900">
                        {card.title}
                      </h2>
                      <span className="hidden rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 sm:inline-flex">
                        Master
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {card.description}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-semibold text-slate-300 transition group-hover:translate-x-1 group-hover:text-amber-600">
                    →
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 border-t border-slate-200 bg-slate-50/60 sm:grid-cols-3">
            <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Outlets</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-['Outfit'] text-xl font-bold text-slate-900">{branches.length}</span>
                <span className="text-[10px] text-emerald-700">{activeCount} active</span>
              </div>
            </div>

            <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Inactive Outlets</p>
              <div className="mt-1 font-['Outfit'] text-xl font-bold text-slate-700">{inactiveCount}</div>
            </div>

            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Master Workspaces</p>
              <div className="mt-1 font-['Outfit'] text-xl font-bold text-slate-900">{PAGE_CARDS.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPageHeader = (title: string, description: string, Icon: React.ComponentType<{ className?: string }>) => (
    <>
      {renderFeedback()}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goHome}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Back to Project Setup"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <Icon className="h-5 w-5" />
            </div>

            <div>
              <h1 className="font-['Outfit'] text-lg font-bold text-slate-900">{title}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSetupData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-amber-600 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {page === 'outlets' && (
              <button
                type="button"
                onClick={openCreateOutlet}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                New Outlet
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderOutletWorkspace = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Outlets</p>
          <p className="mt-1 font-['Outfit'] text-2xl font-bold text-slate-900">{branches.length}</p>
          <p className="mt-1 text-[10px] font-medium text-emerald-700">{activeCount} Active Outlets</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
          <p className="mt-1 font-['Outfit'] text-2xl font-bold text-emerald-700">{activeCount}</p>
          <p className="mt-1 text-[10px] text-slate-500">Operational outlets</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inactive</p>
          <p className="mt-1 font-['Outfit'] text-2xl font-bold text-slate-700">{inactiveCount}</p>
          <p className="mt-1 text-[10px] text-slate-500">Inactive records</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Outlet Directory</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {filteredBranches.length} outlet{filteredBranches.length === 1 ? '' : 's'} shown
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search outlet name, code or type..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">Loading outlets...</p>
            <p className="text-xs text-slate-500">Synchronizing live master data.</p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <Building2 className="mb-3 h-10 w-10 text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">No outlets found</p>
            <p className="mt-1 text-xs text-slate-500">Create a new outlet or change your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[1.6fr_1fr_1.15fr_1.7fr_1.25fr] items-center border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <div>Outlet</div>
                <div>Type</div>
                <div>Contact</div>
                <div>Location</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredBranches.map((branch) => {
                  const isCurrent = activeOutlet?.id === branch.id;

                  return (
                    <div
                      key={branch.id}
                      className={`grid grid-cols-[1.6fr_1fr_1.15fr_1.7fr_1.25fr] items-center px-5 py-4 transition ${
                        isCurrent ? 'bg-amber-50/40' : 'bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-900">
                            {branch.name}
                          </h3>

                          {isCurrent && (
                            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <p className="mt-1 font-mono text-[10px] text-amber-700">{branch.code}</p>
                      </div>

                      <div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getTypeClass(branch.type)}`}
                        >
                          {getTypeLabel(branch.type)}
                        </span>
                      </div>

                      <div className="space-y-1 text-[10px] text-slate-500">
                        {branch.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{branch.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">No phone</span>
                        )}

                        {branch.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{branch.email}</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0 text-amber-600" />
                        <span className="truncate">{branch.address || 'Address not set'}</span>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditOutlet(branch)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>

                        <DeleteBtn onClick={() => openDeleteOutlet(branch)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSelectedWorkspace = () => {
    switch (page) {
      case 'outlets':
        return renderOutletWorkspace();
      case 'vendors':
        return <MasterVendors />;
      case 'categories':
        return <MasterCategories />;
      case 'units':
        return <MasterUnits />;
      case 'items':
        return <MasterItems />;
      case 'vendor_items':
        return <MasterVendorItems />;
      default:
        return null;
    }
  };

  if (page === 'home') {
    return (
      <>
        {renderHome()}

        {editingCompany && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Company Master</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Update the company profile used by the ERP.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingCompany(false)}
                  disabled={companySaving}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCompanyUpdate} className="space-y-4 p-5">
                <input
                  required
                  value={companyForm.name}
                  onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })}
                  className={inputClass}
                  placeholder="Company Name"
                />

                <input
                  required
                  value={companyForm.code}
                  onChange={(event) => setCompanyForm({ ...companyForm, code: event.target.value })}
                  className={inputClass}
                  placeholder="Company Code"
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(event) => setCompanyForm({ ...companyForm, email: event.target.value })}
                    className={inputClass}
                    placeholder="Email"
                  />

                  <input
                    value={companyForm.phone}
                    onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })}
                    className={inputClass}
                    placeholder="Phone"
                  />
                </div>

                <textarea
                  rows={3}
                  value={companyForm.address}
                  onChange={(event) => setCompanyForm({ ...companyForm, address: event.target.value })}
                  className={inputClass}
                  placeholder="Address"
                />

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingCompany(false)}
                    disabled={companySaving}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={companySaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {companySaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {companySaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  const currentPageCard = PAGE_CARDS.find((item) => item.page === page);
  if (!currentPageCard) {
    return null;
  }

  const CurrentIcon = currentPageCard.icon;

  return (
    <>
      <div className="min-h-full bg-[#F7F5F1] p-4 md:p-6">
        <div className="mx-auto max-w-[1500px] space-y-5">
          {renderFeedback()}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
                  <CurrentIcon className="h-5 w-5" />
                </div>

                <div>
                  <h1 className="font-['Outfit'] text-lg font-bold text-slate-900">{currentPageCard.title}</h1>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {currentPageCard.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goHome}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Project Setup
                </button>

                <button
                  type="button"
                  onClick={loadSetupData}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-amber-600 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>

                {page === 'outlets' && (
                  <button
                    type="button"
                    onClick={openCreateOutlet}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Outlet
                  </button>
                )}
              </div>
            </div>
          </div>

          {page === 'outlets' ? (
            renderOutletWorkspace()
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <div className="min-h-[620px] rounded-xl bg-white">
                {page === 'vendors' && <MasterVendors />}
                {page === 'categories' && <MasterCategories />}
                {page === 'units' && <MasterUnits />}
                {page === 'items' && <MasterItems />}
                {page === 'vendor_items' && <MasterVendorItems />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Outlet */}
      {showCreateOutlet && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create New Outlet</h3>
                <p className="mt-0.5 text-xs text-slate-500">Add the outlet to the organization master.</p>
              </div>

              <button
                type="button"
                onClick={closeOutletForm}
                disabled={savingOutlet}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOutlet} className="space-y-4 p-5">
              <input
                required
                value={outletForm.name}
                onChange={(event) => setOutletForm({ ...outletForm, name: event.target.value })}
                placeholder="Outlet Name"
                className={inputClass}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  required
                  value={outletForm.code}
                  onChange={(event) => setOutletForm({ ...outletForm, code: event.target.value })}
                  placeholder="Outlet Code"
                  className={inputClass}
                />

                <select
                  required
                  value={outletForm.type}
                  onChange={(event) => setOutletForm({ ...outletForm, type: event.target.value })}
                  className={inputClass}
                >
                  {OUTLET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={outletForm.address}
                onChange={(event) => setOutletForm({ ...outletForm, address: event.target.value })}
                placeholder="Address"
                className={inputClass}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  type="email"
                  value={outletForm.email}
                  onChange={(event) => setOutletForm({ ...outletForm, email: event.target.value })}
                  placeholder="Email"
                  className={inputClass}
                />

                <input
                  value={outletForm.phone}
                  onChange={(event) => setOutletForm({ ...outletForm, phone: event.target.value })}
                  placeholder="Phone"
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={outletForm.is_active}
                  onChange={(event) => setOutletForm({ ...outletForm, is_active: event.target.checked })}
                  className="h-4 w-4 rounded"
                />
                <span className="text-xs font-medium text-slate-800">Outlet is active</span>
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeOutletForm}
                  disabled={savingOutlet}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingOutlet}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingOutlet && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {savingOutlet ? 'Creating...' : 'Create Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Outlet */}
      {editingOutlet && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Outlet</h3>
                <p className="mt-0.5 text-xs text-slate-500">Update the selected outlet master record.</p>
              </div>

              <button
                type="button"
                onClick={closeOutletForm}
                disabled={savingOutlet}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOutlet} className="space-y-4 p-5">
              <input
                required
                value={outletForm.name}
                onChange={(event) => setOutletForm({ ...outletForm, name: event.target.value })}
                placeholder="Outlet Name"
                className={inputClass}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  required
                  value={outletForm.code}
                  onChange={(event) => setOutletForm({ ...outletForm, code: event.target.value })}
                  placeholder="Outlet Code"
                  className={inputClass}
                />

                <select
                  required
                  value={outletForm.type}
                  onChange={(event) => setOutletForm({ ...outletForm, type: event.target.value })}
                  className={inputClass}
                >
                  {OUTLET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={outletForm.address}
                onChange={(event) => setOutletForm({ ...outletForm, address: event.target.value })}
                placeholder="Address"
                className={inputClass}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  type="email"
                  value={outletForm.email}
                  onChange={(event) => setOutletForm({ ...outletForm, email: event.target.value })}
                  placeholder="Email"
                  className={inputClass}
                />

                <input
                  value={outletForm.phone}
                  onChange={(event) => setOutletForm({ ...outletForm, phone: event.target.value })}
                  placeholder="Phone"
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={outletForm.is_active}
                  onChange={(event) => setOutletForm({ ...outletForm, is_active: event.target.checked })}
                  className="h-4 w-4 rounded"
                />
                <span className="text-xs font-medium text-slate-800">Outlet is active</span>
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeOutletForm}
                  disabled={savingOutlet}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingOutlet}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingOutlet && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {savingOutlet ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company Master */}
      {editingCompany && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Company Master</h3>
                <p className="mt-0.5 text-xs text-slate-500">Update the company profile used by the ERP.</p>
              </div>

              <button
                type="button"
                onClick={() => setEditingCompany(false)}
                disabled={companySaving}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCompanyUpdate} className="space-y-4 p-5">
              <input
                required
                value={companyForm.name}
                onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })}
                className={inputClass}
                placeholder="Company Name"
              />

              <input
                required
                value={companyForm.code}
                onChange={(event) => setCompanyForm({ ...companyForm, code: event.target.value })}
                className={inputClass}
                placeholder="Company Code"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  type="email"
                  value={companyForm.email}
                  onChange={(event) => setCompanyForm({ ...companyForm, email: event.target.value })}
                  className={inputClass}
                  placeholder="Email"
                />

                <input
                  value={companyForm.phone}
                  onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })}
                  className={inputClass}
                  placeholder="Phone"
                />
              </div>

              <textarea
                rows={3}
                value={companyForm.address}
                onChange={(event) => setCompanyForm({ ...companyForm, address: event.target.value })}
                className={inputClass}
                placeholder="Address"
              />

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingCompany(false)}
                  disabled={companySaving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={companySaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {companySaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {companySaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && deleteStage === 'confirm' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Delete Outlet Permanently</h3>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-700">
                  You are about to permanently delete
                  <span className="font-semibold text-slate-900"> “{deleteTarget.name}”</span>.
                </p>
                <p className="mt-1 text-xs text-slate-500">Only the selected outlet is targeted.</p>
              </div>

              {deleteError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteOutlet}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDeleteOutlet}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Loading */}
      {deleteTarget && deleteStage === 'deleting' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 px-6 py-8 text-center text-white shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
              <RefreshCw className="h-7 w-7 animate-spin text-rose-400" />
            </div>

            <h3 className="mt-5 text-lg font-semibold">Deleting Outlet...</h3>
            <p className="mt-2 text-sm text-slate-300">
              Permanently deleting “{deleteTarget.name}”. Please wait.
            </p>

            <div className="mx-auto mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-700">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-rose-500" />
            </div>

            <p className="mt-3 text-xs text-slate-400">Do not close or refresh this page.</p>
          </div>
        </div>
      )}

      {/* Delete Success */}
      {deleteTarget && deleteStage === 'success' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white px-6 py-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <h3 className="mt-5 text-lg font-semibold text-slate-900">Delete Successful</h3>
            <p className="mt-2 text-sm text-slate-500">
              “{deleteTarget.name}” has been permanently deleted.
            </p>

            <button
              type="button"
              onClick={closeDeleteOutlet}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default OrganizationManager;
