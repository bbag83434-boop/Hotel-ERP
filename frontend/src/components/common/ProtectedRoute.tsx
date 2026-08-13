import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermissions?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermissions
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-100">
        <div className="w-16 h-16 bg-brand-600/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-400">Hotel Management • Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super Admin bypass
  if (user.role.name === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Check Allowed Roles
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role.name)) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mb-4 text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Your assigned role ({user.role.name}) does not have permission to view this module.
        </p>
        <button
          onClick={() => window.history.back()}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2 rounded-xl text-sm font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Check Required Permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const userPerms = user.role.permissions || [];
    const hasPerm = requiredPermissions.every((p) => userPerms.includes(p));
    if (!hasPerm) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-slate-100">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mb-4 text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Permission Required</h2>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            You lack required permission(s) to access this feature.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-2 rounded-xl text-sm font-semibold"
          >
            Go Back
          </button>
        </div>
      );
    }
  }

  return <>{children}</>;
};
