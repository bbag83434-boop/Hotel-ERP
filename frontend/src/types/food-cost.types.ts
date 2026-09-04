export interface FoodCostMarkupOption {
  id: string;
  configId: string;
  label: string;
  percentage: number | string;
  isActive: boolean;
  sortOrder: number;
}

export interface FoodCostCostHead {
  id: string;
  configId: string;
  name: string;
  percentage: number | string;
  isActive: boolean;
  sortOrder: number;
}

export interface FoodCostConfigPublic {
  id: string;
  companyId: string;
  // Deliberately NO managementCostPercentage / cost heads: the Main page only
  // needs the enabled mark-up options. The private configuration is admin-only.
  activeMarkupOptions: FoodCostMarkupOption[];
}

export interface FoodCostConfigAdmin {
  id: string;
  companyId: string;
  managementCostPercentage: number;
  costHeads: FoodCostCostHead[];
  markupOptions: FoodCostMarkupOption[];
}

export interface FoodCostIngredientInput {
  itemId: string;
  quantity: number;
  unitId: string;
}

export interface FoodCostIngredientResult {
  itemId: string;
  itemName: string;
  itemCode: string;
  quantity: number | string;
  unitId: string;
  unitSymbol: string;
  normalizedQuantity: number | string;
  rate: number | string;
  ingredientCost: number | string;
}

export interface FoodCostCalculationRequest {
  ingredients: FoodCostIngredientInput[];
  calculationDate?: string;
  idempotencyKey?: string;
}

export interface FoodCostCalculationResponse {
  ingredients: FoodCostIngredientResult[];
  ingredientCost: number | string;
  managementCost: number | string;
  totalCost: number | string;
  selectedMarkup: number | string | null;
  finalSellingCost: number | string | null;
  calculationDate: string;
  idempotencyKey: string | null;
}

export interface FoodCostSnapshot {
  id: string;
  companyId: string;
  configId: string | null;
  calculationDate: string;
  idempotencyKey: string | null;
  snapshotData: Record<string, any>;
}

export interface FoodCostSnapshotList {
  snapshots: FoodCostSnapshot[];
  total: number;
}

export interface CostHeadUpdate {
  id?: string;
  name: string;
  percentage: number;
  isActive: boolean;
  sortOrder: number;
}

export interface MarkupOptionUpdate {
  id?: string;
  label: string;
  percentage: number;
  isActive: boolean;
  sortOrder: number;
}

export interface FoodCostConfigUpdate {
  costHeads?: CostHeadUpdate[];
  markupOptions?: MarkupOptionUpdate[];
}

