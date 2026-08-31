'use client';

import React, { useState } from 'react';
import { useOutlet } from '../../context/OutletContext';
import { usePWA } from '../../context/PWAContext';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  ChevronDown,
  Download,
  WifiOff,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Menu,
  X,
  Check,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { outlets, activeOutlet, setActiveOutlet, isHeadOffice } = useOutlet();
  const { isInstallable, installPWA, isOnline, updateAvailable, applyUpdate } = usePWA();
  const { logout, user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#121214]/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.08)] px-3 sm:px-4 py-2.5 sm:py-3 shadow-md w-full max-w-full">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3 w-full min-w-0">
        {/* Left: Brand & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-xl text-[#9A9A9E] hover:text-[#F2F0EA] hover:bg-[#1B1B1F] border border-[rgba(255,255,255,0.1)] active:scale-95 transition-all"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#C9A24B] to-[#B8862D] flex items-center justify-center shadow-md shadow-[#C9A24B]/20 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base md:text-lg tracking-tight text-[#F2F0EA] font-['Outfit'] truncate">
                CB Hotel Management
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.2 sm:py-0.5 rounded bg-[#C9A24B]/20 text-[#C9A24B] border border-[#C9A24B]/30 shrink-0">
                v2.0
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#9A9A9E] hidden lg:block truncate">
              {isHeadOffice ? 'Head Office & Central Commissary' : 'Enterprise Multi-Outlet Hospitality Management'}
            </p>
          </div>
        </div>

        {/* Center/Right: Active Outlet Switcher (Mobile Responsive) */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Active Outlet Pill / Button */}
          <div className="relative shrink min-w-0">
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 sm:gap-2 bg-[#1B1B1F] hover:bg-[#222228] border border-[rgba(255,255,255,0.12)] hover:border-[#C9A24B]/50 px-2 sm:px-3 py-1.5 rounded-xl transition-all text-xs font-medium text-[#F2F0EA] shadow-xs active:scale-[0.98] max-w-[150px] xs:max-w-[190px] sm:max-w-[240px]"
            >
              <Building2 className="w-3.5 h-3.5 text-[#C9A24B] shrink-0" />
              <span className="truncate font-semibold text-[11px] sm:text-xs">
                {activeOutlet?.id ? `${activeOutlet.name}` : 'Select Branch / Outlet'}
              </span>
              <ChevronDown className={`w-3 h-3 text-[#9A9A9E] shrink-0 ml-0.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Outlet Selection Sheet / Dropdown (Zero Overflow on 360-430px screens) */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-2xs"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 max-h-[80vh] sm:max-h-96 overflow-y-auto bg-[#1B1B1F] border border-[rgba(255,255,255,0.12)] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(255,255,255,0.08)]">
                    <span className="text-[10px] font-semibold text-[#9A9A9E]">
                      Select active outlet ({outlets.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(false)}
                      className="p-1 rounded-lg text-[#9A9A9E] hover:text-[#F2F0EA] sm:hidden"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="py-1 space-y-1">
                    {outlets.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#9A9A9E]">
                        No outlets available. Create or enable a branch in Project Setup.
                      </div>
                    ) : (
                      outlets.map((outlet) => {
                        const isSelected = Boolean(activeOutlet?.id && (activeOutlet.id === outlet.id || activeOutlet.code === outlet.code));
                        return (
                          <button
                            type="button"
                            key={outlet.id}
                            onClick={() => {
                              setActiveOutlet(outlet);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-[#C9A24B]/20 text-[#C9A24B] font-bold border border-[#C9A24B]/30'
                                : 'text-[#F2F0EA] hover:bg-[#222228]'
                            }`}
                          >
                            <div className="truncate pr-2 flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-[#9A9A9E] shrink-0">
                                [{outlet.code}]
                              </span>
                              <span className="truncate">{outlet.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[#9A9A9E]">
                                {outlet.type.replace(/_/g, ' ').toLowerCase()}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#C9A24B]" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  {activeOutlet?.id && (
                    <div className="pt-1.5 mt-1 border-t border-[rgba(255,255,255,0.08)] px-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                        }}
                        className="w-full text-center py-1 text-[11px] text-[#C9A24B] hover:text-[#E0574C] font-medium transition-colors"
                      >
                        Single-outlet cockpit
                      </button>
                    </div>
                  )}
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
                className="flex items-center gap-1 bg-[#3EAE72]/15 hover:bg-[#3EAE72]/25 text-[#3EAE72] border border-[#3EAE72]/30 px-2 py-1 rounded-lg text-[11px] font-medium animate-pulse"
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
                className="flex items-center gap-1 bg-[#C9A24B] hover:bg-[#B8862D] text-[#121214] font-semibold px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs transition-all shadow-xs active:scale-95"
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
                  ? 'bg-[#3EAE72]/15 text-[#3EAE72] border-[#3EAE72]/30'
                  : 'bg-[#E0574C]/15 text-[#E0574C] border-[#E0574C]/30 animate-pulse'
              }`}
            >
              {isOnline ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#3EAE72]" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span className="hidden xs:inline">{isOnline ? 'Live' : 'Offline'}</span>
            </div>

            {/* Scope Indicator (Desktop only) */}
            <div className="hidden md:flex items-center gap-1 text-[11px] bg-[#1B1B1F] border border-[rgba(255,255,255,0.08)] px-2.5 py-1 rounded-lg text-[#9A9A9E] shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C9A24B]" />
              <span>{isHeadOffice ? 'HQ Scope' : 'Restricted'}</span>
            </div>

            {/* Logout Action */}
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1 bg-[#E0574C]/10 hover:bg-[#E0574C]/20 text-[#E0574C] border border-[#E0574C]/30 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-xs active:scale-95 shrink-0"
              title={`Logged in as ${user?.email || 'Admin'} · Click to Logout`}
              aria-label="Logout"
            >
              <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
