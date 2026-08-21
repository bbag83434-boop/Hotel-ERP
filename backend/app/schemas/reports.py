from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# --- Base & Snapshot Schemas ---
class ReportSnapshotCreate(BaseModel):
    branch_id: Optional[str] = Field(None, alias="branchId")
    report_type: str = Field(..., alias="reportType")
    period_start: datetime = Field(..., alias="periodStart")
    period_end: datetime = Field(..., alias="periodEnd")
    title: str
    metrics: Dict[str, Any]
    summary_text: Optional[str] = Field(None, alias="summaryText")

    class Config:
        populate_by_name = True

class ReportSnapshotResponse(BaseModel):
    id: str
    company_id: str = Field(..., alias="companyId")
    branch_id: Optional[str] = Field(None, alias="branchId")
    report_type: str = Field(..., alias="reportType")
    period_start: datetime = Field(..., alias="periodStart")
    period_end: datetime = Field(..., alias="periodEnd")
    generated_at: datetime = Field(..., alias="generatedAt")
    generated_by_id: Optional[str] = Field(None, alias="generatedById")
    title: str
    metrics: Dict[str, Any]
    summary_text: Optional[str] = Field(None, alias="summaryText")
    created_at: datetime = Field(..., alias="createdAt")

    class Config:
        populate_by_name = True
        from_attributes = True

# --- Executive Summary Schemas ---
class GroupKpiMetric(BaseModel):
    total_revenue: Decimal = Field(..., alias="totalRevenue")
    total_orders: int = Field(..., alias="totalOrders")
    gross_profit: Decimal = Field(..., alias="grossProfit")
    gross_profit_margin: Decimal = Field(..., alias="grossProfitMargin")
    total_cogs: Decimal = Field(..., alias="totalCogs")
    food_cost_percentage: Decimal = Field(..., alias="foodCostPercentage")
    total_wastage_loss: Decimal = Field(..., alias="totalWastageLoss")
    wastage_percentage: Decimal = Field(..., alias="wastagePercentage")
    total_procurement_spend: Decimal = Field(..., alias="totalProcurementSpend")
    active_outlets_count: int = Field(..., alias="activeOutletsCount")
    average_order_value: Decimal = Field(..., alias="averageOrderValue")

    class Config:
        populate_by_name = True

class OutletRankingMetric(BaseModel):
    branch_id: str = Field(..., alias="branchId")
    branch_name: str = Field(..., alias="branchName")
    branch_code: str = Field(..., alias="branchCode")
    revenue: Decimal
    orders_count: int = Field(..., alias="ordersCount")
    food_cost_percentage: Decimal = Field(..., alias="foodCostPercentage")
    wastage_cost: Decimal = Field(..., alias="wastageCost")
    gross_margin_percentage: Decimal = Field(..., alias="grossMarginPercentage")
    rank: int

    class Config:
        populate_by_name = True

class ExecutiveDashboardResponse(BaseModel):
    period_start: datetime = Field(..., alias="periodStart")
    period_end: datetime = Field(..., alias="periodEnd")
    kpis: GroupKpiMetric
    outlet_rankings: List[OutletRankingMetric] = Field(..., alias="outletRankings")
    daily_revenue_trend: List[Dict[str, Any]] = Field(..., alias="dailyRevenueTrend")
    cost_breakdown: Dict[str, Decimal] = Field(..., alias="costBreakdown")

    class Config:
        populate_by_name = True

# --- Sales Summary Schemas ---
class SalesCategoryBreakdown(BaseModel):
    category_id: Optional[str] = Field(None, alias="categoryId")
    category_name: str = Field(..., alias="categoryName")
    item_count_sold: int = Field(..., alias="itemCountSold")
    gross_sales: Decimal = Field(..., alias="grossSales")
    percentage_of_total: Decimal = Field(..., alias="percentageOfTotal")

    class Config:
        populate_by_name = True

class SalesItemBreakdown(BaseModel):
    item_id: str = Field(..., alias="itemId")
    item_name: str = Field(..., alias="itemName")
    item_code: str = Field(..., alias="itemCode")
    category_name: str = Field(..., alias="categoryName")
    quantity_sold: int = Field(..., alias="quantitySold")
    unit_price: Decimal = Field(..., alias="unitPrice")
    total_sales: Decimal = Field(..., alias="totalSales")

    class Config:
        populate_by_name = True

class SalesDailyDataPoint(BaseModel):
    date: str
    order_count: int = Field(..., alias="orderCount")
    guest_count: int = Field(..., alias="guestCount")
    sub_total: Decimal = Field(..., alias="subTotal")
    tax_amount: Decimal = Field(..., alias="taxAmount")
    discount_amount: Decimal = Field(..., alias="discountAmount")
    total_sales: Decimal = Field(..., alias="totalSales")
    average_order_value: Decimal = Field(..., alias="averageOrderValue")

    class Config:
        populate_by_name = True

class SalesSummaryResponse(BaseModel):
    branch_id: Optional[str] = Field(None, alias="branchId")
    period_start: datetime = Field(..., alias="periodStart")
    period_end: datetime = Field(..., alias="periodEnd")
    total_orders: int = Field(..., alias="totalOrders")
    total_guests: int = Field(..., alias="totalGuests")
    gross_sales: Decimal = Field(..., alias="grossSales")
    net_sales: Decimal = Field(..., alias="netSales")
    total_tax: Decimal = Field(..., alias="totalTax")
    total_discount: Decimal = Field(..., alias="totalDiscount")
    average_order_value: Decimal = Field(..., alias="averageOrderValue")
    by_category: List[SalesCategoryBreakdown] = Field(..., alias="byCategory")
    top_selling_items: List[SalesItemBreakdown] = Field(..., alias="topSellingItems")
    daily_trend: List[SalesDailyDataPoint] = Field(..., alias="dailyTrend")

    class Config:
        populate_by_name = True

# --- Inventory Valuation Schemas ---
class ItemValuationSummary(BaseModel):
    item_id: str = Field(..., alias="itemId")
    item_name: str = Field(..., alias="itemName")
    item_code: str = Field(..., alias="itemCode")
    category_name: str = Field(..., alias="categoryName")
    warehouse_name: str = Field(..., alias="warehouseName")
    current_stock: Decimal = Field(..., alias="currentStock")
    unit_symbol: str = Field(..., alias="unitSymbol")
    cost_price: Decimal = Field(..., alias="costPrice")
    total_valuation: Decimal = Field(..., alias="totalValuation")
    is_low_stock: bool = Field(..., alias="isLowStock")

    class Config:
        populate_by_name = True

class InventoryValuationResponse(BaseModel):
    branch_id: Optional[str] = Field(None, alias="branchId")
    warehouse_id: Optional[str] = Field(None, alias="warehouseId")
    total_valuation: Decimal = Field(..., alias="totalValuation")
    total_items_count: int = Field(..., alias="totalItemsCount")
    low_stock_items_count: int = Field(..., alias="lowStockItemsCount")
    by_category: Dict[str, Decimal] = Field(..., alias="byCategory")
    items: List[ItemValuationSummary]

    class Config:
        populate_by_name = True

# --- Food Cost Variance Schemas ---
class OutletFoodCostMetric(BaseModel):
    branch_id: str = Field(..., alias="branchId")
    branch_name: str = Field(..., alias="branchName")
    total_sales: Decimal = Field(..., alias="totalSales")
    theoretical_cost: Decimal = Field(..., alias="theoreticalCost")
    actual_consumption_cost: Decimal = Field(..., alias="actualConsumptionCost")
    variance_amount: Decimal = Field(..., alias="varianceAmount")
    theoretical_percentage: Decimal = Field(..., alias="theoreticalPercentage")
    actual_percentage: Decimal = Field(..., alias="actualPercentage")
    variance_percentage: Decimal = Field(..., alias="variancePercentage")
    status: str  # NORMAL, ALERT, CRITICAL

    class Config:
        populate_by_name = True

class FoodCostVarianceResponse(BaseModel):
    period_start: datetime = Field(..., alias="periodStart")
    period_end: datetime = Field(..., alias="periodEnd")
    consolidated_theoretical_cost: Decimal = Field(..., alias="consolidatedTheoreticalCost")
    consolidated_actual_cost: Decimal = Field(..., alias="consolidatedActualCost")
    consolidated_variance: Decimal = Field(..., alias="consolidatedVariance")
    consolidated_food_cost_percentage: Decimal = Field(..., alias="consolidatedFoodCostPercentage")
    outlets: List[OutletFoodCostMetric]

    class Config:
        populate_by_name = True

# --- Wastage Report Schemas ---
class WastageSummaryReportResponse(BaseModel):
    period_start: datetime = Field(..., alias="periodStart")
    period_end: datetime = Field(..., alias="periodEnd")
    total_loss_cost: Decimal = Field(..., alias="totalLossCost")
    total_entries_count: int = Field(..., alias="totalEntriesCount")
    by_reason: Dict[str, Decimal] = Field(..., alias="byReason")
    by_outlet: List[Dict[str, Any]] = Field(..., alias="byOutlet")
    top_wasted_skus: List[Dict[str, Any]] = Field(..., alias="topWastedSkus")

    class Config:
        populate_by_name = True

# --- Procurement Summary Schemas ---
class SupplierSpendMetric(BaseModel):
    supplier_id: str = Field(..., alias="supplierId")
    supplier_name: str = Field(..., alias="supplierName")
    total_orders_count: int = Field(..., alias="totalOrdersCount")
    total_spend: Decimal = Field(..., alias="totalSpend")
    percentage_of_total_spend: Decimal = Field(..., alias="percentageOfTotalSpend")

    class Config:
        populate_by_name = True

class ProcurementSummaryResponse(BaseModel):
    period_start: datetime = Field(..., alias="periodStart")
    period_end: datetime = Field(..., alias="periodEnd")
    total_po_spend: Decimal = Field(..., alias="totalPoSpend")
    total_po_count: int = Field(..., alias="totalPoCount")
    fulfilled_po_count: int = Field(..., alias="fulfilledPoCount")
    pending_po_count: int = Field(..., alias="pendingPoCount")
    fulfillment_rate_percentage: Decimal = Field(..., alias="fulfillmentRatePercentage")
    top_suppliers: List[SupplierSpendMetric] = Field(..., alias="topSuppliers")

    class Config:
        populate_by_name = True

# --- Export Schemas ---
class ReportExportRequest(BaseModel):
    report_type: str = Field(..., alias="reportType")
    format: str = "CSV"  # "CSV" or "JSON"
    branch_id: Optional[str] = Field(None, alias="branchId")
    start_date: Optional[datetime] = Field(None, alias="startDate")
    end_date: Optional[datetime] = Field(None, alias="endDate")

    class Config:
        populate_by_name = True

class ReportExportResponse(BaseModel):
    filename: str
    format: str
    content_type: str = Field(..., alias="contentType")
    data: str

    class Config:
        populate_by_name = True
