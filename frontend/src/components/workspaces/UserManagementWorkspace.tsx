'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOutlet } from '@/context/OutletContext';
import { usersApi } from '@/api/users';
import { organizationApi } from '@/api/organization';
import {
  ManagedUser,
  UserRoleInfo,
  UserCreatePayload,
  UserUpdatePayload,
  UserManagementSummary,
} from '@/types/user.types';
import { Branch } from '@/types/organization.types';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ChevronDown,
  X,
  UserCheck,
  UserX,
  KeyRound,
  Check,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';

export const UserManagementWorkspace: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { outlets } = useOutlet();

  // Role Gate check
  const currentUserRole = typeof currentUser?.role === 'object' ? currentUser.role.name : (currentUser?.role || '');
  const isAuthorizedAdmin = ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN'].includes(
    currentUserRole.toUpperCase()
  );

  // Core Data States
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<UserRoleInfo[]>([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<UserManagementSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Feedback Notification
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<ManagedUser | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Create Form State
  const [createForm, setCreateForm] = useState<UserCreatePayload>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    branch_ids: [],
    default_branch_id: '',
    password: '',
    is_active: true,
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Edit Form State
  const [editForm, setEditForm] = useState<{
    first_name: string;
    last_name: string;
    phone: string;
    role_id: string;
    branch_ids: string[];
    default_branch_id: string;
    is_active: boolean;
    password: string;
  }>({
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    branch_ids: [],
    default_branch_id: '',
    is_active: true,
    password: '',
  });

  // Fetch all users and metadata
  const fetchData = useCallback(async () => {
    if (!isAuthorizedAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [usersData, rolesData, branchesData, summaryData] = await Promise.all([
        usersApi.getUsers(),
        usersApi.getRoles().catch(() => []),
        organizationApi.getBranches().catch(() => []),
        usersApi.getSummary().catch(() => null),
      ]);

      setUsers(usersData);
      setRoles(rolesData);
      setAvailableBranches(branchesData);
      if (summaryData) {
        setSummary(summaryData);
      }
    } catch (err: any) {
      console.error('[UserManagement] Failed to load data:', err);
      setNotification({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to load user management records from server.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthorizedAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear notification timer
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesUsername = u.username ? u.username.toLowerCase().includes(q) : false;
        const matchesPhone = u.phone ? u.phone.includes(q) : false;
        if (!matchesName && !matchesEmail && !matchesUsername && !matchesPhone) {
          return false;
        }
      }

      // Role Filter
      if (roleFilter !== 'ALL' && u.role_id !== roleFilter) {
        return false;
      }

      // Branch Filter
      if (branchFilter !== 'ALL') {
        const hasBranch = u.branches.some((b) => b.branch_id === branchFilter);
        if (!hasBranch) return false;
      }

      // Status Filter
      if (statusFilter === 'ACTIVE' && !u.is_active) return false;
      if (statusFilter === 'INACTIVE' && u.is_active) return false;

      return true;
    });
  }, [users, searchQuery, roleFilter, branchFilter, statusFilter]);

  // Open Create Modal
  const openCreateModal = () => {
    const defaultRoleId = roles.find((r) => r.name === 'STAFF')?.id || roles[0]?.id || '';
    const allBranchIds = availableBranches.map((b) => b.id);
    const firstBranchId = allBranchIds[0] || '';

    setCreateForm({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role_id: defaultRoleId,
      branch_ids: allBranchIds.length > 0 ? [firstBranchId] : [],
      default_branch_id: firstBranchId,
      password: '',
      is_active: true,
    });
    setShowPassword(false);
    setShowCreateModal(true);
  };

  // Handle User Creation Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email.trim() || !createForm.first_name.trim() || !createForm.role_id) {
      setNotification({
        type: 'error',
        message: 'Please fill in all required fields (Email, First Name, and Role).',
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload: UserCreatePayload = {
        email: createForm.email.trim().toLowerCase(),
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name?.trim() || undefined,
        phone: createForm.phone?.trim() || undefined,
        role_id: createForm.role_id,
        branch_ids: createForm.branch_ids,
        default_branch_id: createForm.default_branch_id || undefined,
        password: createForm.password?.trim() || undefined,
        is_active: createForm.is_active,
      };

      const newUser = await usersApi.createUser(payload);
      setNotification({
        type: 'success',
        message: `User account '${newUser.email}' registered successfully with role '${newUser.role_name}'.`,
      });
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      console.error('[UserManagement] Create Error:', err);
      const detail = err?.response?.data?.detail || err?.response?.data?.message || 'Failed to create user.';
      setNotification({ type: 'error', message: detail });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (user: ManagedUser) => {
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      role_id: user.role_id,
      branch_ids: user.branches.map((b) => b.branch_id),
      default_branch_id: user.branches.find((b) => b.is_default)?.branch_id || user.branches[0]?.branch_id || '',
      is_active: user.is_active,
      password: '',
    });
    setShowPassword(false);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editForm.first_name.trim() || !editForm.role_id) {
      setNotification({
        type: 'error',
        message: 'First name and role assignment are required.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload: UserUpdatePayload = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        role_id: editForm.role_id,
        branch_ids: editForm.branch_ids,
        default_branch_id: editForm.default_branch_id || undefined,
        is_active: editForm.is_active,
        password: editForm.password.trim() || undefined,
      };

      const updated = await usersApi.updateUser(editingUser.id, payload);
      setNotification({
        type: 'success',
        message: `Account '${updated.email}' updated successfully.`,
      });
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      console.error('[UserManagement] Update Error:', err);
      const detail = err?.response?.data?.detail || 'Failed to update user.';
      setNotification({ type: 'error', message: detail });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Deactivate Confirm
  const handleDeactivateConfirm = async () => {
    if (!deactivatingUser) return;

    try {
      setSubmitting(true);
      await usersApi.deactivateUser(deactivatingUser.id);
      setNotification({
        type: 'success',
        message: `User account '${deactivatingUser.email}' has been deactivated (soft-deleted). All audit logs remain intact.`,
      });
      setDeactivatingUser(null);
      fetchData();
    } catch (err: any) {
      console.error('[UserManagement] Deactivate Error:', err);
      const detail = err?.response?.data?.detail || 'Failed to deactivate user.';
      setNotification({ type: 'error', message: detail });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Quick Reactivate
  const handleReactivate = async (user: ManagedUser) => {
    try {
      setLoading(true);
      await usersApi.updateUserStatus(user.id, true);
      setNotification({
        type: 'success',
        message: `User account '${user.email}' reactivated successfully.`,
      });
      fetchData();
    } catch (err: any) {
      console.error('[UserManagement] Reactivate Error:', err);
      const detail = err?.response?.data?.detail || 'Failed to reactivate user.';
      setNotification({ type: 'error', message: detail });
    } finally {
      setLoading(false);
    }
  };

  // Helper for Role Badges
  const renderRoleBadge = (roleName: string) => {
    const r = roleName.toUpperCase();
    if (r.includes('SUPER_ADMIN') || r.includes('SUPERADMIN') || r.includes('OWNER')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#d4a437]/25 to-amber-500/25 text-[#d4a437] border border-[#d4a437]/50 shadow-xs">
          <Sparkles className="w-3 h-3 text-[#d4a437]" />
          SUPER ADMIN
        </span>
      );
    }
    if (r.includes('ADMIN') || r.includes('HQ')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
          <ShieldCheck className="w-3 h-3 text-blue-400" />
          {roleName}
        </span>
      );
    }
    if (r.includes('MANAGER')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <Building2 className="w-3 h-3 text-purple-400" />
          {roleName}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
        <Users className="w-3 h-3 text-zinc-400" />
        {roleName}
      </span>
    );
  };

  // If user is not authorized, render access denied guard
  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#17171b] border border-rose-500/30 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white font-['Outfit']">Administrative Access Required</h2>
            <p className="text-xs text-zinc-400">
              Only Super Administrators and Head Office Admins are authorized to view or manage user accounts and RBAC permissions.
            </p>
          </div>
          <div className="p-3 bg-[#1f1f24] rounded-xl text-[11px] text-zinc-400 font-mono text-left border border-[#26262e]">
            <p className="text-zinc-300 font-bold mb-1">Your Current Session:</p>
            <p>Account: {currentUser?.email || 'Unknown'}</p>
            <p>Role: {currentUserRole || 'RESTRICTED_STAFF'}</p>
            <p className="text-rose-400 mt-1">Status: Insufficient Privileges</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#f3f4f6] p-3 sm:p-5 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Feedback Alert */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-in slide-in-from-top duration-200 shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : notification.type === 'error'
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-[#17171b] border border-[#26262e] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle decorative gold glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#d4a437]/10 to-transparent pointer-events-none rounded-full blur-3xl" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                RBAC Security Engine
              </span>
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-zinc-500" />
                Multi-Tenant Governance
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-['Outfit'] flex items-center gap-2.5">
              Staff & User Management
            </h1>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Create, configure, and audit user access across all 14+ outlets with deterministic RBAC role gating and Google OAuth Single Sign-On.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2.5 sm:px-3 sm:py-2 rounded-xl bg-[#1f1f24] hover:bg-[#282830] text-zinc-300 border border-[#26262e] text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh users list"
            >
              <RefreshCw className={`w-4 h-4 text-[#d4a437] ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a437] to-[#b8862d] text-black font-bold text-xs flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#d4a437]/20"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New User</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Users */}
        <div className="bg-[#17171b] border border-[#26262e] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-[#d4a437]/40 transition-all shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Total Registered</span>
            <Users className="w-4 h-4 text-[#d4a437]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-['Outfit']">
            {summary?.total_users ?? users.length}
          </div>
          <p className="text-[11px] text-zinc-400">All user accounts</p>
        </div>

        {/* Active Accounts */}
        <div className="bg-[#17171b] border border-[#26262e] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-emerald-500/40 transition-all shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Active Accounts</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400 font-['Outfit']">
            {summary?.active_users ?? users.filter((u) => u.is_active).length}
          </div>
          <p className="text-[11px] text-emerald-500/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Fully operational
          </p>
        </div>

        {/* Inactive Accounts */}
        <div className="bg-[#17171b] border border-[#26262e] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-rose-500/40 transition-all shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Inactive / Suspended</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-400 font-['Outfit']">
            {summary?.inactive_users ?? users.filter((u) => !u.is_active).length}
          </div>
          <p className="text-[11px] text-zinc-400">Soft-deleted / disabled</p>
        </div>

        {/* Super Admins & Managers */}
        <div className="bg-[#17171b] border border-[#26262e] rounded-2xl p-4 sm:p-5 space-y-2 hover:border-purple-500/40 transition-all shadow-md">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="font-medium">Admin & Managers</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-400 font-['Outfit']">
            {(summary?.super_admins || 0) + (summary?.admins || 0) + (summary?.managers || 0) ||
              users.filter((u) => u.role_name.includes('ADMIN') || u.role_name.includes('MANAGER')).length}
          </div>
          <p className="text-[11px] text-zinc-400">
            {summary?.super_admins || users.filter((u) => u.role_name.includes('SUPER_ADMIN')).length} Super Admins
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#17171b] border border-[#26262e] rounded-2xl p-3 sm:p-4 space-y-3 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, @username, or phone..."
              className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4a437] focus:ring-1 focus:ring-[#d4a437]/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4a437] transition-all"
            >
              <option value="ALL">All Roles ({roles.length})</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="sm:col-span-4">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#d4a437] transition-all"
            >
              <option value="ALL">All Assigned Outlets ({availableBranches.length})</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.code}] {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Chips & Result Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#26262e]/60 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] font-semibold mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status:
            </span>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-[#d4a437] text-black shadow-xs'
                    : 'bg-[#1f1f24] text-zinc-400 hover:text-zinc-200 border border-[#26262e]'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active Only' : 'Inactive Only'}
              </button>
            ))}
          </div>

          <div className="text-zinc-400 text-[11px]">
            Showing <span className="text-white font-bold">{filteredUsers.length}</span> of {users.length} accounts
          </div>
        </div>
      </div>

      {/* Main Content Area: User Cards Grid & Responsive Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#17171b] border border-[#26262e] rounded-2xl p-5 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#26262e]" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-48 bg-[#26262e] rounded" />
                  <div className="h-3 w-32 bg-[#26262e] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#17171b] border border-[#26262e] rounded-3xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#1f1f24] border border-[#26262e] text-zinc-500 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-white">No Users Found</h3>
            <p className="text-xs text-zinc-400">
              No user accounts match the current filter or search criteria. Try modifying your search or add a new user.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-[#d4a437] text-black font-bold text-xs inline-flex items-center gap-2 hover:brightness-110 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isSelf = Boolean(currentUser && currentUser.id && String(currentUser.id) === String(user.id));
            const userInitial = user.first_name ? user.first_name.charAt(0).toUpperCase() : 'U';

            return (
              <div
                key={user.id}
                className={`bg-[#17171b] border rounded-2xl p-4 sm:p-5 transition-all shadow-md hover:border-[#d4a437]/30 ${
                  !user.is_active ? 'opacity-65 border-rose-500/20 bg-[#141417]' : 'border-[#26262e]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Side: Avatar + Details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* User Avatar */}
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1f1f24] to-[#282830] border border-[#d4a437]/40 flex items-center justify-center font-bold text-base text-[#d4a437] shadow-inner shrink-0">
                      {userInitial}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate font-['Outfit']">
                          {user.first_name} {user.last_name || ''}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-[#d4a437] border border-[#d4a437]/30">
                            YOU
                          </span>
                        )}
                        {renderRoleBadge(user.role_name)}
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            Inactive (Disabled)
                          </span>
                        )}
                      </div>

                      {/* Contact & Meta */}
                      <div className="flex items-center gap-3 sm:gap-4 text-xs text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <Mail className="w-3.5 h-3.5 text-zinc-500" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-zinc-500" />
                            {user.phone}
                          </span>
                        )}
                        {user.username && user.username !== user.email && (
                          <span className="font-mono text-[11px] text-zinc-500">@{user.username}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Assigned Branches Scopes */}
                  <div className="flex-1 lg:max-w-md space-y-1.5 lg:px-4">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
                      <span>Assigned Outlet Scope</span>
                      <span className="text-zinc-400">{user.branches?.length || 0} Outlets</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                      {user.branches && user.branches.length > 0 ? (
                        user.branches.map((ub) => (
                          <span
                            key={ub.id || ub.branch_id}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                              ub.is_default
                                ? 'bg-[#d4a437]/15 text-[#d4a437] border-[#d4a437]/40 font-bold'
                                : 'bg-[#1f1f24] text-zinc-300 border-[#26262e]'
                            }`}
                          >
                            <Building2 className="w-2.5 h-2.5" />
                            [{ub.branch_code}] {ub.branch_name}
                            {ub.is_default && <span className="text-[9px] text-[#d4a437]">★</span>}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-zinc-500 italic">No outlet assigned (HQ Global Scope)</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 border-[#26262e]/60 pt-3 lg:pt-0">
                    <button
                      onClick={() => openEditModal(user)}
                      className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#1f1f24] hover:bg-[#282830] text-zinc-200 border border-[#26262e] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#d4a437]" />
                      <span>Edit</span>
                    </button>

                    {user.is_active ? (
                      <button
                        onClick={() => setDeactivatingUser(user)}
                        disabled={isSelf}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          isSelf
                            ? 'bg-zinc-800/40 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 active:scale-95'
                        }`}
                        title={isSelf ? 'You cannot deactivate your own account' : 'Deactivate user (soft-delete)'}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Deactivate</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(user)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Reactivate</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#17171b] border border-[#26262e] rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl my-auto text-white max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#26262e] pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white font-['Outfit'] flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#d4a437]" />
                  Register New User Account
                </h3>
                <p className="text-xs text-zinc-400">Configure credentials, system role, and multi-outlet scope</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1f1f24] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Google OAuth Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#d4a437]/15 to-amber-500/10 border border-[#d4a437]/30 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#d4a437]">
                <Sparkles className="w-4 h-4" />
                Google OAuth Enabled (Instant SSO)
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                If the email is a Google account, the user can log in immediately via "Sign in with Google" without a manual password.
              </p>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-zinc-300 font-semibold flex items-center gap-1">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="e.g. chef.john@grandheritage.com or john@gmail.com"
                  className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4a437] transition-all"
                />
              </div>

              {/* Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold flex items-center gap-1">
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.first_name}
                    onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                    placeholder="e.g. Biswanath"
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold">Last Name</label>
                  <input
                    type="text"
                    value={createForm.last_name}
                    onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                    placeholder="e.g. Bag"
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                </div>
              </div>

              {/* Phone & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold">Phone Number</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold flex items-center gap-1">
                    System Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={createForm.role_id}
                    onChange={(e) => setCreateForm({ ...createForm, role_id: e.target.value })}
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#d4a437] transition-all"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.description ? `— ${r.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Outlets Selection */}
              <div className="space-y-2 pt-2 border-t border-[#26262e]">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-semibold">Assigned Outlets Scope</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = availableBranches.map((b) => b.id);
                      const isAll = createForm.branch_ids?.length === allIds.length;
                      setCreateForm({
                        ...createForm,
                        branch_ids: isAll ? [] : allIds,
                        default_branch_id: isAll ? '' : allIds[0] || '',
                      });
                    }}
                    className="text-[11px] text-[#d4a437] hover:underline font-semibold"
                  >
                    {createForm.branch_ids?.length === availableBranches.length ? 'Clear All' : 'Select All Outlets'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 bg-[#1f1f24] border border-[#26262e] rounded-xl">
                  {availableBranches.map((b) => {
                    const isChecked = createForm.branch_ids?.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-[#d4a437]/10 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updated = [...(createForm.branch_ids || [])];
                            if (e.target.checked) {
                              updated.push(b.id);
                            } else {
                              updated = updated.filter((id) => id !== b.id);
                            }
                            setCreateForm({
                              ...createForm,
                              branch_ids: updated,
                              default_branch_id:
                                createForm.default_branch_id === b.id
                                  ? updated[0] || ''
                                  : createForm.default_branch_id || updated[0] || '',
                            });
                          }}
                          className="rounded border-zinc-700 bg-zinc-800 text-[#d4a437] focus:ring-0"
                        />
                        <span className="truncate text-[11px]">
                          <span className="font-mono text-[#d4a437]">[{b.code}]</span> {b.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Optional Password */}
              <div className="space-y-1 pt-2 border-t border-[#26262e]">
                <label className="text-zinc-300 font-semibold flex items-center justify-between">
                  <span>Manual Password (Optional)</span>
                  <span className="text-[10px] text-zinc-500">Leave empty for OAuth SSO</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Set optional password (minimum 6 characters)"
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 pr-10 text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#26262e]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1f1f24] hover:bg-[#282830] text-zinc-300 border border-[#26262e] font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4a437] to-[#b8862d] text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#d4a437]/20 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#17171b] border border-[#26262e] rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl my-auto text-white max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#26262e] pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white font-['Outfit'] flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#d4a437]" />
                  Edit User Account: {editingUser.email}
                </h3>
                <p className="text-xs text-zinc-400">Update profile details, role assignment, and outlet scoping</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1f1f24] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold">Last Name</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                </div>
              </div>

              {/* Phone & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300 font-semibold">System Role *</label>
                  <select
                    required
                    value={editForm.role_id}
                    onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#d4a437] transition-all"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Outlets Selection */}
              <div className="space-y-2 pt-2 border-t border-[#26262e]">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-semibold">Assigned Outlets Scope</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = availableBranches.map((b) => b.id);
                      const isAll = editForm.branch_ids.length === allIds.length;
                      setEditForm({
                        ...editForm,
                        branch_ids: isAll ? [] : allIds,
                        default_branch_id: isAll ? '' : allIds[0] || '',
                      });
                    }}
                    className="text-[11px] text-[#d4a437] hover:underline font-semibold"
                  >
                    {editForm.branch_ids.length === availableBranches.length ? 'Clear All' : 'Select All Outlets'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2.5 bg-[#1f1f24] border border-[#26262e] rounded-xl">
                  {availableBranches.map((b) => {
                    const isChecked = editForm.branch_ids.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-[#d4a437]/10 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updated = [...editForm.branch_ids];
                            if (e.target.checked) {
                              updated.push(b.id);
                            } else {
                              updated = updated.filter((id) => id !== b.id);
                            }
                            setEditForm({
                              ...editForm,
                              branch_ids: updated,
                              default_branch_id:
                                editForm.default_branch_id === b.id
                                  ? updated[0] || ''
                                  : editForm.default_branch_id || updated[0] || '',
                            });
                          }}
                          className="rounded border-zinc-700 bg-zinc-800 text-[#d4a437] focus:ring-0"
                        />
                        <span className="truncate text-[11px]">
                          <span className="font-mono text-[#d4a437]">[{b.code}]</span> {b.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-[#1f1f24] border border-[#26262e] rounded-xl">
                <div>
                  <p className="text-zinc-200 font-semibold">Account Status</p>
                  <p className="text-[11px] text-zinc-500">Allow user to sign in to APEX ERP</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    editForm.is_active
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}
                >
                  {editForm.is_active ? 'Active' : 'Disabled'}
                </button>
              </div>

              {/* Reset Password */}
              <div className="space-y-1 pt-2 border-t border-[#26262e]">
                <label className="text-zinc-300 font-semibold flex items-center justify-between">
                  <span>Reset Password (Optional)</span>
                  <span className="text-[10px] text-zinc-500">Leave blank to keep existing password / SSO</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full bg-[#1f1f24] border border-[#26262e] rounded-xl px-3.5 py-2.5 pr-10 text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4a437] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#26262e]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-[#1f1f24] hover:bg-[#282830] text-zinc-300 border border-[#26262e] font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4a437] to-[#b8862d] text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#d4a437]/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE CONFIRMATION MODAL */}
      {deactivatingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[#17171b] border border-rose-500/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl text-white">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white font-['Outfit']">Deactivate User Account?</h3>
              <p className="text-xs text-zinc-300">
                Are you sure you want to deactivate{' '}
                <span className="text-white font-bold">
                  {deactivatingUser.first_name} {deactivatingUser.last_name || ''}
                </span>{' '}
                (<span className="font-mono text-zinc-400">{deactivatingUser.email}</span>)?
              </p>
            </div>

            <div className="p-3 bg-[#1f1f24] rounded-xl border border-[#26262e] text-[11px] text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-300">Soft-Delete Integrity:</p>
              <p>
                The user will be immediately blocked from signing in. All historical audit trails, purchase approvals,
                and closing records will be safely preserved. You can reactivate this user at any time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeactivatingUser(null)}
                className="px-4 py-2 rounded-xl bg-[#1f1f24] hover:bg-[#282830] text-zinc-300 border border-[#26262e] font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeactivateConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50"
              >
                {submitting ? 'Deactivating...' : 'Yes, Deactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementWorkspace;
