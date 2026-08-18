'use client';

import React from 'react';
import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  CalendarDays,
  Activity,
} from 'lucide-react';

interface BottomNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab = 'dashboard', setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'outlets', label: 'Outlets', icon: Building2 },
    { id: 'purchasing', label: 'Central PO', icon: ShoppingCart },
    { id: 'closing', label: 'Closing', icon: CalendarDays },
    { id: 'diagnostics', label: 'Health', icon: Activity },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c0e]/95 backdrop-blur-lg border-t border-white/[0.08] pb-safe sm:hidden">
      <div className="flex items-center justify-around py-2 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab?.(item.id)}
              className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive ? 'text-[#d4a437]' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#d4a437]" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

