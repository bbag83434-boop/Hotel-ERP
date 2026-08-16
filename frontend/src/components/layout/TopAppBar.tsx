import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  ChevronDown,
  LogOut,
  Bell,
  Search,
  Check,
  Crown,
  Plus,
  X,
  Store,
  AlertCircle
} from 'lucide-react';
import { branchApi, CreateBranchInput } from '../../api/branch.api';

export const TopAppBar: React.FC = () => {
  const { user, selectedBranchId, setSelectedBranchId, refreshUser, logout } = useAuth();
  const location = useLocation();

  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Add Branch Modal States
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [isSubmittingBranch, setIsSubmittingBranch] = useState(false);
  const [branchError, setBranchError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [branchSuccess, setBranchSuccess] = useState('');
  const [newBranchData, setNewBranchData] = useState<CreateBranchInput>({
    name: '',
    code: '',
    type: 'RESTAURANT',
    address: '',
    email: '',
    phone: ''
  });

  // Reset any open menus or modal error states when navigating to a new route
  useEffect(() => {
    setShowBranchMenu(false);
    setShowUserMenu(false);
    setBranchError('');
    setFieldErrors({});
  }, [location.pathname]);

  const activeBranch =
    user?.branches?.find((b) => b.id === selectedBranchId) || user?.branches?.[0];

  const handleCloseModal = () => {
    setShowAddBranchModal(false);
    setBranchError('');
    setFieldErrors({});
    setBranchSuccess('');
    setIsSubmittingBranch(false);
  };

  const handleFieldChange = (field: keyof CreateBranchInput, value: string) => {
    setNewBranchData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchError('');
    setFieldErrors({});
    setBranchSuccess('');
    setIsSubmittingBranch(true);

    try {
      const payload: CreateBranchInput = {
        name: newBranchData.name.trim(),
        code: newBranchData.code.trim().toUpperCase(),
        type: newBranchData.type,
        address: newBranchData.address.trim(),
        email: newBranchData.email?.trim() || undefined,
        phone: newBranchData.phone?.trim() || undefined
      };

      const created = await branchApi.createBranch(payload);
      setBranchSuccess(`Outlet "${created.name}" created successfully!`);
      await refreshUser();
      setSelectedBranchId(created.id);
      setTimeout(() => {
        handleCloseModal();
        setNewBranchData({
          name: '',
          code: '',
          type: 'RESTAURANT',
          address: '',
          email: '',
          phone: ''
        });
      }, 1200);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setBranchError('Session expired or unauthorized. Please re-login to create an outlet.');
        return;
      }

      const respData = err.response?.data;
      const mainMsg = respData?.message || 'Failed to create outlet. Please review the highlighted fields.';
      setBranchError(mainMsg);

      if (Array.isArray(respData?.errors) && respData.errors.length > 0) {
        const errorsMap: Record<string, string> = {};
        respData.errors.forEach((eItem: any) => {
          if (eItem.field) {
            const rawField = eItem.field.toLowerCase();
            const mappedKey = rawField.includes('code')
              ? 'code'
              : rawField.includes('name')
              ? 'name'
              : rawField.includes('address') || rawField.includes('location')
              ? 'address'
              : rawField.includes('type')
              ? 'type'
              : rawField.includes('email')
              ? 'email'
              : rawField.includes('phone')
              ? 'phone'
              : eItem.field;
            errorsMap[mappedKey] = eItem.issue || eItem.message || 'Invalid input';
            errorsMap[eItem.field] = eItem.issue || eItem.message || 'Invalid input';
          }
        });
        setFieldErrors(errorsMap);
      }
    } finally {
      setIsSubmittingBranch(false);
    }
  };

  return (
    <>
      <header className="bg-[#0c0c0e]/95 backdrop-blur-md border-b border-white/[0.08] sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between transition-all pt-safe select-none">
        {/* Left: Brand logo & Branch Selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d4a437] to-[#996f1b] flex items-center justify-center text-black font-extrabold shadow-md shadow-[#d4a437]/20 border border-[#d4a437]/40">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xs font-bold text-white tracking-wide uppercase">Grand Heritage Resort</h1>
              <p className="text-[10px] font-semibold text-[#d4a437] tracking-wider uppercase">APEX Enterprise ERP</p>
            </div>
          </div>

          <div className="h-5 w-px bg-white/[0.1] mx-1" />

          {/* Branch Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              className="flex items-center space-x-2 bg-[#17171b] hover:bg-[#202026] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-neutral-200 font-medium transition-all shadow-sm"
            >
              <Building2 className="w-3.5 h-3.5 text-[#d4a437]" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">
                {activeBranch?.name || 'Select Outlet'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {showBranchMenu && (
              <div
                className="absolute left-0 mt-2 w-72 bg-[#17171b] border border-white/[0.1] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-3.5 py-1.5 text-[10px] font-bold text-[#d4a437] uppercase tracking-widest flex items-center justify-between">
                  <span>Active Outlets & Branches</span>
                  <span className="text-[9px] text-neutral-400">{user?.branches?.length || 0} active</span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04]">
                  {user?.branches && user.branches.length > 0 ? (
                    user.branches.map((b) => {
                      const isSelected = b.id === activeBranch?.id;
                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedBranchId(b.id);
                            setShowBranchMenu(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-white/[0.05] transition-colors ${
                            isSelected ? 'text-[#d4a437] font-semibold bg-[#d4a437]/10' : 'text-neutral-200'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-white">{b.name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">{b.code} • {b.type}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#d4a437]" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3.5 py-3 text-center text-xs text-neutral-500">
                      No branches assigned
                    </div>
                  )}
                </div>

                {/* Add New Outlet / Branch Action */}
                <div className="pt-2 mt-1 border-t border-white/[0.08] px-2">
                  <button
                    onClick={() => {
                      setShowBranchMenu(false);
                      setBranchError('');
                      setFieldErrors({});
                      setBranchSuccess('');
                      setShowAddBranchModal(true);
                    }}
                    className="w-full py-2 px-3 bg-[#d4a437]/10 hover:bg-[#d4a437]/20 text-[#d4a437] font-bold text-xs rounded-xl flex items-center justify-center space-x-2 border border-[#d4a437]/30 transition active:scale-98"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add New Outlet / Branch</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Search, Notifications, User Menu */}
        <div className="flex items-center space-x-2">
          <button
            aria-label="Quick Search"
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.06] rounded-xl transition-colors hidden sm:flex"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            aria-label="Notifications"
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.06] rounded-xl transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#d4a437] rounded-full animate-pulse" />
          </button>

          <div className="h-5 w-px bg-white/[0.1]" />

          {/* User Profile / Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-1 pl-2 hover:bg-white/[0.06] border border-white/[0.08] rounded-xl transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-[#d4a437]/20 border border-[#d4a437]/40 flex items-center justify-center text-[#d4a437] font-bold text-xs">
                {user?.firstName ? user.firstName.charAt(0) : 'U'}
              </div>
              <div className="hidden md:block text-left pr-1">
                <p className="text-xs font-semibold text-white leading-none">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[10px] text-[#d4a437] font-medium mt-0.5 leading-none">
                  {user?.role?.name || 'Administrator'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-56 bg-[#17171b] border border-white/[0.1] rounded-2xl shadow-floating py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setShowUserMenu(false)}
              >
                <div className="px-3.5 py-2 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate">{user?.email}</p>
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#d4a437]/15 text-[#d4a437] font-medium border border-[#d4a437]/20">
                    {user?.role?.name || 'Authorized User'}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => logout()}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#e5544d] hover:bg-[#e5544d]/10 flex items-center space-x-2 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* SECTION 0.6 MODAL: ADD NEW OUTLET / BRANCH */}
      {/* ========================================================= */}
      {showAddBranchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#17171b] border border-white/[0.1] rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#d4a437]/15 border border-[#d4a437]/30 flex items-center justify-center text-[#d4a437]">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Register New Outlet / Branch
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Multi-Tenant Multi-Branch Operating Architecture
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {branchError && (
              <div className="p-3 bg-[#e5544d]/10 border border-[#e5544d]/25 text-[#e5544d] rounded-xl text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold">{branchError}</div>
                  {Object.keys(fieldErrors).length > 0 && (
                    <div className="mt-1 text-[11px] opacity-90">
                      Please correct the {Object.keys(fieldErrors).length} invalid field(s) indicated below.
                    </div>
                  )}
                </div>
              </div>
            )}

            {branchSuccess && (
              <div className="p-3 bg-[#3fbf6f]/10 border border-[#3fbf6f]/25 text-[#3fbf6f] rounded-xl text-xs font-medium flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{branchSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Branch Name */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-neutral-300 font-semibold uppercase tracking-wider block mb-1">
                    Outlet / Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Bistro & Fine Dining"
                    value={newBranchData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-[#0c0c0e] border rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none transition ${
                      fieldErrors.name || fieldErrors.branchName || fieldErrors.outletName
                        ? 'border-[#e5544d] focus:border-[#e5544d]'
                        : 'border-white/[0.09] focus:border-[#d4a437]'
                    }`}
                  />
                  {(fieldErrors.name || fieldErrors.branchName || fieldErrors.outletName) && (
                    <p className="mt-1.5 text-[11px] text-[#e5544d] flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fieldErrors.name || fieldErrors.branchName || fieldErrors.outletName}
                    </p>
                  )}
                </div>

                {/* Branch Code */}
                <div>
                  <label className="text-[11px] text-neutral-300 font-semibold uppercase tracking-wider block mb-1">
                    Branch Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BR-BISTRO-01"
                    value={newBranchData.code}
                    onChange={(e) => handleFieldChange('code', e.target.value.toUpperCase())}
                    className={`w-full px-3.5 py-2.5 bg-[#0c0c0e] border rounded-xl text-xs font-mono uppercase font-bold text-white placeholder:text-neutral-600 focus:outline-none transition ${
                      fieldErrors.code || fieldErrors.branchCode || fieldErrors.outletCode
                        ? 'border-[#e5544d] focus:border-[#e5544d]'
                        : 'border-white/[0.09] focus:border-[#d4a437]'
                    }`}
                  />
                  {(fieldErrors.code || fieldErrors.branchCode || fieldErrors.outletCode) && (
                    <p className="mt-1.5 text-[11px] text-[#e5544d] flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fieldErrors.code || fieldErrors.branchCode || fieldErrors.outletCode}
                    </p>
                  )}
                </div>

                {/* Branch Type */}
                <div>
                  <label className="text-[11px] text-neutral-300 font-semibold uppercase tracking-wider block mb-1">
                    Outlet Category Type *
                  </label>
                  <select
                    value={newBranchData.type}
                    onChange={(e) => handleFieldChange('type', e.target.value as any)}
                    className={`w-full px-3.5 py-2.5 bg-[#0c0c0e] border rounded-xl text-xs text-white focus:outline-none transition ${
                      fieldErrors.type || fieldErrors.branchType || fieldErrors.outletType
                        ? 'border-[#e5544d] focus:border-[#e5544d]'
                        : 'border-white/[0.09] focus:border-[#d4a437]'
                    }`}
                  >
                    <option value="RESTAURANT" className="bg-[#17171b] text-white">Restaurant & Bar (POS/KDS)</option>
                    <option value="HOTEL" className="bg-[#17171b] text-white">Hotel Property (PMS/Rooms)</option>
                    <option value="HYBRID" className="bg-[#17171b] text-white">Hybrid (Hotel & F&B Combined)</option>
                  </select>
                  {(fieldErrors.type || fieldErrors.branchType || fieldErrors.outletType) && (
                    <p className="mt-1.5 text-[11px] text-[#e5544d] flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fieldErrors.type || fieldErrors.branchType || fieldErrors.outletType}
                    </p>
                  )}
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-neutral-300 font-semibold uppercase tracking-wider block mb-1">
                    Physical Address / Floor Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ground Floor, Courtyard Pavilion, Grand Heritage"
                    value={newBranchData.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-[#0c0c0e] border rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none transition ${
                      fieldErrors.address || fieldErrors.location
                        ? 'border-[#e5544d] focus:border-[#e5544d]'
                        : 'border-white/[0.09] focus:border-[#d4a437]'
                    }`}
                  />
                  {(fieldErrors.address || fieldErrors.location) && (
                    <p className="mt-1.5 text-[11px] text-[#e5544d] flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fieldErrors.address || fieldErrors.location}
                    </p>
                  )}
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="text-[11px] text-neutral-300 font-semibold uppercase tracking-wider block mb-1">
                    Contact Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. bistro@grandheritage.in"
                    value={newBranchData.email || ''}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-[#0c0c0e] border rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none transition ${
                      fieldErrors.email || fieldErrors.contactEmail
                        ? 'border-[#e5544d] focus:border-[#e5544d]'
                        : 'border-white/[0.09] focus:border-[#d4a437]'
                    }`}
                  />
                  {(fieldErrors.email || fieldErrors.contactEmail) && (
                    <p className="mt-1.5 text-[11px] text-[#e5544d] flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fieldErrors.email || fieldErrors.contactEmail}
                    </p>
                  )}
                </div>

                {/* Phone (Optional) */}
                <div>
                  <label className="text-[11px] text-neutral-300 font-semibold uppercase tracking-wider block mb-1">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={newBranchData.phone || ''}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-[#0c0c0e] border rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none transition ${
                      fieldErrors.phone || fieldErrors.contactPhone
                        ? 'border-[#e5544d] focus:border-[#e5544d]'
                        : 'border-white/[0.09] focus:border-[#d4a437]'
                    }`}
                  />
                  {(fieldErrors.phone || fieldErrors.contactPhone) && (
                    <p className="mt-1.5 text-[11px] text-[#e5544d] flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {fieldErrors.phone || fieldErrors.contactPhone}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 bg-[#202026] hover:bg-[#282832] text-neutral-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBranch}
                  className="px-5 py-2.5 bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-[#d4a437]/20 disabled:opacity-50"
                >
                  {isSubmittingBranch ? 'Registering...' : 'Create Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TopAppBar;
