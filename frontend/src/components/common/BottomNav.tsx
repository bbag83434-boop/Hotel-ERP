'use client';

import React from 'react';
import { useOutlet } from '@/context/OutletContext';
import {
  LayoutDashboard,
  Building2,
  Boxes,
  ShoppingCart,
  CalendarDays,
  Sparkles,
  AlertTriangle,
  Truck,
} from 'lucide-react';

interface BottomNavProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab = 'dashboard', setActiveTab }) => {
  const { isHeadOffice, canInitiateTransfers } = useOutlet();

  const navItems = isHeadOffice
    ? [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'assistant', label: 'AI Intel', icon: Sparkles },
        { id: 'inventory', label: 'Stock', icon: Boxes },
        { id: 'purchase', label: 'Purchase', icon: ShoppingCart },
        { id: 'closing', label: 'Closing', icon: CalendarDays },
      ]
    : [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'assistant', label: 'AI Intel', icon: Sparkles },
        { id: 'purchase', label: 'Purchase', icon: ShoppingCart },
        { id: 'wastage', label: 'Wastage', icon: AlertTriangle },
        ...(canInitiateTransfers ? [{ id: 'transfers', label: 'Transfers', icon: Truck }] : []),
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[rgba(45,45,45,0.08)] pb-safe md:hidden shadow-[0_-4px_20px_rgba(45,45,45,0.06)]">
      <div className="flex items-center justify-around px-1.5 py-1.5 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab?.(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 active:scale-90 min-h-[44px] ${
                isActive ? 'text-[#B8862D]' : 'text-[#707070] hover:text-[#1C1C1C]'
              }`}
              aria-label={item.label}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-[#F1E4C5] text-[#B8862D] shadow-xs scale-105' : ''
                }`}
              >
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight ${
                  isActive ? 'font-bold text-[#B8862D]' : 'font-medium text-[#707070]'
                }`}
              >
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
