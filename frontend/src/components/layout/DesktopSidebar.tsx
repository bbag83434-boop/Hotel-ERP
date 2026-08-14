import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  ShieldCheck
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Active & implemented modules (Part 1 - Part 4 only)
export const navigationItems: NavigationItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Inventory & Stores', path: '/inventory', icon: Boxes },
  { name: 'Suppliers & Vendors', path: '/purchasing', icon: ShoppingCart },
  { name: 'Approval Center', path: '/approvals', icon: ShieldCheck }
];

export const DesktopSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-col hidden lg:flex shrink-0">
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Operations & Stores
          </p>
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-200">Hotel Management Cloud</p>
          <p className="text-[10px] text-amber-400 mt-0.5 font-medium">Core Enterprise • Active Parts 1–4</p>
        </div>
      </div>
    </aside>
  );
};
