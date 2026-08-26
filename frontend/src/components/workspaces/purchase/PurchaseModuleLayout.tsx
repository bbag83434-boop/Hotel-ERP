'use client';

import React, { useEffect } from 'react';
import { useOutlet } from '@/context/OutletContext';
import {
  FileText,
  PackageCheck,
  Upload,
  Boxes,
  ShieldCheck,
  Truck,
  Receipt,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';

export type PurchaseSectionId =
  | 'requisitions'
  | 'receiving'
  | 'upload_bills'
  | 'stock'
  | 'approvals'
  | 'orders'
  | 'bills_payments'
  | 'needs_attention'
  | 'transfers'
  | 'reports'
  | 'setup';

interface NavItem {
  id: PurchaseSectionId;
  label: string;
  icon: React.ElementType;
  badge?: string | null;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const PURCHASE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Day to Day',
    items: [
      { id: 'requisitions', label: 'Requisitions', icon: FileText },
      { id: 'receiving', label: 'Receiving', icon: PackageCheck },
      { id: 'upload_bills', label: 'Upload Bills', icon: Upload, badge: 'Coming soon' },
      { id: 'stock', label: 'Stock', icon: Boxes },
    ],
  },
  {
    label: 'Head Office',
    items: [
      { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
      { id: 'orders', label: 'Orders', icon: Truck },
      { id: 'bills_payments', label: 'Bills & Payments', icon: Receipt, badge: 'Coming soon' },
      { id: 'needs_attention', label: 'Needs Attention', icon: AlertTriangle, badge: 'Coming soon' },
      { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'setup', label: 'Setup', icon: SlidersHorizontal },
    ],
  },
];

// Sections that are only permitted for Head Office users.
const HEAD_OFFICE_SECTIONS: PurchaseSectionId[] = [
  'approvals',
  'orders',
  'bills_payments',
  'needs_attention',
  'transfers',
  'reports',
  'setup',
];

interface PurchaseModuleLayoutProps {
  activeSection: PurchaseSectionId;
  onSectionChange: (section: PurchaseSectionId) => void;
  children: React.ReactNode;
}

export const PurchaseModuleLayout: React.FC<PurchaseModuleLayoutProps> = ({
  activeSection,
  onSectionChange,
  children,
}) => {
  const { isHeadOffice } = useOutlet();

  // If a stale state / deep-link points to a Head-Office-only section while the
  // active outlet is NOT Head Office, force it back to the 'requisitions' queue.
  useEffect(() => {
    if (!isHeadOffice && HEAD_OFFICE_SECTIONS.includes(activeSection)) {
      onSectionChange('requisitions');
    }
  }, [isHeadOffice, activeSection, onSectionChange]);

  // "Day to Day" always renders; the "Head Office" group is only present for
  // Head Office users (fully absent — not collapsed/disabled — otherwise).
  const visibleGroups = PURCHASE_NAV_GROUPS.filter(
    (group) =>
      isHeadOffice || group.items.some((item) => !HEAD_OFFICE_SECTIONS.includes(item.id))
  );

  return (
    <div className="flex flex-col md:flex-row gap-5 items-start w-full min-w-0">
      {/* 1. Sub-Sidebar Navigation for Desktop (md+) */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white rounded-3xl border border-[rgba(45,45,45,0.08)] p-4 shadow-sm sticky top-20">
        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#707070]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 active:scale-[0.98] ${
                        isActive
                          ? 'bg-[#F1E4C5] text-[#B8862D] font-bold shadow-xs border border-[#B8862D]/30'
                          : 'text-[#505050] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#B8862D] stroke-[2.2]' : 'text-[#707070] stroke-[1.8]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-[#FAF8F5] text-[#707070] border border-[rgba(45,45,45,0.08)] shrink-0">
                          {item.badge}
                        </span>
                      ) : isActive ? (
                        <ChevronRight className="w-3.5 h-3.5 text-[#B8862D] shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* 2. Mobile Responsive Sub-Nav Bar (< md) */}
      <div className="md:hidden w-full overflow-x-auto pb-2 -mt-1">
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs w-max">
          {visibleGroups.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#F1E4C5] text-[#B8862D] font-bold border border-[#B8862D]/30'
                    : 'text-[#707070] hover:text-[#1C1C1C] hover:bg-[#FAF8F5]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#B8862D]' : 'text-[#707070]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Dynamic Content Area */}
      <div className="flex-1 w-full min-w-0">{children}</div>
    </div>
  );
};

export default PurchaseModuleLayout;
