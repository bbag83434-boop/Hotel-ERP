'use client';

import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Boxes,
  ShoppingCart,
  CalendarDays,
} from 'lucide-react';

interface BottomNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab = 'dashboard', setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'organization', label: 'Outlets', icon: Building2 },
    { id: 'inventory', label: 'Stock', icon: Boxes },
    { id: 'purchase', label: 'Purchase', icon: ShoppingCart },
    { id: 'closing', label: 'Closing', icon: CalendarDays },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-[rgba(45,45,45,0.08)] pb-safe md:hidden shadow-[0_-2px_12px_rgba(45,45,45,0.04)]">
      <div className="flex items-center justify-around py-2 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab?.(item.id)}
              className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive ? 'text-[#B8862D]' : 'text-[#707070] hover:text-[#1C1C1C]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#B8862D]" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-semibold text-[#B8862D]' : ''}`}>
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
