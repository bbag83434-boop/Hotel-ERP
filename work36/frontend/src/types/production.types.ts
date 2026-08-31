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
  itemCode?: string;
  itemType?: string;
  unitSymbol?: string;
  quantity: number | string;
  grossQuantity?: number | string;
  usableYield?: number | string;
  wastePercentage?: number | string;
  unitId?: string;
  unit?: { symbol: string };
  /** Live rate from inventory item cost_price — never hardcoded */
  unitCost?: number | string;
  /** Computed: grossQuantity × unitCost */
  costContribution?: number | string;
  isSubRecipe?: boolean;
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
  finishedItemName?: string;
  finishedItemCode?: string;
  finishedUnitSymbol?: string;
  /** Live-calculated total batch ingredient cost (backend-computed, never hardcoded) */
  totalRecipeCost?: number | string;
  /** Cost per finished unit = totalRecipeCost / yieldQty */
  unitCost?: number | string;
  /** User-stored selling price per finished unit — never auto-overwritten by rate changes */
  sellingPricePerUnit?: number | string;
  /** Expected sales value = sellingPricePerUnit × yieldQty */
  expectedSalesValue?: number | string;
  /** Gross profit = expectedSalesValue − totalRecipeCost */
  grossProfit?: number | string;
  /** Gross margin % = grossProfit / expectedSalesValue × 100 */
  grossMarginPct?: number | string;
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
  preparationMinutes?: number;
  instructions?: string;
  isActive: boolean;
  ingredients: RecipeIngredient[];
  estimatedTotalCost?: number | string;
  estimatedUnitCost?: number | string;
  _count?: { productionOrders: number };
}

export interface ProductionPreviewIngredient {
  rawItemId: string;
  rawItemName: string;
  rawItemCode: string;
  unitSymbol: string;
  standardRequiredQty: number | string;
  currentStockInKitchen: number | string;
  isAvailable: boolean;
  shortageQty: number | string;
  unitCost: number | string;
  totalCost: number | string;
}

export interface ProductionPreview {
  recipe: {
    id: string;
    name: string;
    code: string;
    finishedItem: string;
    standardYield: number | string;
  };
  plannedQty: number | string;
  kitchenWarehouse: {
    id: string;
    name: string;
  };
  allIngredientsAvailable: boolean;
  totalEstimatedRawCost: number | string;
  estimatedUnitFoodCost: number | string;
  ingredients: ProductionPreviewIngredient[];
}

export interface ProductionConsumption {
  id: string;
  rawItemId: string;
  rawItem: { id: string; name: string; code: string; unit: { symbol: string } };
  standardQty: number | string;
  actualConsumedQty: number | string;
  unitCost: number | string;
  totalCost: number | string;
}

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  branchId: string;
  branch: { id: string; name: string; code: string };
  kitchenWarehouseId: string;
  kitchenWarehouse: { id: string; name: string; code: string };
  recipeId: string;
  recipe: {
    id: string;
    name: string;
    code: string;
    finishedItem: { id: string; name: string; code: string; unit: { symbol: string } };
  };
  plannedQty: number | string;
  actualYieldQty: number | string;
  wastageQty: number | string;
  status: ProductionStatus;
  plannedDate: string;
  completedDate?: string;
  totalRawCost: number | string;
  unitFoodCost: number | string;
  notes?: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  consumptions: ProductionConsumption[];
}
