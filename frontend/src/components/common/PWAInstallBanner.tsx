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
    <div className="bg-white/90 backdrop-blur-md border border-[#C79A3B]/35 rounded-2xl p-3.5 sm:p-4 mb-5 shadow-lg shadow-[rgba(45,45,45,0.05)] relative overflow-hidden">
      {/* Background Gold Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C79A3B] to-transparent opacity-80" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F1E4C5] border border-[#B8862D]/30 flex items-center justify-center text-[#B8862D] shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-[#1C1C1C] font-['Outfit']">Install APEX ERP App</h4>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1E4C5] text-[#B8862D] font-semibold border border-[#B8862D]/25">
                PWA
              </span>
            </div>
            <p className="text-xs text-[#707070] mt-0.5">
              Add to your home screen for instant full-screen multi-outlet operations & offline capability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            onClick={dismissInstall}
            className="text-[#707070] hover:text-[#1C1C1C] p-2 rounded-lg hover:bg-[#FAF8F5] transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={installPWA}
            className="flex items-center gap-1.5 bg-[#C79A3B] hover:bg-[#B8862D] text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95"
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
