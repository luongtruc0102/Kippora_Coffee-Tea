export type IngredientUnit = "GRAM" | "MILLILITER" | "PIECE";

export type InventoryState =
  "NOT_TRACKED" | "RESERVED" | "CONSUMED" | "RELEASED";

export type Ingredient = {
  id: number;
  name: string;
  unit: IngredientUnit;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryBranch = {
  id: number;
  code: string;
  name: string;
  address: string;
};

export type InventoryRow = {
  ingredient: Ingredient;
  isConfigured: boolean;
  stockId: number | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumLevel: number;
  isLow: boolean;
  updatedAt: string | null;
};

export type InventoryMovement = {
  id: number;
  type: "ADJUST" | "RECEIVE" | "RESERVE" | "RELEASE" | "CONSUME";
  quantityDelta: number | string;
  reservedDelta: number | string;
  quantityAfter: number | string;
  reservedAfter: number | string;
  note: string | null;
  createdAt: string;
  ingredient: Ingredient;
  actor: { id: number; fullName: string | null; email: string } | null;
};

export type Supplier = {
  id: number;
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { stockReceipts: number };
};

export type SupplierInput = {
  code: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
};

export type StockReceiptStatus = "DRAFT" | "COMPLETED" | "CANCELLED";

export type StockReceiptItem = {
  id: number;
  receiptId: number;
  ingredientId: number;
  ingredient: Ingredient;
  quantity: number | string;
  unitCost: number | string;
  lineTotal: number | string;
  batchCode: string | null;
  manufacturedAt: string | null;
  expiresAt: string | null;
  lotNote: string | null;
  lots: InventoryLot[];
};

export type StockReceipt = {
  id: number;
  code: string;
  branchId: number;
  branch: InventoryBranch;
  supplierId: number;
  supplier: Supplier;
  createdById: number;
  createdBy: { id: number; fullName: string | null; email: string };
  status: StockReceiptStatus;
  receivedAt: string | null;
  note: string | null;
  totalCost: number | string;
  items: StockReceiptItem[];
  createdAt: string;
  updatedAt: string;
};

export type StockReceiptInput = {
  branchId: number;
  supplierId: number;
  note?: string;
  items: Array<{
    ingredientId: number;
    quantity: number;
    unitCost: number;
    batchCode?: string;
    manufacturedAt?: string;
    expiresAt?: string;
    lotNote?: string;
  }>;
};

export type StockReceiptList = {
  selectedBranch: InventoryBranch;
  branches: InventoryBranch[];
  receipts: StockReceipt[];
  summary: {
    total: number;
    draft: number;
    completed: number;
    totalCost: number;
  };
};

export type InventoryCountStatus =
  "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type InventoryVarianceReason =
  "BREAKAGE" | "SPOILAGE" | "EXPIRED" | "LOSS" | "COUNTING_ERROR" | "OTHER";

export type InventoryCountItem = {
  id: number;
  inventoryCountId: number;
  ingredientId: number;
  ingredient: Ingredient;
  expectedQuantity: number;
  countedQuantity: number;
  differenceQuantity: number;
  reason: InventoryVarianceReason | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryCount = {
  id: number;
  code: string;
  branchId: number;
  branch: InventoryBranch;
  createdById: number;
  createdBy: { id: number; fullName: string | null; email: string };
  reviewedById: number | null;
  reviewedBy: { id: number; fullName: string | null; email: string } | null;
  status: InventoryCountStatus;
  countedAt: string;
  note: string | null;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  items: InventoryCountItem[];
  createdAt: string;
  updatedAt: string;
};

export type InventoryCountInput = {
  branchId: number;
  countedAt: string;
  note?: string;
  items: Array<{
    ingredientId: number;
    countedQuantity: number;
    reason?: InventoryVarianceReason;
    note?: string;
  }>;
};

export type InventoryCountList = {
  selectedBranch: InventoryBranch;
  branches: InventoryBranch[];
  counts: InventoryCount[];
  summary: {
    total: number;
    draft: number;
    pending: number;
    approved: number;
    shortageItems: number;
  };
};

export type InventoryLotStatus = "ACTIVE" | "DEPLETED" | "DISPOSED";
export type InventoryLotExpiryState = "SAFE" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";

export type InventoryLot = {
  id: number;
  code: string;
  batchCode: string | null;
  branchId: number;
  branch: InventoryBranch;
  ingredientId: number;
  ingredient: Ingredient;
  stockReceiptItemId: number | null;
  stockReceiptItem: { receipt: { id: number; code: string } } | null;
  manufacturedAt: string | null;
  expiresAt: string | null;
  receivedAt: string;
  initialQuantity: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unitCost: number;
  inventoryValue: number;
  status: InventoryLotStatus;
  isLegacy: boolean;
  note: string | null;
  daysToExpiry: number | null;
  expiryState: InventoryLotExpiryState;
  createdAt: string;
  updatedAt: string;
};

export type InventoryLotDetail = InventoryLot & {
  allocations: Array<{
    id: number;
    quantity: number;
    unitCost: number;
    costAmount: number;
    state: InventoryState;
    order: { id: number; status: string; createdAt: string };
    createdAt: string;
  }>;
  disposals: Array<{
    id: number;
    quantity: number;
    reason: InventoryVarianceReason;
    note: string | null;
    actor: { id: number; fullName: string | null; email: string } | null;
    createdAt: string;
  }>;
};

export type InventoryLotList = {
  selectedBranch: InventoryBranch;
  branches: InventoryBranch[];
  lots: InventoryLot[];
  summary: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
    inventoryValue: number;
  };
};

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type PurchaseOrderItem = {
  id: number;
  purchaseOrderId: number;
  ingredientId: number;
  ingredient: Ingredient;
  availableSnapshot: number;
  minimumLevelSnapshot: number;
  averageDailyUsage: number;
  incomingSnapshot: number;
  suggestedQuantity: number;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  lineTotal: number;
  note: string | null;
};

export type PurchaseOrderReceipt = {
  id: number;
  code: string;
  receivedAt: string | null;
  totalCost: number;
  note: string | null;
  items: Array<{
    id: number;
    ingredientId: number;
    ingredient: Ingredient;
    quantity: number;
    unitCost: number;
    lineTotal: number;
    batchCode: string | null;
    manufacturedAt: string | null;
    expiresAt: string | null;
    lotNote: string | null;
  }>;
};

export type PurchaseOrder = {
  id: number;
  code: string;
  branchId: number;
  branch: InventoryBranch;
  supplierId: number;
  supplier: Supplier;
  createdById: number;
  createdBy: { id: number; fullName: string | null; email: string };
  reviewedById: number | null;
  reviewedBy: { id: number; fullName: string | null; email: string } | null;
  status: PurchaseOrderStatus;
  expectedAt: string | null;
  note: string | null;
  reviewNote: string | null;
  totalCost: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  orderedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  items: PurchaseOrderItem[];
  receipts: PurchaseOrderReceipt[];
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderInput = {
  branchId: number;
  supplierId: number;
  expectedAt?: string;
  note?: string;
  items: Array<{
    ingredientId: number;
    quantity: number;
    unitCost: number;
    note?: string;
  }>;
};

export type PurchaseOrderSuggestion = {
  ingredient: Ingredient;
  availableQuantity: number;
  minimumLevel: number;
  usageQuantity: number;
  averageDailyUsage: number;
  incomingQuantity: number;
  targetQuantity: number;
  suggestedQuantity: number;
  lastUnitCost: number | null;
  lastSupplier: Supplier | null;
  lastReceivedAt: string | null;
};

export type PurchaseOrderSuggestions = {
  selectedBranch: InventoryBranch;
  branches: InventoryBranch[];
  usageWindowDays: number;
  targetCoverDays: number;
  rows: PurchaseOrderSuggestion[];
};

export type PurchaseOrderList = {
  selectedBranch: InventoryBranch;
  branches: InventoryBranch[];
  orders: PurchaseOrder[];
  summary: {
    total: number;
    pending: number;
    inTransit: number;
    overdue: number;
    completed: number;
    openValue: number;
  };
};

export type InventoryOverview = {
  selectedBranch: InventoryBranch;
  branches: InventoryBranch[];
  rows: InventoryRow[];
  lowStockCount: number;
  movements: InventoryMovement[];
};

export type RecipeIngredient = {
  id: number;
  ingredientId: number;
  quantity: number | string;
  ingredient: Ingredient;
};

export type RecipeVariant = {
  id: number;
  size: string;
  price: number | string;
  isActive: boolean;
  recipeIngredients: RecipeIngredient[];
};

export type RecipeProduct = {
  id: number;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  variants: RecipeVariant[];
};

export type RecipeTopping = {
  id: number;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  recipeIngredients: RecipeIngredient[];
};

export type RecipeOverview = {
  ingredients: Ingredient[];
  products: RecipeProduct[];
  toppings: RecipeTopping[];
};
