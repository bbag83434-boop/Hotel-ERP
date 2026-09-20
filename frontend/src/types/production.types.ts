export type ProductionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RecipeIngredient {
  id: string;

  recipeId?: string;
  recipe_id?: string;

  rawItemId: string;
  raw_item_id?: string;

  rawItem?: {
    id: string;
    name: string;
    code: string;
    costPrice: number | string;
    unit: { symbol: string };
    stockBalances?: Array<{
      quantity: number | string;
      warehouse: { name: string };
    }>;
  };

  itemName?: string;
  item_name?: string;

  itemCode?: string;
  item_code?: string;

  itemType?: string;
  item_type?: string;

  unitSymbol?: string;
  unit_symbol?: string;

  quantity: number | string;

  grossQuantity?: number | string;
  gross_quantity?: number | string;

  usableYield?: number | string;
  usable_yield?: number | string;

  wastePercentage?: number | string;
  waste_percentage?: number | string;

  unitId?: string;
  unit_id?: string;

  unit?: {
    symbol: string;
  };

  unitCost?: number | string;
  unit_cost?: number | string;

  costContribution?: number | string;
  cost_contribution?: number | string;

  isSubRecipe?: boolean;
  is_sub_recipe?: boolean;

  subRecipeId?: string;
  sub_recipe_id?: string;

  notes?: string;
}

export interface Recipe {
  id: string;

  companyId?: string;
  company_id?: string;

  name: string;
  code: string;

  version?: number;

  effectiveDate?: string;
  effective_date?: string;

  effectiveTo?: string;
  effective_to?: string;

  isCurrent?: boolean;
  is_current?: boolean;

  description?: string;

  finishedItemId: string;
  finished_item_id?: string;

  finishedItemName?: string;
  finished_item_name?: string;

  finishedItemCode?: string;
  finished_item_code?: string;

  finishedUnitSymbol?: string;
  finished_unit_symbol?: string;

  finishedItem?: {
    id: string;
    name: string;
    code: string;
    costPrice: number | string;
    sellingPrice: number | string;
    unit: { symbol: string };
    category?: { name: string };
  };

  yieldQty: number | string;
  yield_qty?: number | string;

  preparationMinutes?: number;
  preparation_minutes?: number;

  instructions?: string;

  isActive: boolean;
  is_active?: boolean;

  totalRecipeCost?: number | string;
  total_recipe_cost?: number | string;

  unitCost?: number | string;
  unit_cost?: number | string;

  createdAt?: string;
  created_at?: string;

  updatedAt?: string;
  updated_at?: string;

  ingredients: RecipeIngredient[];

  estimatedTotalCost?: number | string;
  estimatedUnitCost?: number | string;

  _count?: {
    productionOrders: number;
  };
}

export interface ProductionPreviewIngredient {
  rawItemId: string;
  raw_item_id?: string;

  rawItemName: string;
  item_name?: string;

  rawItemCode: string;
  item_code?: string;

  unitSymbol: string;
  unit_symbol?: string;

  standardRequiredQty: number | string;
  standard_qty_per_unit_yield?: number | string;

  required_qty?: number | string;

  currentStockInKitchen: number | string;
  available_qty?: number | string;

  isAvailable: boolean;
  is_sufficient?: boolean;

  shortageQty: number | string;
  shortage_qty?: number | string;

  unitCost: number | string;
  unit_cost?: number | string;

  totalCost: number | string;
  total_cost?: number | string;

  fifo_batches?: string[];

  fifoBatches?: string[];
}

export interface ProductionPreview {
  recipe?: {
    id: string;
    name: string;
    code: string;
    finishedItem: string;
    standardYield: number | string;
  };

  recipe_id?: string;
  recipe_name?: string;

  plannedQty: number | string;
  planned_qty?: number | string;

  multiplier?: number | string;

  kitchenWarehouse?: {
    id: string;
    name: string;
  };

  kitchen_warehouse_id?: string;

  allIngredientsAvailable: boolean;
  all_ingredients_available?: boolean;

  totalEstimatedRawCost: number | string;
  total_estimated_raw_cost?: number | string;

  estimatedUnitFoodCost: number | string;
  estimated_unit_food_cost?: number | string;

  finishedItemName?: string;
  finished_item_name?: string;

  ingredients: ProductionPreviewIngredient[];
}

export interface ProductionConsumption {
  id: string;

  productionOrderId?: string;
  production_order_id?: string;

  rawItemId: string;
  raw_item_id?: string;

  stockBatchId?: string;
  stock_batch_id?: string;

  batchNumber?: string;
  batch_number?: string;

  rawItem?: {
    id: string;
    name: string;
    code: string;
    unit: { symbol: string };
  };

  rawItemName?: string;
  raw_item_name?: string;

  rawItemCode?: string;
  raw_item_code?: string;

  unitSymbol?: string;
  unit_symbol?: string;

  standardQty: number | string;
  standard_qty?: number | string;

  actualConsumedQty: number | string;
  actual_consumed_qty?: number | string;

  unitCost: number | string;
  unit_cost?: number | string;

  totalCost: number | string;
  total_cost?: number | string;
}

export interface ProductionOrder {
  id: string;

  companyId?: string;
  company_id?: string;

  orderNumber: string;
  order_number?: string;

  branchId: string;
  branch_id?: string;

  branch: {
    id: string;
    name: string;
    code: string;
  };

  branch_name?: string;

  kitchenWarehouseId: string;
  kitchen_warehouse_id?: string;

  kitchenWarehouse: {
    id: string;
    name: string;
    code: string;
  };

  warehouse_name?: string;

  recipeId: string;
  recipe_id?: string;

  recipe: {
    id: string;
    name: string;
    code: string;
    finishedItem: {
      id: string;
      name: string;
      code: string;
      unit: { symbol: string };
    };
  };

  recipe_name?: string;
  recipe_code?: string;

  finishedItemId?: string;
  finished_item_id?: string;

  finishedItemName?: string;
  finished_item_name?: string;

  finishedItemCode?: string;
  finished_item_code?: string;

  finishedUnitSymbol?: string;
  finished_unit_symbol?: string;

  plannedQty: number | string;
  planned_qty?: number | string;

  actualYieldQty: number | string;
  actual_yield_qty?: number | string;

  wastageQty: number | string;
  wastage_qty?: number | string;

  status: ProductionStatus;

  plannedDate: string;
  planned_date?: string;

  completedDate?: string;
  completed_date?: string;

  totalRawCost: number | string;
  total_raw_cost?: number | string;

  unitFoodCost: number | string;
  unit_food_cost?: number | string;

  yieldVariancePercent?: number | string;
  yield_variance_percent?: number | string;

  notes?: string;

  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };

  createdById?: string;
  created_by_id?: string;

  created_at?: string;
  createdAt?: string;

  updated_at?: string;
  updatedAt?: string;

  consumptions: ProductionConsumption[];
}
