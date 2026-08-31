import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

interface AlertBannerProps {
  feedback: FeedbackState | null;
  onClose?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  feedback,
  onClose,
  className = '',
}) => {
  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';

  return (
    <div
      role="alert"
      className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in duration-200 ${
        isSuccess
          ? 'bg-[#2E8B57]/10 text-[#2E8B57] border border-[#2E8B57]/20'
          : 'bg-red-500/10 text-red-600 border border-red-500/20'
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {isSuccess ? (
          <CheckCircle2 className="w-4 h-4 text-[#2E8B57] shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
        )}
        <span className="leading-relaxed">{feedback.message}</span>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss Alert"
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AlertBanner;
