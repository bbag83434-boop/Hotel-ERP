'use client';

import React from 'react';
import { usePWA } from '../../context/PWAContext';
import { Download, X, Smartphone } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, installPWA, dismissInstall } = usePWA();

  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-[#17171b] via-[#1e1e24] to-[#17171b] border border-[#d4a437]/30 rounded-2xl p-3.5 sm:p-4 mb-5 shadow-xl shadow-black/40 relative overflow-hidden">
      {/* Background Gold Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4a437] to-transparent opacity-60" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d4a437]/15 border border-[#d4a437]/30 flex items-center justify-center text-[#d4a437] shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white font-['Outfit']">Install APEX ERP App</h4>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d4a437]/20 text-[#d4a437] font-semibold">
                PWA
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              Add to your home screen for instant full-screen multi-outlet operations & offline capability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={dismissInstall}
            className="text-white/40 hover:text-white/80 p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={installPWA}
            className="flex items-center gap-1.5 bg-[#d4a437] hover:bg-[#b8861b] text-[#0c0c0e] font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-[#d4a437]/20 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;

