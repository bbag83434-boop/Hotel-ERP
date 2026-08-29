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
  Menu,
  X,
  Check,
} from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { outlets, activeOutlet, setActiveOutlet, isHeadOffice } = useOutlet();
  const { isInstallable, installPWA, isOnline, updateAvailable, applyUpdate } = usePWA();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[rgba(45,45,45,0.08)] px-3 sm:px-4 py-2.5 sm:py-3 shadow-[0_2px_12px_rgba(45,45,45,0.03)] w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3 w-full min-w-0">
        {/* Left: Brand & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-xl text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] border border-[rgba(45,45,45,0.1)] active:scale-95 transition-all"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#C79A3B] to-[#B8862D] flex items-center justify-center shadow-md shadow-[#C79A3B]/20 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base md:text-lg tracking-tight text-[#1C1C1C] font-['Outfit'] truncate">
                CB Hotel Management
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.2 sm:py-0.5 rounded bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30 shrink-0">
                v2.0
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#707070] hidden lg:block truncate">
              Enterprise Multi-Outlet Hospitality Management
            </p>
          </div>
        </div>

        {/* Center/Right: Active Outlet Switcher (Mobile Responsive) */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Active Outlet Pill / Button */}
          <div className="relative shrink min-w-0">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 bg-white hover:bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] hover:border-[#C79A3B]/50 px-2 sm:px-3 py-1.5 rounded-xl transition-all text-xs font-medium text-[#1C1C1C] shadow-xs active:scale-[0.98] max-w-[150px] xs:max-w-[190px] sm:max-w-[240px]"
            >
              <Building2 className="w-3.5 h-3.5 text-[#C79A3B] shrink-0" />
              <span className="truncate font-semibold text-[11px] sm:text-xs">
                {activeOutlet.name}
              </span>
              <ChevronDown className="w-3 h-3 text-[#707070] shrink-0 ml-0.5" />
            </button>

            {/* Outlet Selection Sheet / Dropdown (Zero Overflow on 360-430px screens) */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20 bg-black/30 backdrop-blur-2xs"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 max-h-[80vh] sm:max-h-96 overflow-y-auto bg-white border border-[rgba(45,45,45,0.12)] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(45,45,45,0.06)]">
                    <span className="text-[10px] font-bold text-[#707070] uppercase tracking-wider">
                      Select Active Outlet ({outlets.length})
                    </span>
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 sm:hidden"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="py-1 space-y-1">
                    {outlets.map((outlet) => {
                      const isSelected = activeOutlet.code === outlet.code;
                      return (
                        <button
                          key={outlet.id}
                          onClick={() => {
                            setActiveOutlet(outlet);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-[#F1E4C5] text-[#B8862D] font-bold'
                              : 'text-[#1C1C1C] hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <div className="truncate pr-2 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-[#707070] shrink-0">
                              [{outlet.code}]
                            </span>
                            <span className="truncate">{outlet.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(45,45,45,0.05)] text-[#707070]">
                              {outlet.type.replace('_', ' ')}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#B8862D]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Actions: Update, PWA Install, Online Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Update Available Badge */}
            {updateAvailable && (
              <button
                onClick={applyUpdate}
                className="flex items-center gap-1 bg-[#2E8B57]/15 hover:bg-[#2E8B57]/25 text-[#2E8B57] border border-[#2E8B57]/30 px-2 py-1 rounded-lg text-[11px] font-medium animate-pulse"
                title="Update Ready"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Update</span>
              </button>
            )}

            {/* PWA Install Button */}
            {isInstallable && (
              <button
                onClick={installPWA}
                className="flex items-center gap-1 bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs transition-all shadow-xs active:scale-95"
                title="Install PWA"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {/* Online/Offline Status Indicator */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-medium border shrink-0 ${
                isOnline
                  ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/20'
                  : 'bg-[#D9534F]/10 text-[#D9534F] border-[#D9534F]/20 animate-pulse'
              }`}
            >
              {isOnline ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57]" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span className="hidden xs:inline">{isOnline ? 'Live' : 'Offline'}</span>
            </div>

            {/* Scope Indicator (Desktop only) */}
            <div className="hidden md:flex items-center gap-1 text-[11px] bg-white/80 border border-[rgba(45,45,45,0.08)] px-2.5 py-1 rounded-lg text-[#707070] shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C79A3B]" />
              <span>{isHeadOffice ? 'HQ Scope' : 'Restricted'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
