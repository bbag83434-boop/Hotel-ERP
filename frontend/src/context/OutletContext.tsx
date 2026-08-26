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
  isCentralStore: boolean;
  canInitiateTransfers: boolean;
  closingInfo: BiMonthlyPeriodInfo;
  refreshOutlets: () => Promise<void>;
}

// Clean Baseline Multi-Outlet Topology matching fresh database state
const DEFAULT_TOPOLOGY: Outlet[] = [
  { id: 'cb-main-hq', code: 'HQ-MAIN', name: 'CB Hotel Management (Main)', type: 'HEAD_OFFICE', isActive: true },
];

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export const OutletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>(DEFAULT_TOPOLOGY);
  const [activeOutlet, setActiveOutletState] = useState<Outlet>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('apex_active_outlet_id');
      const savedCode = localStorage.getItem('apex_active_outlet_code');
      const match = DEFAULT_TOPOLOGY.find((o) => o.id === savedId || o.code === savedCode);
      if (match) return match;
    }
    return DEFAULT_TOPOLOGY[0];
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

        // Sync active branch if set
        const activeBr = user?.active_branch || user?.activeBranch;
        if (activeBr) {
          const match = mappedUserBranches.find((o) => o.id === activeBr.id || o.code === activeBr.code);
          if (match) {
            setActiveOutletState(match);
            if (typeof window !== 'undefined') {
              localStorage.setItem('apex_active_outlet_id', match.id);
              localStorage.setItem('apex_active_outlet_code', match.code);
            }
          }
        }
        return;
      }

      // If authenticated, fetch full branch list from /organization/branches
      if (isAuthenticated) {
        try {
          const orgRes = await apiClient.get('/organization/branches');
          if (Array.isArray(orgRes.data) && orgRes.data.length > 0) {
            const liveBranches: Outlet[] = orgRes.data.map((b: any) => ({
              id: b.id,
              code: b.code,
              name: b.name,
              type: mapBranchType(b.type, b.code),
              isActive: b.is_active ?? true,
            }));
            setOutlets(liveBranches);

            // Re-sync current active outlet if it exists in live list
            const savedId = typeof window !== 'undefined' ? localStorage.getItem('apex_active_outlet_id') : null;
            const savedCode = typeof window !== 'undefined' ? localStorage.getItem('apex_active_outlet_code') : null;
            const matched = liveBranches.find((o) => o.id === savedId || o.code === savedCode);
            if (matched) {
              setActiveOutletState(matched);
            } else if (liveBranches.length > 0) {
              setActiveOutletState(liveBranches[0]);
              if (typeof window !== 'undefined') {
                localStorage.setItem('apex_active_outlet_id', liveBranches[0].id);
                localStorage.setItem('apex_active_outlet_code', liveBranches[0].code);
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
      if (res.data?.success && res.data?.data?.outlets?.length > 0) {
        const dbOutlets: Outlet[] = res.data.data.outlets.map((b: any) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          type: mapBranchType(b.type, b.code),
          isActive: b.isActive ?? true,
        }));
        setOutlets(dbOutlets);

        const savedId = typeof window !== 'undefined' ? localStorage.getItem('apex_active_outlet_id') : null;
        const savedCode = typeof window !== 'undefined' ? localStorage.getItem('apex_active_outlet_code') : null;
        const matched = dbOutlets.find((o) => o.id === savedId || o.code === savedCode);
        if (matched) {
          setActiveOutletState(matched);
        } else if (dbOutlets.length > 0) {
          setActiveOutletState(dbOutlets[0]);
          if (typeof window !== 'undefined') {
            localStorage.setItem('apex_active_outlet_id', dbOutlets[0].id);
            localStorage.setItem('apex_active_outlet_code', dbOutlets[0].code);
          }
        }
      }
    } catch {
      // Keep DEFAULT_TOPOLOGY fallback with real UUIDs
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
      localStorage.setItem('apex_active_outlet_id', outlet.id);
      localStorage.setItem('apex_active_outlet_code', outlet.code);
    }
  };

  const isHeadOffice = activeOutlet.type === 'HEAD_OFFICE';
  const isCentralStore = activeOutlet.type === 'CENTRAL_STORE';
  const canInitiateTransfers = isHeadOffice || isCentralStore;

  return (
    <OutletContext.Provider
      value={{
        outlets,
        currentOutlet: activeOutlet,
        activeOutlet,
        setActiveOutlet,
        isLoading,
        isHeadOffice,
        isCentralStore,
        canInitiateTransfers,
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
        currentOutlet: { id: 'dummy', code: 'DUMMY', name: 'Dummy', type: 'RESTAURANT_OUTLET', isActive: true },
        activeOutlet: { id: 'dummy', code: 'DUMMY', name: 'Dummy', type: 'RESTAURANT_OUTLET', isActive: true },
        setActiveOutlet: () => {},
        isLoading: false,
        isHeadOffice: false,
        isCentralStore: false,
        canInitiateTransfers: false,
        closingInfo: { periodType: 'FIRST_HALF', year: 2026, month: 1, startDate: '', endDate: '', daysRemaining: 0, label: '' },
        refreshOutlets: async () => {},
      };
    }
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  return context;
}

export default OutletProvider;
