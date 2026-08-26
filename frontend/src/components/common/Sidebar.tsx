'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import { usePWA } from '@/context/PWAContext';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Boxes,
  ShoppingCart,
  ChefHat,
  Truck,
  AlertTriangle,
  Users,
  CalendarDays,
  BarChart3,
  Cpu,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  UserCog,
  SlidersHorizontal,
  X,
} from 'lucide-react';

export type WorkspaceId =
  | 'dashboard'
  | 'users'
  | 'organization'
  | 'inventory'
  | 'purchase'
  | 'production'
  | 'transfers'
  | 'wastage'
  | 'hr'
  | 'closing'
  | 'reports'
  | 'telemetry'
  | 'assistant';

interface SidebarProps {
  activeWorkspace: WorkspaceId;
  setActiveWorkspace: (workspace: WorkspaceId) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  setActiveWorkspace,
  mobileOpen = false,
  setMobileOpen,
}) => {
  const { activeOutlet, isHeadOffice, isCentralStore, canInitiateTransfers } = useOutlet();
  const { isOnline } = usePWA();
  const { user } = useAuth();

  const userRole = typeof user?.role === 'object' ? user.role.name : (user?.role || '');
  const isAdmin = ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN'].includes(
    userRole.toUpperCase()
  );

  const navGroups = isHeadOffice
    ? [
        {
          label: 'Core Operations',
          items: [
            { id: 'dashboard' as WorkspaceId, label: 'Executive Dashboard', icon: LayoutDashboard, badge: null },
            { id: 'assistant' as WorkspaceId, label: 'AI Assistant', icon: Sparkles, badge: 'Smart' },
            ...(isAdmin
              ? [{ id: 'users' as WorkspaceId, label: 'User & Admin Mgmt', icon: UserCog, badge: 'RBAC' }]
              : []),
            { id: 'organization' as WorkspaceId, label: 'Outlets & Master Structure', icon: Building2, badge: null },
            { id: 'inventory' as WorkspaceId, label: 'Inventory & Stock', icon: Boxes, badge: null },
            { id: 'purchase' as WorkspaceId, label: 'Central Purchase & PO', icon: ShoppingCart, badge: 'Direct GRN' },
            { id: 'production' as WorkspaceId, label: 'Recipes & Production', icon: ChefHat, badge: null },
            { id: 'transfers' as WorkspaceId, label: 'Store Transfers', icon: Truck, badge: null },
            { id: 'wastage' as WorkspaceId, label: 'Wastage Control', icon: AlertTriangle, badge: null },
          ],
        },
        {
          label: 'People & Finance',
          items: [
            { id: 'hr' as WorkspaceId, label: 'HR, Staff & Payroll', icon: Users, badge: null },
            { id: 'closing' as WorkspaceId, label: 'Bi-Monthly Closing', icon: CalendarDays, badge: '1st–15th' },
            { id: 'reports' as WorkspaceId, label: 'Reports & Cost Control', icon: BarChart3, badge: null },
            { id: 'telemetry' as WorkspaceId, label: 'Live Telemetry', icon: Cpu, badge: isOnline ? 'Online' : 'Offline' },
          ],
        },
      ]
    : [
        {
          label: isCentralStore ? 'Main Branch Operations' : 'Outlet Operations',
          items: [
            { id: 'dashboard' as WorkspaceId, label: 'Dashboard', icon: LayoutDashboard, badge: null },
            { id: 'assistant' as WorkspaceId, label: 'AI Assistant', icon: Sparkles, badge: 'Smart' },
            { id: 'purchase' as WorkspaceId, label: 'Central Purchase & PO', icon: ShoppingCart, badge: 'Direct GRN' },
            { id: 'wastage' as WorkspaceId, label: 'Wastage Control', icon: AlertTriangle, badge: null },
            ...(canInitiateTransfers
              ? [{ id: 'transfers' as WorkspaceId, label: 'Store Transfers', icon: Truck, badge: null }]
              : []),
          ],
        },
      ];

  const handleSelect = (id: WorkspaceId) => {
    setActiveWorkspace(id);
    if (setMobileOpen) setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-md border-r border-[rgba(45,45,45,0.08)] shadow-[2px_0_16px_rgba(45,45,45,0.02)]">
      {/* Brand Header */}
      <div className="p-4 border-b border-[rgba(45,45,45,0.06)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C79A3B] to-[#B8862D] flex items-center justify-center shadow-md shadow-[#C79A3B]/20 text-white font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-[#1C1C1C] font-['Outfit']">
                CB Hotel Management
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#F1E4C5] text-[#B8862D] border border-[#B8862D]/30">
                v2.0
              </span>
            </div>
            <p className="text-[10px] text-[#707070]">Enterprise Suite</p>
          </div>
        </div>

        {/* Mobile close button */}
        {setMobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Scope Card */}
      <div className="p-3 mx-3 mt-3 rounded-xl bg-gradient-to-br from-[#FAF8F5] to-white border border-[#C79A3B]/25 space-y-1 shadow-sm">
        <div className="flex items-center justify-between text-[10px] text-[#707070]">
          <span className="font-semibold uppercase tracking-wider">Active Scope</span>
          <span className="font-mono text-[#B8862D] font-bold">[{activeOutlet.code}]</span>
        </div>
        <p className="text-xs font-bold text-[#1C1C1C] truncate">{activeOutlet.name}</p>
        <div className="flex items-center gap-1 text-[10px] text-[#2E8B57] font-medium pt-0.5">
          <ShieldCheck className="w-3 h-3 text-[#C79A3B]" />
          <span>{isHeadOffice ? 'Head Office Scope' : isCentralStore ? 'Main Branch (Central Store)' : 'Restricted Outlet'}</span>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#707070]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeWorkspace === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 active:scale-[0.98] ${
                      isActive
                        ? 'bg-[#F1E4C5] text-[#B8862D] font-bold shadow-sm border border-[#B8862D]/30'
                        : 'text-[#505050] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-[#B8862D] stroke-[2.2]' : 'text-[#707070] stroke-[1.8]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white text-[#B8862D] border border-[#B8862D]/30'
                            : 'bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[#B8862D]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / System Meta */}
      <div className="p-3 border-t border-[rgba(45,45,45,0.06)] text-[10px] text-[#707070] flex items-center justify-between">
        <span>FastAPI + Neon PostgreSQL</span>
        <span className="flex items-center gap-1 text-[#2E8B57] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57] animate-pulse" />
          Ready
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent left sidebar on md+) */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Off-canvas Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen?.(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
