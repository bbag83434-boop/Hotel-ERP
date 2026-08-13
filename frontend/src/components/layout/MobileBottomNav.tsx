import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Hotel, UtensilsCrossed, ChefHat, DollarSign } from 'lucide-react';

const mobileNavItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Hotel PMS', path: '/hotel', icon: Hotel },
  { name: 'POS Dining', path: '/restaurant', icon: UtensilsCrossed },
  { name: 'Kitchen KDS', path: '/production', icon: ChefHat },
  { name: 'Accounting', path: '/accounting', icon: DollarSign }
];

export const MobileBottomNav: React.FC = () => {
  return (
    <nav aria-label="Mobile Navigation" className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 z-40 px-2 py-1 pb-safe">
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 active:scale-95 ${
                  isActive ? 'text-rose-400 font-bold' : 'text-slate-400 font-normal hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-rose-500/15' : ''}`}>
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
