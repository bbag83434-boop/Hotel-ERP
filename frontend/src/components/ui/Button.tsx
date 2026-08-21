import React from 'react';
import { RefreshCw } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'gold'
  | 'success'
  | 'secondary'
  | 'danger'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold transition-all select-none rounded-xl active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-[#1C1C1C] hover:bg-[#2D2D2D] text-white shadow-xs',
    gold: 'bg-[#B8862D] hover:bg-[#9E7326] text-white shadow-xs',
    success: 'bg-[#2E8B57] hover:bg-[#257247] text-white shadow-xs',
    secondary:
      'bg-white border border-[rgba(45,45,45,0.15)] hover:bg-[#FAF8F5] text-[#1C1C1C] shadow-xs',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-xs',
    ghost:
      'bg-transparent hover:bg-[#FAF8F5] text-[#707070] hover:text-[#1C1C1C]',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-current shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default Button;
