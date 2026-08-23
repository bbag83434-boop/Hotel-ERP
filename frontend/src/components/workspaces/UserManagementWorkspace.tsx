'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOutlet } from '@/context/OutletContext';
import { userApi } from '@/api/users';
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
  AlertCircle,
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<ManagedUser | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Create User Form State
  const [createEmail, setCreateEmail] = useState<string>('');
  const [createFirstName, setCreateFirstName] = useState<string>('');
  const [createLastName, setCreateLastName] = useState<string>('');
  const [createUsername, setCreateUsername] = useState<string>('');
  const [createPhone, setCreatePhone] = useState<string>('');
  const [createRoleId, setCreateRoleId] = useState<string>('');
  const [createSelectedBranchIds, setCreateSelectedBranchIds] = useState<string[]>([]);
  const [createDefaultBranchId, setCreateDefaultBranchId] = useState<string>('');
  const [createPassword, setCreatePassword] = useState<string>('');
  const [createShowPassword, setCreateShowPassword] = useState<boolean>(false);
  const [createIsActive, setCreateIsActive] = useState<boolean>(true);

  // Edit User Form State
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRoleId, setEditRoleId] = useState<string>('');
  const [editSelectedBranchIds, setEditSelectedBranchIds] = useState<string[]>([]);
  const [editDefaultBranchId, setEditDefaultBranchId] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editShowPassword, setEditShowPassword] = useState<boolean>(false);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Auto-dismiss success feedback
  useEffect(() => {
    if (feedback?.type === 'success') {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load all initial dependencies
  const loadData = useCallback(async () => {
    if (!isAuthorizedAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [fetchedUsers, fetchedRoles, fetchedBranches, fetchedSummary] = await Promise.allSettled([
        userApi.getUsers(),
        userApi.getRoles(),
        organizationApi.getBranches(),
        userApi.getSummary(),
      ]);

      if (fetchedUsers.status === 'fulfilled') {
        setUsers(fetchedUsers.value || []);
      }
      if (fetchedRoles.status === 'fulfilled') {
        setRoles(fetchedRoles.value || []);
        if (fetchedRoles.value?.length > 0 && !createRoleId) {
          const defaultRole = fetchedRoles.value.find((r) => r.name === 'OUTLET_MANAGER') || fetchedRoles.value[0];
          setCreateRoleId(defaultRole.id);
        }
      }
      if (fetchedBranches.status === 'fulfilled') {
        setAvailableBranches(fetchedBranches.value || []);
      }
      if (fetchedSummary.status === 'fulfilled') {
        setSummary(fetchedSummary.value);
      }
    } catch (err: any) {
      console.error('Failed to load user management data:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to initialize user management data.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthorizedAdmin, createRoleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        if (
          !fullName.includes(query) &&
          !email.includes(query) &&
          !username.includes(query) &&
          !phone.includes(query)
        ) {
          return false;
        }
      }

      // Role Filter
      if (selectedRoleFilter !== 'ALL' && u.role_id !== selectedRoleFilter && u.role_name !== selectedRoleFilter) {
        return false;
      }

      // Outlet/Branch Filter
      if (selectedBranchFilter !== 'ALL') {
        const hasBranch = (u.branches || []).some((b) => b.branch_id === selectedBranchFilter);
        if (!hasBranch) return false;
      }

      // Status Filter
      if (selectedStatusFilter === 'ACTIVE' && !u.is_active) return false;
      if (selectedStatusFilter === 'INACTIVE' && u.is_active) return false;

      return true;
    });
  }, [users, searchQuery, selectedRoleFilter, selectedBranchFilter, selectedStatusFilter]);

  // Open Create User Modal
  const openCreateModal = () => {
    setCreateEmail('');
    setCreateFirstName('');
    setCreateLastName('');
    setCreateUsername('');
    setCreatePhone('');
    setCreatePassword('');
    setCreateShowPassword(false);
    setCreateIsActive(true);

    if (roles.length > 0) {
      const defaultRole = roles.find((r) => r.name === 'OUTLET_MANAGER') || roles[0];
      setCreateRoleId(defaultRole.id);
    }

    if (availableBranches.length > 0) {
      setCreateSelectedBranchIds([availableBranches[0].id]);
      setCreateDefaultBranchId(availableBranches[0].id);
    } else {
      setCreateSelectedBranchIds([]);
      setCreateDefaultBranchId('');
    }

    setCreateModalOpen(true);
  };

  // Open Edit User Modal
  const openEditModal = (targetUser: ManagedUser) => {
    setEditingUser(targetUser);
    setEditFirstName(targetUser.first_name || '');
    setEditLastName(targetUser.last_name || '');
    setEditPhone(targetUser.phone || '');
    setEditRoleId(targetUser.role_id || '');
    setEditIsActive(targetUser.is_active);
    setEditPassword('');
    setEditShowPassword(false);

    const userBranchIds = (targetUser.branches || []).map((b) => b.branch_id);
    const defBranch = (targetUser.branches || []).find((b) => b.is_default);
    setEditSelectedBranchIds(userBranchIds);
    setEditDefaultBranchId(defBranch ? defBranch.branch_id : userBranchIds[0] || '');

    setEditModalOpen(true);
  };

  // Submit Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim()) {
      setFeedback({ type: 'error', message: 'Email address is required.' });
      return;
    }
    if (!createFirstName.trim()) {
      setFeedback({ type: 'error', message: 'First name is required.' });
      return;
    }
    if (!createRoleId) {
      setFeedback({ type: 'error', message: 'Please select a system role.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: UserCreatePayload = {
        email: createEmail.trim().toLowerCase(),
        first_name: createFirstName.trim(),
        last_name: createLastName.trim() || undefined,
        username: createUsername.trim() || createEmail.trim().split('@')[0],
        phone: createPhone.trim() || undefined,
        role_id: createRoleId,
        branch_ids: createSelectedBranchIds,
        default_branch_id: createDefaultBranchId || createSelectedBranchIds[0] || undefined,
        password: createPassword.trim() || undefined,
        is_active: createIsActive,
      };

      const newUser = await userApi.createUser(payload);
      setFeedback({
        type: 'success',
        message: `User ${newUser.email} created successfully with role ${newUser.role_name}. Google OAuth login is active.`,
      });
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to create user:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Failed to create user account.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editFirstName.trim()) {
      setFeedback({ type: 'error', message: 'First name cannot be empty.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload: UserUpdatePayload = {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim() || undefined,
        phone: editPhone.trim() || undefined,
        role_id: editRoleId || undefined,
        branch_ids: editSelectedBranchIds,
        default_branch_id: editDefaultBranchId || editSelectedBranchIds[0] || undefined,
        is_active: editIsActive,
        password: editPassword.trim() || undefined,
      };

      await userApi.updateUser(editingUser.id, payload);
      setFeedback({
        type: 'success',
        message: `User ${editingUser.email} profile and permissions updated.`,
      });
      setEditModalOpen(false);
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Failed to update user account.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Soft-Delete / Deactivate User
  const handleConfirmDeactivate = async () => {
    if (!deactivatingUser) return;
    setSubmitting(true);
    try {
      await userApi.deactivateUser(deactivatingUser.id);
      setFeedback({
        type: 'success',
        message: `User ${deactivatingUser.email} deactivated. Account is disabled while all audit logs and historical transactions remain intact.`,
      });
      setDeactivatingUser(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to deactivate user:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Failed to deactivate user.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // One-click Reactivate
  const handleReactivateUser = async (targetUser: ManagedUser) => {
    try {
      await userApi.toggleUserStatus(targetUser.id, true);
      setFeedback({
        type: 'success',
        message: `User ${targetUser.email} has been reactivated successfully.`,
      });
      loadData();
    } catch (err: any) {
      console.error('Failed to reactivate user:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Failed to reactivate user.',
      });
    }
  };

  // Branch Selection Helpers
  const toggleBranchSelection = (
    branchId: string,
    currentSelected: string[],
    setSelected: (arr: string[]) => void,
    defaultBranch: string,
    setDefaultBranch: (id: string) => void
  ) => {
    if (currentSelected.includes(branchId)) {
      const next = currentSelected.filter((id) => id !== branchId);
      setSelected(next);
      if (defaultBranch === branchId) {
        setDefaultBranch(next[0] || '');
      }
    } else {
      const next = [...currentSelected, branchId];
      setSelected(next);
      if (!defaultBranch) {
        setDefaultBranch(branchId);
      }
    }
  };

  const selectAllBranches = (
    setSelected: (arr: string[]) => void,
    setDefaultBranch: (id: string) => void
  ) => {
    const allIds = availableBranches.map((b) => b.id);
    setSelected(allIds);
    if (allIds.length > 0) {
      setDefaultBranch(allIds[0]);
    }
  };

  // Role Badge Formatter
  const renderRoleBadge = (roleName: string) => {
    const norm = roleName.toUpperCase();
    if (norm.includes('SUPER') || norm.includes('OWNER')) {
      return (
        <span className="font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30">
          <Sparkles className="w-2.5 h-2.5" />
          {roleName}
        </span>
      );
    }
    if (norm.includes('ADMIN') || norm.includes('HQ')) {
      return (
        <span className="font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-2.5 h-2.5" />
          {roleName}
        </span>
      );
    }
    if (norm.includes('MANAGER')) {
      return (
        <span className="font-bold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-200">
          <Building2 className="w-2.5 h-2.5" />
          {roleName}
        </span>
      );
    }
    return (
      <span className="font-semibold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200">
        <Users className="w-2.5 h-2.5" />
        {roleName}
      </span>
    );
  };

  // Unauthorized Access Guard
  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-600">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#1C1C1C] font-['Outfit']">Access Restricted</h2>
            <p className="text-xs text-[#707070] leading-relaxed">
              You must have <strong className="text-[#1C1C1C]">SUPER_ADMIN</strong> or <strong className="text-[#1C1C1C]">HQ_ADMIN</strong> privileges to manage user accounts and system roles.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* ========================================================================= */}
      {/* 1. TOP WORKSPACE HEADER                                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-[rgba(45,45,45,0.08)] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1C] font-['Outfit'] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#C79A3B]" />
              User & Admin Management
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] text-[#B8862D] font-bold border border-[rgba(45,45,45,0.1)]">
              RBAC Scope
            </span>
          </div>
          <p className="text-xs text-[#707070] mt-0.5">
            Provision staff profiles, assign multi-outlet operational scopes, manage roles, and configure Google OAuth SSO access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={loading || refreshing}
            className="p-2.5 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-[#707070] hover:text-[#1C1C1C] transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#B8862D]' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4 text-[#C79A3B]" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FEEDBACK ALERT BANNER                                                  */}
      {/* ========================================================================= */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold shadow-xs ${
            feedback.type === 'success'
              ? 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20'
              : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2E8B57]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded-md hover:bg-black/5 text-[#707070] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. KPI SUMMARY STRIP (4 Stat Cards)                                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Users */}
        <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4 sm:p-5 shadow-xs hover:border-[#C79A3B]/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Total Personnel</span>
            <div className="p-2 rounded-xl bg-[#FAF8F5] text-[#B8862D] border border-[rgba(45,45,45,0.08)]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit']">
            {summary?.total_users ?? users.length}
          </div>
          <div className="text-xs text-[#707070] mt-1">Company-wide registered accounts</div>
        </div>

        {/* Metric 2: Active Accounts */}
        <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4 sm:p-5 shadow-xs hover:border-[#C79A3B]/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Active Logins</span>
            <div className="p-2 rounded-xl bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit']">
            {summary?.active_users ?? users.filter((u) => u.is_active).length}
          </div>
          <div className="text-xs text-[#2E8B57] font-medium mt-1">Operational SSO Access</div>
        </div>

        {/* Metric 3: Administrators */}
        <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4 sm:p-5 shadow-xs hover:border-[#C79A3B]/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Super / HQ Admin</span>
            <div className="p-2 rounded-xl bg-[#F1E4C5]/60 text-[#B8862D] border border-[#B8862D]/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit']">
            {(summary?.super_admins || 0) + (summary?.admins || 0)}
          </div>
          <div className="text-xs text-[#707070] mt-1">Executive Governance</div>
        </div>

        {/* Metric 4: Outlet Managers & Staff */}
        <div className="bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] p-4 sm:p-5 shadow-xs hover:border-[#C79A3B]/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">Managers & Staff</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] font-['Outfit']">
            {(summary?.managers || 0) + (summary?.staff || 0)}
          </div>
          <div className="text-xs text-[#707070] mt-1">Outlet Scoped Personnel</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SEARCH & FILTER TOOLBAR                                                */}
      {/* ========================================================================= */}
      <div className="bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#707070] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, email, @username, or phone..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] focus:ring-1 focus:ring-[#C79A3B]/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#1C1C1C]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <div className="flex items-center gap-1.5 min-w-[150px]">
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Outlet Filter */}
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all"
              >
                <option value="ALL">All Outlets Scope</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    [{b.code}] {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] rounded-xl">
              <button
                onClick={() => setSelectedStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedStatusFilter === 'ALL'
                    ? 'bg-white text-[#1C1C1C] shadow-xs'
                    : 'text-[#707070] hover:text-[#1C1C1C]'
                }`}
              >
                All ({users.length})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedStatusFilter === 'ACTIVE'
                    ? 'bg-[#2E8B57]/15 text-[#2E8B57] shadow-xs'
                    : 'text-[#707070] hover:text-[#1C1C1C]'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setSelectedStatusFilter('INACTIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedStatusFilter === 'INACTIVE'
                    ? 'bg-red-100 text-red-700 shadow-xs'
                    : 'text-[#707070] hover:text-[#1C1C1C]'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Filter Summary Results Note */}
        <div className="flex items-center justify-between text-xs text-[#707070] pt-1">
          <span>
            Showing <strong className="text-[#1C1C1C]">{filteredUsers.length}</strong> of {users.length} users
          </span>
          {(searchQuery || selectedRoleFilter !== 'ALL' || selectedBranchFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRoleFilter('ALL');
                setSelectedBranchFilter('ALL');
                setSelectedStatusFilter('ALL');
              }}
              className="text-[#B8862D] hover:underline font-bold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. USER CARDS LIST / TABLE VIEW                                           */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-white border border-[rgba(45,45,45,0.08)] rounded-2xl p-5 animate-pulse flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FAF8F5]" />
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-[#FAF8F5] rounded" />
                  <div className="h-3 w-60 bg-[#FAF8F5] rounded" />
                </div>
              </div>
              <div className="h-8 w-24 bg-[#FAF8F5] rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] text-[#C79A3B] flex items-center justify-center mx-auto border border-[rgba(45,45,45,0.06)]">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">No Personnel Found</h4>
          <p className="text-xs text-[#707070] max-w-sm mx-auto">
            There are no users matching your active filters. Clear search or click "+ Add New User" to register personnel.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-[#1C1C1C] text-white text-xs font-bold hover:bg-[#2D2D2D] transition-all shadow-xs"
          >
            Add New User
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
                className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all shadow-xs hover:border-[#C79A3B]/40 hover:shadow-md ${
                  !user.is_active ? 'opacity-70 bg-[#FAF8F5]/80 border-red-200' : 'border-[rgba(45,45,45,0.08)]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Side: Avatar + Details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* User Avatar */}
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FAF8F5] to-[#F1E4C5]/40 border border-[#B8862D]/30 flex items-center justify-center font-bold text-base text-[#B8862D] shadow-xs shrink-0">
                      {userInitial}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#1C1C1C] truncate font-['Outfit']">
                          {user.first_name} {user.last_name || ''}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30">
                            YOU
                          </span>
                        )}
                        {renderRoleBadge(user.role_name)}
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2E8B57] px-2 py-0.5 rounded-full bg-[#2E8B57]/15 border border-[#2E8B57]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 px-2 py-0.5 rounded-full bg-red-100 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            Inactive (Disabled)
                          </span>
                        )}
                      </div>

                      {/* Contact & Meta */}
                      <div className="flex items-center gap-3 sm:gap-4 text-xs text-[#707070] flex-wrap">
                        <span className="flex items-center gap-1.5 text-[#1C1C1C]">
                          <Mail className="w-3.5 h-3.5 text-[#707070]" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#707070]" />
                            {user.phone}
                          </span>
                        )}
                        {user.username && user.username !== user.email && (
                          <span className="font-mono text-[11px] text-[#707070]">@{user.username}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Assigned Branches Scopes */}
                  <div className="flex-1 lg:max-w-md space-y-1.5 lg:px-4">
                    <div className="flex items-center justify-between text-[11px] text-[#707070] font-semibold">
                      <span>Assigned Outlet Scope</span>
                      <span className="text-[#1C1C1C] font-bold">{user.branches?.length || 0} Outlets</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                      {user.branches && user.branches.length > 0 ? (
                        user.branches.map((ub) => (
                          <span
                            key={ub.id || ub.branch_id}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                              ub.is_default
                                ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/40 font-bold'
                                : 'bg-[#FAF8F5] text-[#707070] border-[rgba(45,45,45,0.08)]'
                            }`}
                          >
                            <Building2 className="w-2.5 h-2.5" />
                            [{ub.branch_code}] {ub.branch_name}
                            {ub.is_default && <span className="text-[9px] text-[#B8862D]">★</span>}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-[#707070] italic">No outlet assigned (HQ Global Scope)</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 border-[rgba(45,45,45,0.06)] pt-3 lg:pt-0">
                    <button
                      onClick={() => openEditModal(user)}
                      className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#1C1C1C] border border-[rgba(45,45,45,0.15)] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98]"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#B8862D]" />
                      <span>Edit</span>
                    </button>

                    {user.is_active ? (
                      <button
                        onClick={() => setDeactivatingUser(user)}
                        disabled={isSelf}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isSelf
                            ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                            : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-[0.98]'
                        }`}
                        title={isSelf ? 'You cannot deactivate your own account' : 'Deactivate user (soft-delete)'}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Deactivate</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivateUser(user)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all bg-[#2E8B57]/15 text-[#2E8B57] border border-[#2E8B57]/30 hover:bg-[#2E8B57]/25 active:scale-[0.98]"
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

      {/* ========================================================================= */}
      {/* 6. CREATE USER MODAL                                                      */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
              <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2 font-['Outfit']">
                <UserPlus className="w-5 h-5 text-[#C79A3B]" />
                Add New Staff / Admin User
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Google OAuth Help Banner */}
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex items-start gap-3 text-xs">
              <Sparkles className="w-4 h-4 text-[#B8862D] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-[#1C1C1C]">Google OAuth Single Sign-On Supported</p>
                <p className="text-[#707070] leading-relaxed">
                  Enter the staff member's Google account email. Once created, they can immediately log in via <strong className="text-[#1C1C1C]">"Sign in with Google"</strong> without needing a manual password.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Email & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="user@cbhotels.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] focus:ring-1 focus:ring-[#C79A3B]/30 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    System Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={createRoleId}
                    onChange={(e) => setCreateRoleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.description ? `— ${r.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createFirstName}
                    onChange={(e) => setCreateFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={createLastName}
                    onChange={(e) => setCreateLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] transition-all"
                  />
                </div>
              </div>

              {/* Username & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    Username (Optional)
                  </label>
                  <input
                    type="text"
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] transition-all"
                  />
                </div>
              </div>

              {/* Password (Optional for Local Auth) */}
              <div>
                <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                  Manual Password (Optional — Leave blank for Google OAuth login only)
                </label>
                <div className="relative">
                  <input
                    type={createShowPassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium placeholder:text-[#707070]/60 focus:outline-none focus:border-[#C79A3B] transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateShowPassword(!createShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#1C1C1C]"
                  >
                    {createShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Multi-Outlet Assignment Section */}
              <div className="space-y-2 border-t border-[rgba(45,45,45,0.06)] pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider block">
                    Assigned Outlets Scope ({createSelectedBranchIds.length} Selected)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      selectAllBranches(setCreateSelectedBranchIds, setCreateDefaultBranchId)
                    }
                    className="text-[11px] text-[#B8862D] font-bold hover:underline"
                  >
                    Select All Outlets
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                  {availableBranches.map((branch) => {
                    const isChecked = createSelectedBranchIds.includes(branch.id);
                    const isDefault = createDefaultBranchId === branch.id;

                    return (
                      <div
                        key={branch.id}
                        onClick={() =>
                          toggleBranchSelection(
                            branch.id,
                            createSelectedBranchIds,
                            setCreateSelectedBranchIds,
                            createDefaultBranchId,
                            setCreateDefaultBranchId
                          )
                        }
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-white border-[#B8862D]/50 text-[#1C1C1C] shadow-xs'
                            : 'bg-white/50 border-[rgba(45,45,45,0.08)] text-[#707070] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isChecked
                                ? 'bg-[#B8862D] border-[#B8862D] text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate font-medium text-[11px]">
                            [{branch.code}] {branch.name}
                          </span>
                        </div>

                        {isChecked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateDefaultBranchId(branch.id);
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all ${
                              isDefault
                                ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/40'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {isDefault ? 'Default ★' : 'Set Default'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                <div className="space-y-0.5">
                  <span className="font-bold text-[#1C1C1C] text-xs">Account Status</span>
                  <p className="text-[11px] text-[#707070]">Allow immediate sign-in upon creation</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateIsActive(!createIsActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    createIsActive
                      ? 'bg-[#2E8B57]/15 text-[#2E8B57] border border-[#2E8B57]/30'
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}
                >
                  {createIsActive ? 'Active' : 'Disabled'}
                </button>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(45,45,45,0.06)]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 text-[#C79A3B]" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. EDIT USER MODAL                                                        */}
      {/* ========================================================================= */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl border border-[rgba(45,45,45,0.1)] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.06)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1C1C1C] flex items-center gap-2 font-['Outfit']">
                  <Edit2 className="w-5 h-5 text-[#C79A3B]" />
                  Edit User Profile & Permissions
                </h3>
                <p className="text-xs text-[#707070] mt-0.5">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all"
                  />
                </div>
              </div>

              {/* Role & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    System Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editRoleId}
                    onChange={(e) => setEditRoleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all"
                  />
                </div>
              </div>

              {/* Reset Password */}
              <div>
                <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider mb-1 block">
                  Reset Password (Leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type={editShowPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs text-[#1C1C1C] font-medium focus:outline-none focus:border-[#C79A3B] transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword(!editShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707070] hover:text-[#1C1C1C]"
                  >
                    {editShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Assigned Outlets */}
              <div className="space-y-2 border-t border-[rgba(45,45,45,0.06)] pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#707070] uppercase tracking-wider block">
                    Assigned Outlets Scope ({editSelectedBranchIds.length} Selected)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      selectAllBranches(setEditSelectedBranchIds, setEditDefaultBranchId)
                    }
                    className="text-[11px] text-[#B8862D] font-bold hover:underline"
                  >
                    Select All Outlets
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                  {availableBranches.map((branch) => {
                    const isChecked = editSelectedBranchIds.includes(branch.id);
                    const isDefault = editDefaultBranchId === branch.id;

                    return (
                      <div
                        key={branch.id}
                        onClick={() =>
                          toggleBranchSelection(
                            branch.id,
                            editSelectedBranchIds,
                            setEditSelectedBranchIds,
                            editDefaultBranchId,
                            setEditDefaultBranchId
                          )
                        }
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-white border-[#B8862D]/50 text-[#1C1C1C] shadow-xs'
                            : 'bg-white/50 border-[rgba(45,45,45,0.08)] text-[#707070] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isChecked
                                ? 'bg-[#B8862D] border-[#B8862D] text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate font-medium text-[11px]">
                            [{branch.code}] {branch.name}
                          </span>
                        </div>

                        {isChecked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditDefaultBranchId(branch.id);
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all ${
                              isDefault
                                ? 'bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/40'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {isDefault ? 'Default ★' : 'Set Default'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)]">
                <div className="space-y-0.5">
                  <span className="font-bold text-[#1C1C1C] text-xs">Account Status</span>
                  <p className="text-[11px] text-[#707070]">Toggle active login permissions</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    editIsActive
                      ? 'bg-[#2E8B57]/15 text-[#2E8B57] border border-[#2E8B57]/30'
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}
                >
                  {editIsActive ? 'Active' : 'Disabled'}
                </button>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[rgba(45,45,45,0.06)]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#C79A3B]" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. DEACTIVATE CONFIRMATION MODAL (Soft-Delete)                             */}
      {/* ========================================================================= */}
      {deactivatingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#1C1C1C] font-['Outfit']">
                Deactivate User Account?
              </h3>
              <p className="text-xs text-[#707070] leading-relaxed">
                Are you sure you want to deactivate <strong className="text-[#1C1C1C]">{deactivatingUser.email}</strong>?
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] text-[11px] text-[#707070] space-y-1">
              <span className="font-bold text-[#1C1C1C] block">Soft-Delete & Audit Integrity:</span>
              <p className="leading-relaxed">
                This user will immediately be blocked from logging in. All historical transactions, purchase approvals, and audit logs created by this user are preserved in full compliance with ERP standards.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.06)]">
              <button
                type="button"
                onClick={() => setDeactivatingUser(null)}
                className="px-4 py-2 rounded-xl border border-[rgba(45,45,45,0.15)] text-xs font-semibold text-[#707070] hover:bg-[#FAF8F5] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deactivating...</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>Confirm Deactivation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementWorkspace;
