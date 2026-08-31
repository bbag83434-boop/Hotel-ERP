import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Records Found',
  description = 'There are no active records matching your current filter criteria or scope.',
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`p-12 text-center bg-white/80 backdrop-blur-xs rounded-2xl border border-[rgba(45,45,45,0.08)] space-y-3 shadow-xs ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] text-[#C79A3B] flex items-center justify-center mx-auto border border-[rgba(45,45,45,0.08)] shadow-xs">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-sm text-[#1C1C1C] font-['Outfit']">{title}</h4>
        <p className="text-xs text-[#707070] max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
