'use client';

import React from 'react';
import {
  ClipboardList,
  PackageCheck,
  Upload,
  Boxes,
  CheckCircle2,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  Truck,
  BarChart3,
  Settings2,
  type LucideIcon,
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

interface PurchaseNavItem {
  id: PurchaseSectionId;
  label: string;
  icon: LucideIcon;
}

const dayToDay: PurchaseNavItem[] = [
  { id: 'requisitions', label: 'Requisitions', icon: ClipboardList },
  { id: 'receiving', label: 'Receiving', icon: PackageCheck },
  { id: 'upload_bills', label: 'Upload Bills', icon: Upload },
  { id: 'stock', label: 'Stock', icon: Boxes },
];

const headOffice: PurchaseNavItem[] = [
  { id: 'approvals', label: 'Approvals', icon: CheckCircle2 },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'bills_payments', label: 'Bills & Payments', icon: Receipt },
  { id: 'needs_attention', label: 'Needs Attention', icon: AlertTriangle },
  { id: 'transfers', label: 'Transfers', icon: Truck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'setup', label: 'Setup', icon: Settings2 },
];

interface PurchaseModuleLayoutProps {
  activeSection: PurchaseSectionId;
  onSectionChange: (section: PurchaseSectionId) => void;
  children: React.ReactNode;
}

const NavItem: React.FC<{
  item: PurchaseNavItem;
  active: boolean;
  onClick: () => void;
}> = ({ item, active, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150 active:scale-[0.98] ${
        active
          ? 'bg-[#F1E4C5] text-[#B8862D] font-bold shadow-sm border border-[#B8862D]/30'
          : 'text-[#505050] hover:text-[#1C1C1C] hover:bg-[#FAF8F5] border border-transparent'
      }`}
    >
      <Icon
        className={`w-4 h-4 ${
          active ? 'text-[#B8862D] stroke-[2.2]' : 'text-[#707070] stroke-[1.8]'
        }`}
      />
      <span className="truncate">{item.label}</span>
    </button>
  );
};

export const PurchaseModuleLayout: React.FC<PurchaseModuleLayoutProps> = ({
  activeSection,
  onSectionChange,
  children,
}) => {
  return (
    <div className="space-y-4">
      {/* Mobile nested navigation */}
      <div className="md:hidden bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs p-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#707070] px-1">Day to Day</span>
          {dayToDay.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold border transition-all ${
                  active
                    ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30'
                    : 'text-[#505050] border-transparent bg-[#FAF8F5]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#707070] px-1 ml-1">Head Office</span>
          {headOffice.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold border transition-all ${
                  active
                    ? 'bg-[#F1E4C5] text-[#B8862D] border-[#B8862D]/30'
                    : 'text-[#505050] border-transparent bg-[#FAF8F5]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop two-column layout; the content is mounted only once. */}
      <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)] gap-4 items-start">
        <aside className="hidden md:block bg-white rounded-2xl border border-[rgba(45,45,45,0.08)] shadow-xs p-3 sticky top-4">
          <div className="px-3 pb-2 mb-2 border-b border-[rgba(45,45,45,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#707070]">Purchase</p>
            <p className="text-[11px] text-[#999] mt-0.5">Module navigation</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#707070]">Day to Day</p>
              {dayToDay.map((item) => (
                <NavItem key={item.id} item={item} active={activeSection === item.id} onClick={() => onSectionChange(item.id)} />
              ))}
            </div>
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#707070]">Head Office</p>
              {headOffice.map((item) => (
                <NavItem key={item.id} item={item} active={activeSection === item.id} onClick={() => onSectionChange(item.id)} />
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );

};

export default PurchaseModuleLayout;
