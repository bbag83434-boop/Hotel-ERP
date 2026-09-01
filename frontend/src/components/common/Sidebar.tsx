'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import { usePWA } from '@/context/PWAContext';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Bot,
  Building2,
  Boxes,
  ShoppingBag,
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
  CheckSquare,
  Wrench,
  Beer,
  BookOpen,
  Hotel,
  Zap,
  UserCog,
  UserRoundSearch,
  X,
  Banknote,
  MessageCircle,
  FileText,
  LogOut,
} from 'lucide-react';

export type WorkspaceId =
  | 'dashboard'
  | 'crm'
  | 'users'
  | 'organization'
  | 'inventory'
  | 'orders'
  | 'cashierShift'
  | 'kds'
  | 'purchase'
  | 'production'
  | 'transfers'
  | 'wastage'
  | 'hr'
  | 'closing'
  | 'reports'
  | 'telemetry'
  | 'assistant'
  | 'aiAgent'
  | 'automation'
  | 'security'
  | 'maintenance'
  | 'beverage'
  | 'finance'
  | 'financeControl'
  | 'hotel'
  | 'approvals'
  | 'multiOutlet'
  | 'scheduledReports'
  | 'supplierPerformance'
  | 'aiProvider'
  | 'aiTools'
  | 'telegramNotifications'
  | 'aiDocuments'
  | 'aiWastageSales'
  | 'whatsappBusiness';

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
  const { activeOutlet, isHeadOffice, setActiveOutlet } = useOutlet();
  const { isOnline } = usePWA();
  const { user, logout } = useAuth();

  const userRole = typeof user?.role === 'object' ? user.role.name : (user?.role || '');
  const isAdmin = ['SUPER_ADMIN', 'SUPERADMIN', 'OWNER', 'ADMIN', 'HQ_ADMIN', 'HEAD_OFFICE_ADMIN'].includes(
    userRole.toUpperCase()
  );

  const navGroups = [
    {
      label: 'Core Operations',
      defaultOpen: true,
      items: [
        { id: 'inventory' as WorkspaceId, label: 'Inventory & Stock', icon: Boxes, badge: null },
        { id: 'orders' as WorkspaceId, label: 'Orders & POS', icon: ShoppingBag, badge: '3 Sources' },
        { id: 'cashierShift' as WorkspaceId, label: 'Cashier Shift & Reconcile', icon: Banknote, badge: 'Shift' },
        { id: 'kds' as WorkspaceId, label: 'Kitchen Display', icon: ChefHat, badge: 'Live' },
        { id: 'purchase' as WorkspaceId, label: 'Central Purchase & PO', icon: ShoppingCart, badge: 'PO' },
        { id: 'production' as WorkspaceId, label: 'Recipes & Production', icon: ChefHat, badge: null },
        { id: 'transfers' as WorkspaceId, label: 'Store Transfers', icon: Truck, badge: null },
        { id: 'wastage' as WorkspaceId, label: 'Wastage Control', icon: AlertTriangle, badge: null },
        { id: 'crm' as WorkspaceId, label: 'Customer & CRM', icon: UserRoundSearch, badge: 'CRM' },
        { id: 'maintenance' as WorkspaceId, label: 'Maintenance & Assets', icon: Wrench, badge: null },
        { id: 'beverage' as WorkspaceId, label: 'Beverage Control', icon: Beer, badge: 'Controlled' },
        { id: 'hotel' as WorkspaceId, label: 'Hotel Operations', icon: Hotel, badge: 'Rooms' },
        { id: 'hr' as WorkspaceId, label: 'HR, Staff & Payroll', icon: Users, badge: null },
      ],
    },
    {
      label: 'Management',
      defaultOpen: true,
      items: [
        { id: 'dashboard' as WorkspaceId, label: 'Executive Dashboard', icon: LayoutDashboard, badge: null },
        ...(isHeadOffice && isAdmin ? [{ id: 'multiOutlet' as WorkspaceId, label: 'Multi-Outlet Intelligence', icon: BarChart3, badge: 'HQ' }] : []),
        ...(isAdmin ? [{ id: 'supplierPerformance' as WorkspaceId, label: 'Supplier Performance', icon: Truck, badge: 'Procurement' }] : []),
        ...(isAdmin ? [{ id: 'approvals' as WorkspaceId, label: 'Approval Center', icon: CheckSquare, badge: 'Pending' }] : []),
        { id: 'organization' as WorkspaceId, label: 'Project Setup', icon: Building2, badge: null },
      ],
    },
    {
      label: 'Finance & Reporting',
      items: [
        { id: 'finance' as WorkspaceId, label: 'Accounts & Finance', icon: BookOpen, badge: 'GL' },
        { id: 'financeControl' as WorkspaceId, label: 'Expense & Reconciliation', icon: Banknote, badge: 'Control' },
        { id: 'reports' as WorkspaceId, label: 'Reports & Cost Control', icon: BarChart3, badge: null },
        ...(isAdmin ? [{ id: 'scheduledReports' as WorkspaceId, label: 'Scheduled Reports & Alerts', icon: CalendarDays, badge: 'Alerts' }] : []),
        { id: 'closing' as WorkspaceId, label: 'Bi-Monthly Closing', icon: CalendarDays, badge: '1st–15th' },
      ],
    },
    {
      label: 'AI & Intelligence',
      items: [
        { id: 'assistant' as WorkspaceId, label: 'AI Assistant', icon: Sparkles, badge: 'Smart' },
        { id: 'aiWastageSales' as WorkspaceId, label: 'AI Wastage & Sales', icon: BarChart3, badge: 'AI' },
        { id: 'aiAgent' as WorkspaceId, label: 'Controlled AI Agent', icon: Bot, badge: 'Guarded' },
        ...(isAdmin ? [{ id: 'aiProvider' as WorkspaceId, label: 'AI Provider Control', icon: Bot, badge: 'Admin' }, { id: 'aiTools' as WorkspaceId, label: 'AI Controlled Tools', icon: ShieldCheck, badge: 'Guarded' }] : []),
        { id: 'aiDocuments' as WorkspaceId, label: 'AI Invoice Processing', icon: FileText, badge: 'AI' },
      ],
    },
    {
      label: 'Integrations & Automation',
      items: [
        ...(isAdmin ? [{ id: 'telegramNotifications' as WorkspaceId, label: 'Telegram', icon: MessageCircle, badge: 'Free' }, { id: 'whatsappBusiness' as WorkspaceId, label: 'WhatsApp Business', icon: MessageCircle, badge: 'Meta' }] : []),
        { id: 'automation' as WorkspaceId, label: 'Automation Center', icon: Zap, badge: 'Live' },
      ],
    },
    {
      label: 'Security & System',
      items: [
        ...(isAdmin ? [{ id: 'users' as WorkspaceId, label: 'User & Admin Management', icon: UserCog, badge: 'RBAC' }] : []),
        ...(isAdmin ? [{ id: 'security' as WorkspaceId, label: 'Security Center', icon: ShieldCheck, badge: 'Audit' }] : []),
        { id: 'telemetry' as WorkspaceId, label: 'Live Telemetry', icon: Cpu, badge: isOnline ? 'Online' : 'Offline' },
      ],
    },
  ];

  const workspaceGroup = (id: WorkspaceId) => navGroups.find((group) => group.items.some((item) => item.id === id));
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((group) => { initial[group.label] = !!group.defaultOpen; });
    return initial;
  });

  React.useEffect(() => {
    const activeGroup = workspaceGroup(activeWorkspace);
    if (activeGroup) {
      setOpenGroups((current) => ({ ...current, [activeGroup.label]: true }));
    }
  }, [activeWorkspace]);


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
          <span className="font-mono text-[#B8862D] font-bold">[{activeOutlet?.code || 'GLOBAL'}]</span>
        </div>
        <p className="text-xs font-bold text-[#1C1C1C] truncate">{activeOutlet?.id ? activeOutlet.name : 'All Outlets / Not Selected'}</p>
        <div className="flex items-center gap-1 text-[10px] text-[#2E8B57] font-medium pt-0.5">
          <ShieldCheck className="w-3 h-3 text-[#C79A3B]" />
          <span>{isHeadOffice ? 'Head Office Scope' : activeOutlet?.id ? 'Restricted Outlet' : 'Select Branch Above'}</span>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {navGroups.map((group) => {
          const isOpen = !!openGroups[group.label];
          const hasActive = group.items.some((item) => item.id === activeWorkspace);
          return (
            <div key={group.label} className="space-y-1">
              <button
                type="button"
                onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#FAF8F5] transition-colors"
                aria-expanded={isOpen}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${hasActive ? 'text-[#B8862D]' : 'text-[#707070]'}`}>
                  {group.label}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 text-[#707070] transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
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
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#B8862D] stroke-[2.2]' : 'text-[#707070] stroke-[1.8]'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className={`ml-2 shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white text-[#B8862D] border border-[#B8862D]/30' : 'bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)]'}`}>
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User Session & Logout */}
      <div className="p-3 border-t border-[rgba(45,45,45,0.06)] bg-white/60 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1C1C1C] truncate font-['Outfit']">
              {user?.first_name || user?.firstName || 'Admin'} {user?.last_name || user?.lastName || ''}
            </p>
            <p className="text-[10px] text-[#707070] truncate">{user?.email || 'bbag83434@gmail.com'}</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="p-1.5 rounded-lg bg-[#D9534F]/10 hover:bg-[#D9534F]/20 text-[#D9534F] border border-[#D9534F]/30 transition-all active:scale-95 shrink-0"
            title="Logout / Sign Out"
            aria-label="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#707070] pt-1 border-t border-[rgba(45,45,45,0.04)]">
          <span>v2.0 Live Architecture</span>
          <span className="flex items-center gap-1 text-[#2E8B57] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57] animate-pulse" />
            Active
          </span>
        </div>
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
