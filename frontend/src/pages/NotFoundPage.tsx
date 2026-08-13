import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Compass } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-floating text-brand-400">
        <Compass className="w-10 h-10 animate-pulse" />
      </div>
      <h1 className="text-4xl font-extrabold text-white mb-2">404</h1>
      <h2 className="text-lg font-semibold text-slate-300 mb-2">Page Not Found</h2>
      <p className="text-sm text-slate-400 max-w-sm mb-8">
        The requested resource or page does not exist or has been relocated.
      </p>
      <Link to="/dashboard">
        <Button variant="primary" size="md">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
