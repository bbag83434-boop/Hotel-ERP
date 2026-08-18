'use client';

import React from 'react';
import { usePWA } from '../../context/PWAContext';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = usePWA();

  if (isOnline) {
    return null;
  }

  return (
    <div className="bg-[#D9534F]/10 border-b border-[#D9534F]/25 text-[#D9534F] px-4 py-2 text-xs flex items-center justify-between gap-2 sticky top-[61px] z-30 backdrop-blur-md">
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
        <WifiOff className="w-4 h-4 shrink-0 animate-bounce" />
        <span className="font-medium">
          Offline Mode Active — Cached shell & data available. Mutations and stock updates will sync upon reconnection.
        </span>
      </div>
    </div>
  );
};

export default OfflineBanner;
