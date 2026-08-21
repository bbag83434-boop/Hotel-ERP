import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  maxWidth = 'md',
}) => {
  // ESC Key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      {/* Outside click detector */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div
        className={`relative z-10 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full ${maxWidthStyles[maxWidth]} space-y-3 sm:space-y-4 shadow-2xl border border-[rgba(45,45,45,0.1)] max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150 my-auto`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[rgba(45,45,45,0.06)] pb-2.5 sm:pb-3 gap-2">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C] flex items-center gap-2 font-['Outfit'] truncate">
              {icon && <span className="text-[#C79A3B] shrink-0">{icon}</span>}
              <span className="truncate">{title}</span>
            </h3>
            {subtitle && <p className="text-[11px] sm:text-xs text-[#707070] truncate">{subtitle}</p>}
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-[#FAF8F5] transition-colors shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-3 sm:space-y-4 text-xs">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
