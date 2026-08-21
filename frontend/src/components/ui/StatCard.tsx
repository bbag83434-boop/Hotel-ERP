import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor?: string;
  trend?: {
    value: string | number;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-[#FAF8F5] text-[#C79A3B]',
  trend,
  onClick,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-white/85 backdrop-blur-md border border-[rgba(45,45,45,0.08)] shadow-[0_4px_20px_-2px_rgba(45,45,45,0.04)] space-y-2 transition-all ${
        onClick
          ? 'cursor-pointer hover:border-[#C79A3B]/40 hover:shadow-[0_10px_30px_-4px_rgba(199,154,59,0.12)] active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between text-[#707070]">
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl ${iconBgColor}`}>{icon}</div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold text-[#1C1C1C] font-['Outfit'] tracking-tight">
          {value}
        </p>
        {trend && (
          <span
            className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded-md ${
              trend.isPositive
                ? 'bg-[#2E8B57]/15 text-[#2E8B57]'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] text-[#707070] font-medium truncate">{subtitle}</p>
      )}
    </div>
  );
};

export default StatCard;
