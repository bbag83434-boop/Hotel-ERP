from decimal import Decimal
from typing import Optional, List, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, ConfigDict

# -------------------------------------------------------------
# Category Schemas
# -------------------------------------------------------------
class CategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryResponse(BaseModel):
    id: str
    company_id: str
    name: str
    code: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# -------------------------------------------------------------
# Unit Schemas
# -------------------------------------------------------------
class UnitBase(BaseModel):
    name: str = Field(..., max_length=50)
    symbol: str = Field(..., max_length=20)

class UnitCreate(UnitBase):
    pass

class UnitUpdate(BaseModel):
    name: Optional[str] = None
    symbol: Optional[str] = None

class UnitResponse(BaseModel):
    id: str
    company_id: str
    name: str
    symbol: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# -------------------------------------------------------------
# Unit Conversion Schemas
# -------------------------------------------------------------
class UnitConversionCreate(BaseModel):
    from_unit_id: str
    to_unit_id: str
    conversion_factor: Decimal

class UnitConversionResponse(BaseModel):
    id: str
    company_id: str
    from_unit_id: str
    to_unit_id: str
    conversion_factor: Decimal
    from_unit_name: Optional[str] = None
    to_unit_name: Optional[str] = None
    from_unit_symbol: Optional[str] = None
    to_unit_symbol: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class UnitConvertRequest(BaseModel):
    value: Decimal
    from_unit: str  # id or symbol (e.g. "kg", "g", "l", "ml", "pcs", "dozen")
    to_unit: str    # id or symbol

class UnitConvertResponse(BaseModel):
    original_value: Decimal
    from_unit: str
    to_unit: str
    converted_value: Decimal
    conversion_factor: Decimal
    formula: Optional[str] = None

# -------------------------------------------------------------
# Item Schemas
# -------------------------------------------------------------
class ItemBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str = Field(..., max_length=50)
    category_id: str
    unit_id: str
    barcode: Optional[str] = None
    type: Optional[str] = "RAW_MATERIAL"
    description: Optional[str] = None
    cost_price: Optional[Decimal] = Decimal("0.0000")
    selling_price: Optional[Decimal] = Decimal("0.0000")
    min_stock_level: Optional[Decimal] = Decimal("0.0000")
    reorder_qty: Optional[Decimal] = Decimal("0.0000")
    is_active: Optional[bool] = True

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category_id: Optional[str] = None
    unit_id: Optional[str] = None
    barcode: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    min_stock_level: Optional[Decimal] = None
    reorder_qty: Optional[Decimal] = None
    is_active: Optional[bool] = None

class ItemResponse(BaseModel):
    id: str
    company_id: str
    category_id: str
    unit_id: str
    name: str
    code: str
    barcode: Optional[str] = None
    type: str
    description: Optional[str] = None
    cost_price: Decimal
    selling_price: Decimal
    min_stock_level: Decimal
    reorder_qty: Decimal
    is_active: bool
    category_name: Optional[str] = None
    unit_symbol: Optional[str] = None
    unit_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# -------------------------------------------------------------
# Stock Balance Schemas
# -------------------------------------------------------------
class StockBalanceResponse(BaseModel):
    id: str
    warehouse_id: str
    item_id: str
    quantity: Decimal
    min_stock_level: Optional[Decimal] = None
    reorder_qty: Optional[Decimal] = None
    avg_unit_cost: Optional[Decimal] = None
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    item_type: Optional[str] = None
    unit_symbol: Optional[str] = None
    warehouse_name: Optional[str] = None
    is_low_stock: bool = False
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class LowStockAlertResponse(BaseModel):
    warehouse_id: str
    warehouse_name: str
    item_id: str
    item_name: str
    item_code: str
    current_quantity: Decimal
    min_stock_level: Decimal
    reorder_qty: Decimal
    shortage: Decimal
    unit_symbol: Optional[str] = None

# -------------------------------------------------------------
# Stock Ledger Schemas
# -------------------------------------------------------------
class StockLedgerResponse(BaseModel):
    id: str
    warehouse_id: str
    item_id: str
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    movement_type: str
    change_qty: Decimal
    balance_qty: Decimal
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_by_id: Optional[str] = None
    created_at: Optional[datetime] = None
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    warehouse_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# -------------------------------------------------------------
# Stock Transfer Schemas
# -------------------------------------------------------------
class StockTransferItemCreate(BaseModel):
    item_id: str
    quantity: Decimal
    unit_cost: Optional[Decimal] = None
    notes: Optional[str] = None

class StockTransferItemResponse(BaseModel):
    id: str
    transfer_id: str
    item_id: str
    quantity: Decimal
    unit_cost: Optional[Decimal] = None
    notes: Optional[str] = None
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class StockTransferCreate(BaseModel):
    from_warehouse_id: str
    to_warehouse_id: str
    transfer_number: Optional[str] = None
    transfer_date: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[StockTransferItemCreate]

class StockTransferStatusUpdate(BaseModel):
    status: str  # "COMPLETED" or "CANCELLED"
    notes: Optional[str] = None

class StockTransferResponse(BaseModel):
    id: str
    company_id: str
    from_warehouse_id: str
    to_warehouse_id: str
    transfer_number: str
    status: str
    transfer_date: datetime
    notes: Optional[str] = None
    created_by_id: Optional[str] = None
    from_warehouse_name: Optional[str] = None
    to_warehouse_name: Optional[str] = None
    items: List[StockTransferItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# -------------------------------------------------------------
# Stock Count Schemas
# -------------------------------------------------------------
class StockCountItemCreate(BaseModel):
    item_id: str
    system_qty: Optional[Decimal] = None
    physical_qty: Decimal
    unit_cost: Optional[Decimal] = None
    batch_number: Optional[str] = None
    remarks: Optional[str] = None

class StockCountItemResponse(BaseModel):
    id: str
    stock_count_id: str
    item_id: str
    system_qty: Decimal
    physical_qty: Decimal
    variance_qty: Decimal
    unit_cost: Optional[Decimal] = None
    variance_value: Optional[Decimal] = None
    batch_number: Optional[str] = None
    remarks: Optional[str] = None
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class StockCountCreate(BaseModel):
    warehouse_id: str
    branch_id: Optional[str] = None
    count_number: Optional[str] = None
    count_date: Optional[datetime] = None
    notes: Optional[str] = None
    items: Optional[List[StockCountItemCreate]] = None

class StockCountSubmit(BaseModel):
    items: List[StockCountItemCreate]
    notes: Optional[str] = None

class StockCountResponse(BaseModel):
    id: str
    company_id: str
    branch_id: Optional[str] = None
    warehouse_id: str
    count_number: str
    count_date: datetime
    status: str
    created_by_id: Optional[str] = None
    verified_by_id: Optional[str] = None
    notes: Optional[str] = None
    warehouse_name: Optional[str] = None
    items: List[StockCountItemResponse] = []
    total_variance_value: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# -------------------------------------------------------------
# Direct Stock Adjustment Schemas
# -------------------------------------------------------------
class StockAdjustmentCreate(BaseModel):
    warehouse_id: str
    item_id: str
    change_qty: Decimal  # positive to add stock, negative to reduce stock
    movement_type: Optional[str] = "ADJUSTMENT"
    reason: str
    unit_cost: Optional[Decimal] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None

class StockAdjustmentResponse(BaseModel):
    success: bool
    ledger_entry_id: str
    warehouse_id: str
    item_id: str
    change_qty: Decimal
    new_balance: Decimal
    movement_type: str
    notes: Optional[str] = None

# -------------------------------------------------------------
# Part 8: Batch / Lot & Expiry Schemas
# -------------------------------------------------------------
class StockBatchCreate(BaseModel):
    warehouse_id: str
    item_id: str
    batch_number: str
    quantity: Decimal = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"))
    unit_cost: Decimal = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"))
    expiry_date: Optional[datetime] = None
    mfg_date: Optional[datetime] = None
    is_active: bool = True

class StockBatchUpdate(BaseModel):
    quantity: Optional[Decimal] = None
    unit_cost: Optional[Decimal] = None
    expiry_date: Optional[datetime] = None
    mfg_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class StockBatchResponse(BaseModel):
    id: str
    warehouse_id: str
    warehouse_name: Optional[str] = None
    item_id: str
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    unit_symbol: Optional[str] = None
    batch_number: str
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    expiry_date: Optional[datetime] = None
    mfg_date: Optional[datetime] = None
    is_expired: bool = False
    days_to_expiry: Optional[int] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# -------------------------------------------------------------
# Part 8: Store Location (Aisle/Rack/Shelf/Bin) Schemas
# -------------------------------------------------------------
class StoreLocationCreate(BaseModel):
    warehouse_id: str
    item_id: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    capacity: Optional[Decimal] = None

class StoreLocationUpdate(BaseModel):
    item_id: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    capacity: Optional[Decimal] = None

class StoreLocationResponse(BaseModel):
    id: str
    warehouse_id: str
    warehouse_name: Optional[str] = None
    item_id: Optional[str] = None
    item_name: Optional[str] = None
    item_code: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin: Optional[str] = None
    capacity: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# -------------------------------------------------------------
# Part 8: FIFO / FEFO Picking Engine Schemas
# -------------------------------------------------------------
class PickingAllocationItem(BaseModel):
    batch_id: str
    batch_number: str
    expiry_date: Optional[datetime] = None
    mfg_date: Optional[datetime] = None
    available_qty: Decimal
    allocated_qty: Decimal
    unit_cost: Decimal
    line_cost: Decimal

class PickingSuggestRequest(BaseModel):
    warehouse_id: str
    item_id: str
    requested_qty: Decimal = Field(gt=Decimal("0.0000"))
    strategy: str = Field(default="FEFO")  # "FEFO" (First-Expired, First-Out) or "FIFO" (First-In, First-Out)

class PickingSuggestResponse(BaseModel):
    warehouse_id: str
    item_id: str
    item_name: Optional[str] = None
    requested_qty: Decimal
    strategy: str
    is_fully_allocated: bool
    total_allocated_qty: Decimal
    shortage_qty: Decimal
    total_estimated_cost: Decimal
    allocations: List[PickingAllocationItem] = []

class PickingConsumeRequest(BaseModel):
    warehouse_id: str
    item_id: str
    requested_qty: Decimal = Field(gt=Decimal("0.0000"))
    strategy: str = Field(default="FEFO")  # "FEFO" or "FIFO"
    movement_type: str = "PRODUCTION_OUT"  # "PRODUCTION_OUT", "POS_SALE", "WASTAGE", etc.
    reference_type: str = "PICKING_ORDER"
    reference_id: Optional[str] = None
    notes: Optional[str] = None

class PickingConsumeResponse(BaseModel):
    success: bool
    warehouse_id: str
    item_id: str
    total_consumed_qty: Decimal
    total_cost: Decimal
    new_warehouse_balance: Decimal
    movement_type: str
    allocations: List[PickingAllocationItem] = []

# -------------------------------------------------------------
# Part 8: Thresholds & Reorder Recommendations Schemas
# -------------------------------------------------------------
class ReorderRecommendationItem(BaseModel):
    warehouse_id: str
    warehouse_name: str
    item_id: str
    item_name: str
    item_code: str
    unit_symbol: Optional[str] = None
    current_stock: Decimal
    min_stock_level: Decimal
    reorder_qty: Decimal
    suggested_order_qty: Decimal
    estimated_unit_cost: Decimal
    estimated_total_cost: Decimal
    urgency_level: str  # "CRITICAL", "HIGH", "MEDIUM"

class ReorderRecommendationResponse(BaseModel):
    total_items_to_reorder: int
    total_estimated_replenishment_cost: Decimal
    recommendations: List[ReorderRecommendationItem] = []

# -------------------------------------------------------------
# Part 8: Inventory Valuation Engine Schemas
# -------------------------------------------------------------
class WarehouseValuationItem(BaseModel):
    warehouse_id: str
    warehouse_name: str
    total_items_count: int
    total_stock_quantity: Decimal
    fifo_batch_value: Decimal
    weighted_avg_value: Decimal

class CategoryValuationItem(BaseModel):
    category_id: str
    category_name: str
    total_items_count: int
    total_stock_quantity: Decimal
    valuation_amount: Decimal

class ItemValuationItem(BaseModel):
    item_id: str
    item_name: str
    item_code: str
    category_name: Optional[str] = None
    unit_symbol: Optional[str] = None
    total_quantity: Decimal
    avg_unit_cost: Decimal
    total_value: Decimal
    active_batches_count: int

class InventoryValuationResponse(BaseModel):
    company_id: str
    total_inventory_value: Decimal
    total_skus: int
    warehouses: List[WarehouseValuationItem] = []
    categories: List[CategoryValuationItem] = []
    items: List[ItemValuationItem] = []

