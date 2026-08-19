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

// 14+ Baseline Multi-Outlet Topology using valid PostgreSQL UUIDs matching live database
const DEFAULT_TOPOLOGY: Outlet[] = [
  { id: 'fc4715cd-5a35-4d4c-9472-456356de0660', code: 'BR-HQ-01', name: 'Main HQ & Resort (Central Control)', type: 'HEAD_OFFICE', isActive: true },
  { id: 'bd1f233e-fa09-45ba-bd1a-7247bd359dc0', code: 'HUB-0F0987', name: 'Apex Central Warehouse (CS-01)', type: 'CENTRAL_STORE', isActive: true },
  { id: '5cb45b8e-a90c-45c9-84f3-c43db7121beb', code: 'SWEET-HUB-406C8A', name: 'Apex Central Bakery & Sweet Kitchen (DK-01)', type: 'DESSERT_KITCHEN', isActive: true },
  { id: '1cc67b61-070a-49ac-8a19-8734f479e755', code: 'BR-BISTRO-01', name: '01. Royal Heritage Bistro & Lounge', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'c90e1dfd-0538-43bd-aab5-055f4714aa85', code: 'BR-HOTEL-01', name: '02. Grand Heritage Resort & Palace', type: 'HOTEL', isActive: true },
  { id: '8cacf01e-c586-4efe-91c8-8759741bad34', code: 'BR-OUTLET-A', name: '03. Downtown Palace Fine Dine', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'e8715900-9b2e-441b-ac2c-e6be8fbd7325', code: 'BR-OUTLET-B', name: '04. Heritage Sweet & Bakery Shop', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: '6b093f72-c526-40c4-b49f-6babff145e0f', code: 'OUT-070BFD', name: '05. Apex Seaside Bistro Premium', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: '7f126117-cced-4649-93be-575361d555ed', code: 'OUT-117407', name: '06. Apex Fine Dining Lakeview', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: '770ddd92-9bfc-4adb-8e86-3c8fcc3349ed', code: 'OUT-3BBCD4', name: '07. Royal Banquet & Grill', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: '6025c3b5-7c4b-4ed4-a6e3-5b1f56b23197', code: 'OUT-4017CC', name: '08. Golden Palm Grand Cafe', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: '2d303c00-1961-41cc-a594-47a820f81886', code: 'OUT-425ACC', name: '09. Spice Route Express', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: '906ed86b-c7a2-409a-9f08-31f0eb1ddbb3', code: 'OUT-AAE4BA', name: '10. City Heights Rooftop Bar', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: '48494947-90d6-4d6a-b86c-41600aca7461', code: 'OUT-B6F404', name: '11. Emerald Bay Seafood Trattoria', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'e5a36cfe-d7dd-4e59-916d-dda136373a68', code: 'OUT-B88B0C', name: '12. Grand Pavilion Tavern', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'a439f316-4dc2-4092-87f8-4f1fdc43b3bd', code: 'OUT-D7DA36', name: '13. Silver Oak Coffee House', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'ee670ddf-aef9-4e62-b1e7-ebe563efc3c8', code: 'OUT-E2F690', name: '14. Velvet Crown & Anchor Pub', type: 'RESTAURANT_OUTLET', isActive: true },
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
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  return context;
}

export default OutletProvider;
