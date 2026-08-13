import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { AIAssistantWidget } from './components/common/AIAssistantWidget';

// Code-Splitting Lazy Loading Routes (Section 19 Performance Pass)
const DashboardShellPage = lazy(() =>
  import('./pages/dashboard/DashboardShellPage').then((m) => ({ default: m.DashboardShellPage }))
);
const InventoryPage = lazy(() =>
  import('./pages/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage }))
);
const PurchasingPage = lazy(() =>
  import('./pages/purchasing/PurchasingPage').then((m) => ({ default: m.PurchasingPage }))
);
const ProductionPage = lazy(() =>
  import('./pages/production/ProductionPage').then((m) => ({ default: m.ProductionPage }))
);
const RestaurantPOSPage = lazy(() =>
  import('./pages/restaurant/RestaurantPOSPage').then((m) => ({ default: m.RestaurantPOSPage }))
);
const HotelPMSPage = lazy(() =>
  import('./pages/hotel/HotelPMSPage').then((m) => ({ default: m.HotelPMSPage }))
);
const AccountingPage = lazy(() =>
  import('./pages/accounting/AccountingPage').then((m) => ({ default: m.AccountingPage }))
);
const HRPage = lazy(() =>
  import('./pages/hr/HRPage').then((m) => ({ default: m.HRPage }))
);
const ApprovalCenterPage = lazy(() =>
  import('./pages/approval/ApprovalCenterPage').then((m) => ({ default: m.ApprovalCenterPage }))
);
const ReportsHubPage = lazy(() =>
  import('./pages/reports/ReportsHubPage').then((m) => ({ default: m.ReportsHubPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

import { RenderServerWakeupScreen } from './components/common/RenderServerWakeupScreen';

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3">
    <div className="w-9 h-9 border-3 border-amber-500/80 border-t-transparent rounded-full animate-spin shadow-lg shadow-amber-900/20" />
    <div className="text-center space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-400 font-mono">CHEF BISU</p>
      <p className="text-sm font-semibold text-slate-200">Hotel Management</p>
      <p className="text-[11px] text-slate-500">Hospitality Management System • Loading...</p>
    </div>
  </div>
);

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RenderServerWakeupScreen />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected App Routes */}
          <Route
            element={
              <ProtectedRoute>
                <>
                  <AppLayout />
                  <AIAssistantWidget />
                </>
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardShellPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchasing" element={<PurchasingPage />} />
            <Route path="/production" element={<ProductionPage />} />
            <Route path="/kitchen" element={<ProductionPage />} />
            <Route path="/restaurant" element={<RestaurantPOSPage />} />
            <Route path="/pos" element={<RestaurantPOSPage />} />
            <Route path="/hotel" element={<HotelPMSPage />} />
            <Route path="/pms" element={<HotelPMSPage />} />
            <Route path="/accounting" element={<AccountingPage />} />
            <Route path="/finance" element={<AccountingPage />} />
            <Route path="/hr" element={<HRPage />} />
            <Route path="/payroll" element={<HRPage />} />
            <Route path="/approvals" element={<ApprovalCenterPage />} />
            <Route path="/approval" element={<ApprovalCenterPage />} />
            <Route path="/reports" element={<ReportsHubPage />} />
            <Route path="/users" element={<DashboardShellPage />} />
            <Route path="/audit-logs" element={<DashboardShellPage />} />
            <Route path="/settings" element={<DashboardShellPage />} />
          </Route>

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
};

export default App;
