'use client';

import React from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Shared UI building blocks for the Project Setup Master Data modules        */
/* -------------------------------------------------------------------------- */

export type Feedback = { type: 'success' | 'error'; message: string };

export const ErrDetail = (err: any): string => {
  const d = err?.response?.data?.detail ?? err?.response?.data?.error?.message;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    if (d.message) {
      const refs = Array.isArray(d.references) ? d.references : [];
      return refs.length ? `${d.message} ${refs.join(' · ')}` : d.message;
    }
    return JSON.stringify(d) || err.message || 'Operation failed';
  }
  return err?.message || 'Operation failed';
};

export const FeedbackBanner: React.FC<{ feedback: Feedback | null; onDismiss: () => void }> = ({ feedback, onDismiss }) => {
  if (!feedback) return null;
  return (
    <div
      className={`p-3.5 rounded-xl text-xs flex items-center justify-between border animate-in fade-in duration-200 ${
        feedback.type === 'success'
          ? 'bg-[#2E8B57]/10 border-[#2E8B57]/30 text-[#2E8B57]'
          : 'bg-[#D9534F]/10 border-[#D9534F]/30 text-[#D9534F]'
      }`}
    >
      <div className="flex items-center gap-2">
        {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
        <span className="font-medium break-words">{feedback.message}</span>
      </div>
      <button onClick={onDismiss} className="ml-3 text-xs font-bold underline opacity-70 hover:opacity-100 shrink-0">
        Dismiss
      </button>
    </div>
  );
};

export const Modal: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, children }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[rgba(45,45,45,0.08)] pb-3">
          <div>
            <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">{title}</h3>
            {subtitle && <p className="text-[11px] text-[#707070] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-[#707070] hover:text-[#1C1C1C] text-sm font-bold">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({
  label,
  required,
  children,
  className = '',
}) => (
  <div className={className}>
    <label className="block text-[#707070] font-semibold mb-1">
      {label} {required && <span className="text-[#D9534F]">*</span>}
    </label>
    {children}
  </div>
);

export const inputCls =
  'w-full px-3 py-2 rounded-xl bg-white border border-[rgba(45,45,45,0.15)] focus:border-[#C79A3B] outline-none text-[#1C1C1C]';

export const CancelBtn: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Cancel' }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.12)] text-xs font-semibold text-[#707070] hover:text-[#1C1C1C] transition-all"
  >
    {label}
  </button>
);

export const SubmitBtn: React.FC<{ loading?: boolean; label?: string }> = ({ loading, label = 'Save' }) => (
  <button
    type="submit"
    disabled={loading}
    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C79A3B] to-[#B8862D] text-white text-xs font-semibold shadow-md shadow-[#C79A3B]/20 transition-all hover:brightness-105 active:scale-95 disabled:opacity-60"
  >
    {loading ? 'Saving...' : label}
  </button>
);

export const StatusPill: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
      active ? 'bg-[#2E8B57]/10 text-[#2E8B57] border-[#2E8B57]/30' : 'bg-[#D9534F]/10 text-[#D9534F] border-[#D9534F]/30'
    }`}
  >
    {active ? 'Active' : 'Inactive'}
  </span>
);

export const EmptyState: React.FC<{ message: string; icon?: React.ReactNode }> = ({ message, icon }) => (
  <div className="p-10 text-center text-[#707070] text-xs flex flex-col items-center gap-2.5">
    <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[rgba(45,45,45,0.08)] flex items-center justify-center text-[#C79A3B]">
      {icon || <X className="w-5 h-5" />}
    </div>
    <span>{message}</span>
  </div>
);

export const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ open, title, message, details, confirmLabel = 'Delete', loading, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[rgba(45,45,45,0.12)] space-y-3">
        <h3 className="font-bold text-base text-[#1C1C1C] font-['Outfit']">{title}</h3>
        <p className="text-xs text-[#707070] leading-relaxed">{message}</p>
        {details && details.length > 0 && (
          <ul className="space-y-1 text-[11px] text-[#D9534F] max-h-40 overflow-y-auto pr-1">
            {details.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(45,45,45,0.08)]">
          <CancelBtn onClick={onCancel} label="Cancel" />
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-[#D9534F] text-white text-xs font-semibold shadow-md hover:brightness-105 active:scale-95 disabled:opacity-60"
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ToggleSwitch: React.FC<{ active: boolean; onChange: () => void; title?: string }> = ({ active, onChange, title }) => (
  <button
    type="button"
    onClick={onChange}
    title={title}
    className={`relative w-9 h-5 rounded-full transition-colors ${active ? 'bg-[#2E8B57]' : 'bg-[#C4C4C4]'}`}
  >
    <span
      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${active ? 'left-[18px]' : 'left-0.5'}`}
    />
  </button>
);

export const CardActionRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pt-3 border-t border-[rgba(45,45,45,0.06)] flex items-center justify-between gap-2">{children}</div>
);

export const EditBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="px-2.5 py-1 rounded-lg bg-white border border-[rgba(45,45,45,0.12)] hover:bg-[#FAF8F5] text-[11px] font-semibold text-[#707070] hover:text-[#1C1C1C] flex items-center gap-1"
  >
    Edit
  </button>
);

export const DeleteBtn: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Delete' }) => (
  <button
    onClick={onClick}
    className="px-2.5 py-1 rounded-lg bg-white border border-[#D9534F]/30 hover:bg-[#D9534F]/10 text-[11px] font-semibold text-[#D9534F] flex items-center gap-1"
  >
    {label}
  </button>
);