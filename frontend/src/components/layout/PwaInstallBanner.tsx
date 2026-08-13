import React, { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../utils/pwa';

export const PwaInstallBanner: React.FC = () => {
  const { isInstallable, isStandalone, installPWA } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isStandalone || !isInstallable || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 text-white px-4 py-3 shadow-lg flex items-center justify-between border-b border-brand-500/30 text-sm animate-fade-in z-50">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg">
          <Smartphone className="w-5 h-5 text-brand-200" />
        </div>
        <div>
          <p className="font-semibold text-white">Install Hospitality ERP App</p>
          <p className="text-xs text-brand-100 hidden sm:block">
            Install on your mobile / tablet for fast POS, KDS & Front Desk operation.
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={installPWA}
          className="flex items-center space-x-1.5 bg-white text-brand-700 hover:bg-brand-50 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all duration-150 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Install App</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 text-brand-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
