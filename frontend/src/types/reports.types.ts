export interface GroupKpiMetric {
  totalRevenue: number;
  totalOrders: number;
  grossProfit: number;
  grossProfitMargin: number;
  totalCogs: number;
  foodCostPercentage: number;
  totalWastageLoss: number;
  wastagePercentage: number;
  totalProcurementSpend: number;
  activeOutletsCount: number;
  averageOrderValue: number;
}

export interface OutletRankingMetric {
  branchId: string;
  branchName: string;
  branchCode: string;
  revenue: number;
  ordersCount: number;
  foodCostPercentage: number;
  wastageCost: number;
  grossMarginPercentage: number;
  rank: number;
}

export interface ExecutiveDashboardResponse {
  periodStart: string;
  periodEnd: string;
  kpis: GroupKpiMetric;
  outletRankings: OutletRankingMetric[];
  dailyRevenueTrend: Array<{ date: string; revenue: number; orders: number }>;
  costBreakdown: {
    cogs: number;
    wastage: number;
    procurement: number;
  };
}

export interface SalesCategoryBreakdown {
  categoryId?: string;
  categoryName: string;
  itemCountSold: number;
  grossSales: number;
  percentageOfTotal: number;
}

export interface SalesItemBreakdown {
  itemId: string;
  itemName: string;
  itemCode: string;
  categoryName: string;
  quantitySold: number;
  unitPrice: number;
  totalSales: number;
}

export interface SalesDailyDataPoint {
  date: string;
  orderCount: number;
  guestCount: number;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalSales: number;
  averageOrderValue: number;
}

export interface SalesSummaryResponse {
  branchId?: string;
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  totalGuests: number;
  grossSales: number;
  netSales: number;
  totalTax: number;
  totalDiscount: number;
  averageOrderValue: number;
  byCategory: SalesCategoryBreakdown[];
  topSellingItems: SalesItemBreakdown[];
  dailyTrend: SalesDailyDataPoint[];
}

export interface ItemValuationSummary {
  itemId: string;
  itemName: string;
  itemCode: string;
  categoryName: string;
  warehouseName: string;
  currentStock: number;
  unitSymbol: string;
  costPrice: number;
  totalValuation: number;
  isLowStock: boolean;
}

export interface InventoryValuationResponse {
  branchId?: string;
  warehouseId?: string;
  totalValuation: number;
  totalItemsCount: number;
  lowStockItemsCount: number;
  byCategory: Record<string, number>;
  items: ItemValuationSummary[];
}

export interface OutletFoodCostMetric {
  branchId: string;
  branchName: string;
  totalSales: number;
  theoreticalCost: number;
  actualConsumptionCost: number;
  varianceAmount: number;
  theoreticalPercentage: number;
  actualPercentage: number;
  variancePercentage: number;
  status: 'NORMAL' | 'ALERT' | 'CRITICAL';
}

export interface FoodCostVarianceResponse {
  periodStart: string;
  periodEnd: string;
  consolidatedTheoreticalCost: number;
  consolidatedActualCost: number;
  consolidatedVariance: number;
  consolidatedFoodCostPercentage: number;
  outlets: OutletFoodCostMetric[];
}

export interface WastageSummaryReportResponse {
  periodStart: string;
  periodEnd: string;
  totalLossCost: number;
  totalEntriesCount: number;
  byReason: Record<string, number>;
  byOutlet: Array<{
    branch_id: string;
    branch_name: string;
    loss_cost: number;
    entries_count: number;
  }>;
  topWastedSkus: Array<{
    item_id: string;
    item_name: string;
    item_code: string;
    quantity: number;
    loss_cost: number;
  }>;
}

export interface SupplierSpendMetric {
  supplierId: string;
  supplierName: string;
  totalOrdersCount: number;
  totalSpend: number;
  percentageOfTotalSpend: number;
}

export interface ProcurementSummaryResponse {
  periodStart: string;
  periodEnd: string;
  totalPoSpend: number;
  totalPoCount: number;
  fulfilledPoCount: number;
  pendingPoCount: number;
  fulfillmentRatePercentage: number;
  topSuppliers: SupplierSpendMetric[];
}

export interface ReportExportRequest {
  reportType: 'EXECUTIVE_SUMMARY' | 'SALES_SUMMARY' | 'INVENTORY_VALUATION';
  format: 'CSV' | 'JSON';
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportExportResponse {
  filename: string;
  format: string;
  contentType: string;
  data: string;
}

export interface ReportSnapshot {
  id: string;
  companyId: string;
  branchId?: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedById?: string;
  title: string;
  metrics: Record<string, any>;
  summaryText?: string;
  createdAt: string;
}
