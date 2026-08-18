import React, { createContext, useContext, useState, useEffect } from 'react';
import { Outlet } from '../types';
import { apiClient } from '../api/client';

interface OutletContextType {
  outlets: Outlet[];
  activeOutlet: Outlet;
  setActiveOutlet: (outlet: Outlet) => void;
  isLoading: boolean;
  isHeadOffice: boolean;
}

// 14+ Baseline Multi-Outlet Topology matching Master Blueprint
const DEFAULT_TOPOLOGY: Outlet[] = [
  { id: 'hq', code: 'HQ', name: 'Head Office (Central Control)', type: 'HEAD_OFFICE', isActive: true },
  { id: 'cs-01', code: 'CS-01', name: 'Central Store (Warehouse)', type: 'CENTRAL_STORE', isActive: true },
  { id: 'dk-01', code: 'DK-01', name: 'Dessert Kitchen (Sweet Unit)', type: 'DESSERT_KITCHEN', isActive: true },
  { id: 'out-01', code: 'OUT-01', name: '01. Heritage Grand Bistro', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-02', code: 'OUT-02', name: '02. Palace Fine Dine', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-03', code: 'OUT-03', name: '03. Royal Banquet & Grill', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-04', code: 'OUT-04', name: '04. Lakeview Rooftop Lounge', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-05', code: 'OUT-05', name: '05. Golden Palm Cafe', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-06', code: 'OUT-06', name: '06. Spice Route Express', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-07', code: 'OUT-07', name: '07. City Heights Restaurant', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-08', code: 'OUT-08', name: '08. Emerald Bay Seafood', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-09', code: 'OUT-09', name: '09. Sapphire Court Trattoria', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-10', code: 'OUT-10', name: '10. Grand Pavilion Tavern', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-11', code: 'OUT-11', name: '11. Sunset Terrace Grill', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-12', code: 'OUT-12', name: '12. Silver Oak Coffee House', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-13', code: 'OUT-13', name: '13. Velvet Lounge & Bar', type: 'RESTAURANT_OUTLET', isActive: true },
  { id: 'out-14', code: 'OUT-14', name: '14. Crown & Anchor Pub', type: 'RESTAURANT_OUTLET', isActive: true },
];

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export const OutletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [outlets, setOutlets] = useState<Outlet[]>(DEFAULT_TOPOLOGY);
  const [activeOutlet, setActiveOutletState] = useState<Outlet>(() => {
    const saved = localStorage.getItem('apex_active_outlet_code');
    const match = DEFAULT_TOPOLOGY.find((o) => o.code === saved);
    return match || DEFAULT_TOPOLOGY[0];
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Attempt to load dynamic outlet topology from database health endpoint
    setIsLoading(true);
    apiClient
      .get('/health/outlets')
      .then((res) => {
        if (res.data?.success && res.data?.data?.outlets?.length > 0) {
          const dbOutlets: Outlet[] = res.data.data.outlets.map((b: any) => ({
            id: b.id,
            code: b.code,
            name: b.name,
            type: b.type === 'HOTEL' ? 'HOTEL' : b.type === 'HYBRID' ? 'HYBRID' : 'RESTAURANT_OUTLET',
            isActive: b.isActive ?? true,
          }));

          // Merge with core Head Office, Central Store, and Dessert Kitchen
          const combined = [
            DEFAULT_TOPOLOGY[0],
            DEFAULT_TOPOLOGY[1],
            DEFAULT_TOPOLOGY[2],
            ...dbOutlets.filter((o) => !['HQ', 'CS-01', 'DK-01'].includes(o.code)),
          ];
          setOutlets(combined);
        }
      })
      .catch(() => {
        // Fallback to default 14-outlet topology
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const setActiveOutlet = (outlet: Outlet) => {
    setActiveOutletState(outlet);
    localStorage.setItem('apex_active_outlet_id', outlet.id);
    localStorage.setItem('apex_active_outlet_code', outlet.code);
  };

  const isHeadOffice = activeOutlet.type === 'HEAD_OFFICE';

  return (
    <OutletContext.Provider
      value={{
        outlets,
        activeOutlet,
        setActiveOutlet,
        isLoading,
        isHeadOffice,
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
