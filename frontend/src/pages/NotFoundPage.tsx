import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-20 h-20 bg-[#17171b] border border-white/[0.08] rounded-3xl flex items-center justify-center mb-6 shadow-floating text-[#d4a437]">
        <Compass className="w-10 h-10 animate-pulse" />
      </div>
      <h1 className="text-4xl font-extrabold text-[#d4a437] mb-2 tracking-tight">404</h1>
      <h2 className="text-lg font-semibold text-neutral-200 mb-2">Page Not Found</h2>
      <p className="text-sm text-neutral-400 max-w-sm mb-8">
        The requested ERP resource does not exist or has been relocated within the Grand Heritage portal.
      </p>
      <Link
        to="/dashboard"
        className="px-6 py-2.5 rounded-xl bg-[#d4a437] hover:bg-[#b88c2c] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#d4a437]/20"
      >
        Return to Command Center
      </Link>
    </div>
  );
};
