import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

  const variants = {
    primary: 'bg-[#d4a437] hover:bg-[#b88c2c] text-black font-semibold shadow-md shadow-[#d4a437]/15 focus:ring-[#d4a437] focus:ring-offset-[#0c0c0e]',
    secondary: 'bg-[#17171b] hover:bg-[#222228] text-white border border-white/[0.08] focus:ring-neutral-500 focus:ring-offset-[#0c0c0e]',
    outline: 'border border-white/[0.12] text-neutral-300 hover:bg-white/[0.05] hover:text-white focus:ring-neutral-500 focus:ring-offset-[#0c0c0e]',
    danger: 'bg-[#e5544d] hover:bg-[#c93e38] text-white shadow-md shadow-[#e5544d]/20 focus:ring-[#e5544d] focus:ring-offset-[#0c0c0e]',
    ghost: 'text-neutral-400 hover:text-white hover:bg-white/[0.06] focus:ring-neutral-500 focus:ring-offset-[#0c0c0e]'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-semibold gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base font-semibold gap-2.5'
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
};
