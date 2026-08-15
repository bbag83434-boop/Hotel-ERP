import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Flame,
  Boxes,
  ShoppingCart,
  Users,
  Building,
  Calculator,
  ShieldCheck,
  BarChart3
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavigationGroup {
  groupName: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    groupName: 'Operations & Service',
    items: [
      { name: 'Command Center', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Restaurant POS', path: '/restaurant', icon: UtensilsCrossed },
      { name: 'Hotel PMS', path: '/hotel', icon: Building }
    ]
  },
  {
    groupName: 'Kitchen & Supply Chain',
    items: [
      { name: 'Kitchen & Production', path: '/production', icon: Flame },
      { name: 'Inventory & Stock', path: '/inventory', icon: Boxes },
      { name: 'Procurement & GRN', path: '/purchasing', icon: ShoppingCart }
    ]
  },
  {
    groupName: 'Governance & Finance',
    items: [
      { name: 'Staff & Payroll', path: '/hr', icon: Users },
      { name: 'Accounting & Ledger', path: '/accounting', icon: Calculator },
      { name: 'Approval Center', path: '/approvals', icon: ShieldCheck },
      { name: 'Executive Reports', path: '/reports', icon: BarChart3 }
    ]
  }
];

export const DesktopSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#0e0e12] border-r border-white/[0.07] flex-col hidden lg:flex shrink-0 select-none">
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
        {navigationGroups.map((group) => (
          <div key={group.groupName}>
            <p className="px-3 text-[10px] font-bold text-[#d4a437]/70 uppercase tracking-widest mb-2.5">
              {group.groupName}
            </p>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-[#d4a437]/15 text-[#d4a437] border border-[#d4a437]/30 shadow-sm font-semibold'
                          : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04]'
                      }`
                    }
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#d4a437]/20 text-[#d4a437] font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/[0.07]">
        <div className="bg-[#17171b] border border-white/[0.08] rounded-2xl p-3.5 text-xs text-neutral-400">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-[#3fbf6f] animate-pulse" />
            <p className="font-semibold text-neutral-200">Grand Heritage Enterprise</p>
          </div>
          <p className="text-[11px] text-[#d4a437] mt-1 font-medium">Enterprise Unified Architecture</p>
        </div>
      </div>
    </aside>
  );
};
