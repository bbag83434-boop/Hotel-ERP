import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, Boxes, ShoppingCart, Calculator } from 'lucide-react';

const mobileNavItems = [
  { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { name: 'POS', path: '/restaurant', icon: UtensilsCrossed },
  { name: 'Stock', path: '/inventory', icon: Boxes },
  { name: 'Procure', path: '/purchasing', icon: ShoppingCart },
  { name: 'Accounts', path: '/accounting', icon: Calculator }
];

export const MobileBottomNav: React.FC = () => {
  return (
    <nav aria-label="Mobile Navigation" className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0c0c0e]/95 backdrop-blur-lg border-t border-white/[0.08] z-40 px-2 py-1 pb-safe select-none">
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all duration-150 active:scale-95 ${
                  isActive ? 'text-[#d4a437] font-semibold' : 'text-neutral-400 font-normal hover:text-neutral-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-[#d4a437]/15 text-[#d4a437]' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] tracking-tight mt-0.5">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
