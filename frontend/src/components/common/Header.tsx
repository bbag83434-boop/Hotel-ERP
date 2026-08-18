'use client';

import React, { useState } from 'react';
import { useOutlet } from '../../context/OutletContext';
import { usePWA } from '../../context/PWAContext';
import {
  Building2,
  ChevronDown,
  Download,
  Wifi,
  WifiOff,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { outlets, activeOutlet, setActiveOutlet, isHeadOffice } = useOutlet();
  const { isInstallable, installPWA, isOnline, updateAvailable, applyUpdate } = usePWA();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[rgba(45,45,45,0.08)] px-4 py-3 shadow-[0_2px_12px_rgba(45,45,45,0.03)]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C79A3B] to-[#B8862D] flex items-center justify-center shadow-md shadow-[#C79A3B]/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-[#1C1C1C] font-['Outfit']">
                APEX ERP
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-[#707070] hidden sm:block">Grand Heritage Resort & Multi-Outlet Enterprise</p>
          </div>
        </div>

        {/* Center: Active Outlet Switcher */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 bg-white/90 hover:bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] hover:border-[#C79A3B]/50 px-3 py-1.5 rounded-xl transition-all text-xs font-medium text-[#1C1C1C] shadow-sm active:scale-[0.98]"
          >
            <Building2 className="w-3.5 h-3.5 text-[#C79A3B]" />
            <span className="max-w-[130px] sm:max-w-[200px] truncate">{activeOutlet.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#707070]" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 sm:left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-white border border-[rgba(45,45,45,0.12)] rounded-2xl shadow-xl p-1.5 z-50">
                <div className="px-3 py-2 text-[10px] font-semibold text-[#707070] uppercase tracking-wider border-b border-[rgba(45,45,45,0.06)]">
                  Select Active Outlet / Unit ({outlets.length})
                </div>
                <div className="py-1 space-y-0.5">
                  {outlets.map((outlet) => {
                    const isSelected = activeOutlet.code === outlet.code;
                    return (
                      <button
                        key={outlet.id}
                        onClick={() => {
                          setActiveOutlet(outlet);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-[#F1E4C5] text-[#B8862D] font-semibold'
                            : 'text-[#1C1C1C] hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-mono text-[10px] text-[#707070] mr-1.5">[{outlet.code}]</span>
                          {outlet.name}
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(45,45,45,0.05)] text-[#707070] shrink-0">
                          {outlet.type.replace('_', ' ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Actions: PWA Install, Update, Online status */}
        <div className="flex items-center gap-2">
          {/* Update Available Badge */}
          {updateAvailable && (
            <button
              onClick={applyUpdate}
              className="flex items-center gap-1 bg-[#2E8B57]/15 hover:bg-[#2E8B57]/25 text-[#2E8B57] border border-[#2E8B57]/30 px-2.5 py-1 rounded-lg text-xs font-medium animate-pulse"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Update Ready</span>
            </button>
          )}

          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={installPWA}
              className="flex items-center gap-1.5 bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold px-2.5 py-1 rounded-lg text-xs transition-all shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${
              isOnline
                ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/20'
                : 'bg-[#D9534F]/10 text-[#D9534F] border-[#D9534F]/20 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Scope Indicator */}
          <div className="hidden md:flex items-center gap-1 text-[11px] bg-white/80 border border-[rgba(45,45,45,0.08)] px-2.5 py-1 rounded-lg text-[#707070] shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C79A3B]" />
            <span>{isHeadOffice ? 'Consolidated Scope' : 'Outlet Restricted'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
