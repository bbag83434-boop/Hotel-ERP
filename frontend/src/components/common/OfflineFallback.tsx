import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineFallback: React.FC = () => {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-slate-800 border border-slate-700 rounded-3xl flex items-center justify-center mb-6 shadow-floating text-brand-400">
        <WifiOff className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">You are currently offline</h1>
      <p className="text-slate-400 max-w-md mb-8 text-sm leading-relaxed">
        Please check your internet connection. Some features may remain available from local cached shell.
      </p>
      <button
        onClick={handleReload}
        className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 text-sm"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Try Reconnecting</span>
      </button>
    </div>
  );
};
