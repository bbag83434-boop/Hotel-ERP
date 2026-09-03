export type ProductionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface RecipeIngredient {
  id: string;
  rawItemId: string;
  rawItem?: {
    id: string;
    name: string;
    code: string;
    costPrice: number | string;
    unit: { symbol: string };
    stockBalances?: Array<{ quantity: number | string; warehouse: { name: string } }>;
  };
  itemName?: string;
  item_name?: string;
  unitSymbol?: string;
  unit_symbol?: string;
  quantity: number | string;
  grossQuantity?: number | string;
  gross_quantity?: number | string;
  usableYield?: number | string;
  wastePercentage?: number | string;
  unitId?: string;
  unit?: { symbol: string };
  unitCost?: number | string;
  unit_cost?: number | string;
  costContribution?: number | string;
  cost_contribution?: number | string;
  notes?: string;
}

export interface Recipe {
  id: string;
  name: string;
  code: string;
  version?: number;
  effectiveDate?: string;
  effectiveTo?: string;
  isCurrent?: boolean;
  description?: string;
  finishedItemId: string;
  finished_item_id?: string;
  finishedItemName?: string;
  finished_item_name?: string;
  finishedItemCode?: string;
  finished_item_code?: string;
  finishedUnitSymbol?: string;
  finished_unit_symbol?: string;
  unitCost?: number | string;
  unit_cost?: number | string;
  totalRecipeCost?: number | string;
  total_recipe_cost?: number | string;
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
  instructions?: string;
  isActive: boolean;
  is_active?: boolean;
  ingredients: RecipeIngredient[];
  estimatedTotalCost?: number | string;
  estimatedUnitCost?: number | string;
  _count?: { productionOrders: number };
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
  kitchenWarehouse?: {
    id: string;
    name: string;
  };
  allIngredientsAvailable: boolean;
  all_ingredients_available?: boolean;
  totalEstimatedRawCost: number | string;
  total_estimated_raw_cost?: number | string;
  estimatedUnitFoodCost: number | string;
  estimated_unit_food_cost?: number | string;
  ingredients: ProductionPreviewIngredient[];
}

export interface ProductionConsumption {
  id: string;
  rawItemId: string;
  raw_item_id?: string;
  rawItem: { id: string; name: string; code: string; unit: { symbol: string } };
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
  orderNumber: string;
  order_number?: string;
  branchId: string;
  branch_id?: string;
  branch: { id: string; name: string; code: string };
  branch_name?: string;
  kitchenWarehouseId: string;
  kitchen_warehouse_id?: string;
  kitchenWarehouse: { id: string; name: string; code: string };
  warehouse_name?: string;
  recipeId: string;
  recipe_id?: string;
  recipe: {
    id: string;
    name: string;
    code: string;
    finishedItem: { id: string; name: string; code: string; unit: { symbol: string } };
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
  notes?: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  created_at?: string;
  createdAt?: string;
  consumptions: ProductionConsumption[];
}
