export interface ExecutiveDashboardMetrics {
  revenue: {
    total: number;
    posRevenue: number;
    hotelRevenue: number;
    roomRevenue: number;
    posCostOfGoods: number;
    grossProfit: number;
  };
  hospitality: {
    totalRooms: number;
    occupiedRooms: number;
    dirtyRooms: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
    totalBookings: number;
  };
  fnb: {
    totalOrders: number;
    salesCount: number;
    averageCheck: number;
  };
  inventory: {
    totalValuation: number;
    lowStockItems: number;
    totalPurchases: number;
    apOutstanding: number;
    totalItemsCount: number;
  };
  operations: {
    activeStaff: number;
    pendingLeaves: number;
    pendingApprovals: number;
    openMaintenance: number;
    pendingHousekeeping: number;
  };
  activityFeed: Array<{
    id: string;
    user: string;
    role: string;
    action: string;
    entity: string;
    createdAt: string;
  }>;
}

export interface AIAssistantResponse {
  answer: string;
  suggestedActions: Array<{ label: string; path: string }>;
  intent: string;
  timestamp: string;
}

export interface DailyTrendItem {
  date: string;
  sales: number;
  purchase: number;
}

export interface DashboardTrendResponse {
  trend: DailyTrendItem[];
}
