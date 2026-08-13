import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Bell,
  Search,
  Check
} from 'lucide-react';

export const TopAppBar: React.FC = () => {
  const { user, selectedBranchId, setSelectedBranchId, logout } = useAuth();
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const activeBranch =
    user?.branches.find((b) => b.id === selectedBranchId) || user?.branches[0];

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between transition-all pt-safe">
      {/* Left: Brand logo & Branch Selector */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/20">
            H
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white leading-tight">Hotel Management</h1>
            <p className="text-[10px] font-medium text-amber-400">Hospitality Cloud</p>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        {/* Branch Selector Dropdown */}
        {user && user.branches.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowBranchMenu(!showBranchMenu)}
              className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium transition-all"
            >
              <Building2 className="w-3.5 h-3.5 text-brand-400" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">
                {activeBranch?.name || 'Select Branch'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showBranchMenu && (
              <div
                className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-floating py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setShowBranchMenu(false)}
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Active Branch / Outlet
                </div>
                {user.branches.map((b) => {
                  const isSelected = b.id === activeBranch?.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-700/60 transition-colors ${
                        isSelected ? 'text-brand-400 font-semibold bg-brand-500/10' : 'text-slate-200'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-white">{b.name}</p>
                        <p className="text-[10px] text-slate-400">{b.code} • {b.type}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-brand-400" />}
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
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors hidden sm:flex"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          aria-label="Notifications"
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
        </button>

        <div className="h-5 w-px bg-slate-800" />

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs text-brand-300">
              {user?.firstName?.charAt(0) || 'U'}
            </div>
            <span className="text-xs font-medium text-slate-200 hidden md:block">
              {user?.firstName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-floating py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              onClick={() => setShowUserMenu(false)}
            >
              <div className="px-4 py-2 border-b border-slate-700/60">
                <p className="text-xs font-semibold text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-brand-500/20 text-brand-300 text-[10px] font-bold rounded-md uppercase tracking-wider">
                  {user?.role.name}
                </span>
              </div>

              <div className="py-1">
                <button
                  onClick={() => alert('Profile settings coming soon')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700/60 flex items-center space-x-2"
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span>My Account</span>
                </button>
              </div>

              <div className="border-t border-slate-700/60 pt-1">
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
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
