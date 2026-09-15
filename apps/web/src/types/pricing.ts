export type PricingStatus =
  | "HEALTHY"
  | "BELOW_TARGET"
  | "PRICE_BELOW_COST"
  | "COST_INCREASE"
  | "MISSING_COST";

export type PricingSettings = {
  targetMarginPercent: number;
  costIncreaseAlertPercent: number;
  roundingStep: number;
};

export type PricingIngredient = {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
  availableQuantity: number;
  unitCost: number | null;
  costAmount: number;
  isEstimated: boolean;
  isShort: boolean;
};

export type PricingBranchCost = {
  branchId: number;
  branchCode: string;
  branchName: string;
  recipeCost: number;
  missingCost: boolean;
  hasEstimatedCost: boolean;
  hasStockShortage: boolean;
};

export type PricingRecommendation = {
  variantId: number;
  productId: number;
  productName: string;
  size: string;
  category: { id: number; name: string };
  currentPrice: number;
  recipeCost: number;
  currentMarginPercent: number;
  suggestedPrice: number | null;
  priceDifference: number | null;
  last30DaysQuantity: number;
  currentUnitProfit: number;
  suggestedUnitProfit: number | null;
  estimatedMonthlyProfitCurrent: number;
  estimatedMonthlyProfitSuggested: number | null;
  estimatedMonthlyProfitDifference: number | null;
  costIncreasePercent: number | null;
  previousRecipeCost: number | null;
  status: PricingStatus;
  costBasisBranch: { id: number; code: string; name: string };
  hasEstimatedCost: boolean;
  hasStockShortage: boolean;
  ingredients: PricingIngredient[];
  branchCosts: PricingBranchCost[];
};

export type PricingReport = {
  generatedAt: string;
  scope: "BRANCH" | "CHAIN";
  selectedBranchId: number | null;
  settings: PricingSettings;
  branches: Array<{ id: number; code: string; name: string }>;
  summary: {
    totalVariants: number;
    healthy: number;
    belowTarget: number;
    belowCost: number;
    costIncrease: number;
    missingCost: number;
  };
  recommendations: PricingRecommendation[];
};

export type ProductPriceHistoryItem = {
  id: number;
  productId: number | null;
  variantId: number | null;
  productName: string;
  size: string | null;
  oldPrice: number;
  newPrice: number;
  recipeCost: number;
  targetMarginPercent: number;
  costIncreasePercent: number | null;
  reason: string | null;
  createdAt: string;
  actorName: string;
  branch: { id: number; code: string; name: string } | null;
};
