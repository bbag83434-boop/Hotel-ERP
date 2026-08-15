import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  ChevronDown,
  LogOut,
  Bell,
  Search,
  Check,
  Crown
} from 'lucide-react';

export const TopAppBar: React.FC = () => {
  const { user, selectedBranchId, setSelectedBranchId, logout } = useAuth();
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const activeBranch =
    user?.branches?.find((b) => b.id === selectedBranchId) || user?.branches?.[0];

  return (
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
        {user && user.branches && user.branches.length > 0 && (
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
                className="absolute left-0 mt-2 w-64 bg-[#17171b] border border-white/[0.1] rounded-2xl shadow-floating py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setShowBranchMenu(false)}
              >
                <div className="px-3.5 py-1.5 text-[10px] font-bold text-[#d4a437] uppercase tracking-widest">
                  Active Outlet / Branch
                </div>
                {user.branches.map((b) => {
                  const isSelected = b.id === activeBranch?.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-white/[0.05] transition-colors ${
                        isSelected ? 'text-[#d4a437] font-semibold bg-[#d4a437]/10' : 'text-neutral-200'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-white">{b.name}</p>
                        <p className="text-[10px] text-neutral-400">{b.code} • {b.type}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#d4a437]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
                  <LogOut className="w-4 h-4 text-[#e5544d]" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
