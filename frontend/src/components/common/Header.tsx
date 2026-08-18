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
    <header className="sticky top-0 z-40 bg-[#0c0c0e]/90 backdrop-blur-md border-b border-white/[0.08] px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#d4a437] to-[#8c6b1f] flex items-center justify-center shadow-lg shadow-[#d4a437]/20">
            <Sparkles className="w-5 h-5 text-[#0c0c0e]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent font-['Outfit']">
                APEX ERP
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-white/40 hidden sm:block">Grand Heritage Resort & Multi-Outlet Enterprise</p>
          </div>
        </div>

        {/* Center: Active Outlet Switcher */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 bg-[#17171b] hover:bg-[#1e1e24] border border-white/[0.08] hover:border-[#d4a437]/30 px-3 py-1.5 rounded-xl transition-all text-xs font-medium text-white/90 active:scale-[0.98]"
          >
            <Building2 className="w-3.5 h-3.5 text-[#d4a437]" />
            <span className="max-w-[130px] sm:max-w-[200px] truncate">{activeOutlet.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 sm:left-0 mt-2 w-72 max-h-80 overflow-y-auto bg-[#17171b] border border-white/[0.1] rounded-2xl shadow-2xl p-1.5 z-50">
                <div className="px-3 py-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/[0.06]">
                  Select Active Outlet / Unit ({outlets.length})
                </div>
                <div className="py-1 space-y-0.5">
                  {outlets.map((outlet) => (
                    <button
                      key={outlet.id}
                      onClick={() => {
                        setActiveOutlet(outlet);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        activeOutlet.code === outlet.code
                          ? 'bg-[#d4a437]/15 text-[#d4a437] font-semibold'
                          : 'text-white/80 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-mono text-[10px] text-white/40 mr-1.5">[{outlet.code}]</span>
                        {outlet.name}
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 shrink-0">
                        {outlet.type.replace('_', ' ')}
                      </span>
                    </button>
                  ))}
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
              className="flex items-center gap-1 bg-[#3fbf6f]/20 hover:bg-[#3fbf6f]/30 text-[#3fbf6f] border border-[#3fbf6f]/30 px-2.5 py-1 rounded-lg text-xs font-medium animate-pulse"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Update Ready</span>
            </button>
          )}

          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={installPWA}
              className="flex items-center gap-1.5 bg-[#d4a437] hover:bg-[#b8861b] text-[#0c0c0e] font-semibold px-2.5 py-1 rounded-lg text-xs transition-all shadow-md shadow-[#d4a437]/20 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          {/* Online/Offline Status Indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${
              isOnline
                ? 'bg-[#3fbf6f]/10 text-[#3fbf6f] border-[#3fbf6f]/20'
                : 'bg-[#e5544d]/10 text-[#e5544d] border-[#e5544d]/20 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Scope Indicator */}
          <div className="hidden md:flex items-center gap-1 text-[11px] bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-lg text-white/60">
            <ShieldCheck className="w-3.5 h-3.5 text-[#d4a437]" />
            <span>{isHeadOffice ? 'Consolidated Scope' : 'Outlet Restricted'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

