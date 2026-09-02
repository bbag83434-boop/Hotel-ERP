'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Outlet, BranchType } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from './AuthContext';

export interface BiMonthlyPeriodInfo {
  periodType: 'FIRST_HALF' | 'SECOND_HALF';
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  label: string;
}

export function getCurrentClosingPeriod(): BiMonthlyPeriodInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const isFirstHalf = day <= 15;
  const periodType = isFirstHalf ? 'FIRST_HALF' : 'SECOND_HALF';
  const startDay = isFirstHalf ? 1 : 16;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const endDay = isFirstHalf ? 15 : lastDayOfMonth;

  const startDate = new Date(Date.UTC(year, month - 1, startDay, 0, 0, 0)).toISOString();
  const endDate = new Date(Date.UTC(year, month - 1, endDay, 23, 59, 59, 999)).toISOString();
  const daysRemaining = Math.max(0, endDay - day);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthStr = monthNames[month - 1];
  const label = `${monthStr} ${year} - ${isFirstHalf ? '1st Half (1–15)' : '2nd Half (16–End)'}`;

  return {
    periodType,
    year,
    month,
    startDate,
    endDate,
    daysRemaining,
    label,
  };
}

export function mapBranchType(type?: string, code?: string): BranchType {
  if (!type && !code) return 'RESTAURANT_OUTLET';
  const t = (type || '').toUpperCase();
  const c = (code || '').toUpperCase();
  if (t === 'HEAD_OFFICE' || c.includes('HQ') || t === 'HYBRID') return 'HEAD_OFFICE';
  if (t === 'CENTRAL_STORE' || c.includes('CS-') || c.startsWith('HUB-')) return 'CENTRAL_STORE';
  if (t === 'DESSERT_KITCHEN' || c.includes('DK-') || c.startsWith('SWEET-')) return 'DESSERT_KITCHEN';
  if (t === 'HOTEL') return 'HOTEL';
  if (t === 'HYBRID') return 'HYBRID';
  return 'RESTAURANT_OUTLET';
}

interface OutletContextType {
  outlets: Outlet[];
  currentOutlet: Outlet;
  activeOutlet: Outlet;
  setActiveOutlet: (outlet: Outlet) => void;
  isLoading: boolean;
  isHeadOffice: boolean;
  closingInfo: BiMonthlyPeriodInfo;
  refreshOutlets: () => Promise<void>;
}

export const UNSELECTED_OUTLET: Outlet = {
  id: '',
  code: '',
  name: 'Select Branch / Outlet',
  type: 'RESTAURANT_OUTLET',
  isActive: true,
};

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export const OutletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutlet, setActiveOutletState] = useState<Outlet>(() => {
    if (typeof window !== 'undefined') {
      const savedId = sessionStorage.getItem('apex_active_outlet_id');
      const savedCode = sessionStorage.getItem('apex_active_outlet_code');
      const savedName = sessionStorage.getItem('apex_active_outlet_name');
      const savedType = sessionStorage.getItem('apex_active_outlet_type') as BranchType;
      if (savedId && savedCode && savedName) {
        return {
          id: savedId,
          code: savedCode,
          name: savedName,
          type: savedType || 'RESTAURANT_OUTLET',
          isActive: true,
        };
      }
    }
    return UNSELECTED_OUTLET;
  });
  const [isLoading, setIsLoading] = useState(false);
  const closingInfo = getCurrentClosingPeriod();

  const fetchOutlets = useCallback(async () => {
    setIsLoading(true);
    try {
      // If user has assigned branches in profile, prioritize them
      const assignedBranches = user?.assigned_branches || user?.assignedBranches;
      if (assignedBranches && assignedBranches.length > 0) {
        const mappedUserBranches: Outlet[] = assignedBranches.map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          type: mapBranchType(b.type, b.code),
          isActive: true,
        }));
        setOutlets(mappedUserBranches);

        // Sync active branch if set in user profile
        const activeBr = user?.active_branch || user?.activeBranch;
        if (activeBr) {
          const match = mappedUserBranches.find((o) => o.id === activeBr.id || o.code === activeBr.code);
          if (match) {
            setActiveOutletState(match);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('apex_active_outlet_id', match.id);
              sessionStorage.setItem('apex_active_outlet_code', match.code);
              sessionStorage.setItem('apex_active_outlet_name', match.name);
              sessionStorage.setItem('apex_active_outlet_type', match.type);
            }
          }
        }
        return;
      }

      // If authenticated, fetch full branch list from /organization/branches
      if (isAuthenticated) {
        try {
          const orgRes = await apiClient.get('/organization/branches');
          if (Array.isArray(orgRes.data)) {
            const liveBranches: Outlet[] = orgRes.data.map((b: any) => ({
              id: b.id,
              code: b.code,
              name: b.name,
              type: mapBranchType(b.type, b.code),
              isActive: b.is_active ?? true,
            }));
            setOutlets(liveBranches);

            // Re-sync current active outlet if it exists in live list
            const savedId = typeof window !== 'undefined' ? sessionStorage.getItem('apex_active_outlet_id') : null;
            const savedCode = typeof window !== 'undefined' ? sessionStorage.getItem('apex_active_outlet_code') : null;
            if (savedId || savedCode) {
              const matched = liveBranches.find((o) => o.id === savedId || o.code === savedCode);
              if (matched) {
                setActiveOutletState(matched);
              }
            }
            return;
          }
        } catch {
          // Fall through to public health check if organization endpoint is restricted
        }
      }

      // Public health outlets endpoint fallback
      const res = await apiClient.get('/health/outlets');
      if (res.data?.success && Array.isArray(res.data?.data?.outlets)) {
        const dbOutlets: Outlet[] = res.data.data.outlets.map((b: any) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          type: mapBranchType(b.type, b.code),
          isActive: b.isActive ?? true,
        }));
        setOutlets(dbOutlets);

        const savedId = typeof window !== 'undefined' ? sessionStorage.getItem('apex_active_outlet_id') : null;
        const savedCode = typeof window !== 'undefined' ? sessionStorage.getItem('apex_active_outlet_code') : null;
        if (savedId || savedCode) {
          const matched = dbOutlets.find((o) => o.id === savedId || o.code === savedCode);
          if (matched) {
            setActiveOutletState(matched);
          }
        }
      }
    } catch {
      // Keep state as-is
    } finally {
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  const setActiveOutlet = (outlet: Outlet) => {
    setActiveOutletState(outlet);
    if (typeof window !== 'undefined') {
      if (outlet.id) {
        sessionStorage.setItem('apex_active_outlet_id', outlet.id);
        sessionStorage.setItem('apex_active_outlet_code', outlet.code);
        sessionStorage.setItem('apex_active_outlet_name', outlet.name);
        sessionStorage.setItem('apex_active_outlet_type', outlet.type);
      } else {
        sessionStorage.removeItem('apex_active_outlet_id');
        sessionStorage.removeItem('apex_active_outlet_code');
        sessionStorage.removeItem('apex_active_outlet_name');
        sessionStorage.removeItem('apex_active_outlet_type');
      }
    }
  };

  const isHeadOffice = Boolean(activeOutlet?.id && activeOutlet.type === 'HEAD_OFFICE');

  return (
    <OutletContext.Provider
      value={{
        outlets,
        currentOutlet: activeOutlet,
        activeOutlet,
        setActiveOutlet,
        isLoading,
        isHeadOffice,
        closingInfo,
        refreshOutlets: fetchOutlets,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
};

export function useOutlet(): OutletContextType {
  const context = useContext(OutletContext);
  if (!context) {
    if (typeof window === 'undefined') {
      return {
        outlets: [],
        currentOutlet: UNSELECTED_OUTLET,
        activeOutlet: UNSELECTED_OUTLET,
        setActiveOutlet: () => {},
        isLoading: false,
        isHeadOffice: false,
        closingInfo: { periodType: 'FIRST_HALF', year: 2026, month: 1, startDate: '', endDate: '', daysRemaining: 0, label: '' },
        refreshOutlets: async () => {},
      };
    }
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  return context;
}

export default OutletProvider;
