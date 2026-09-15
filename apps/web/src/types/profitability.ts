export type ProfitabilityFinancials = {
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  approvedExpenses: number;
  payroll: number;
  inventoryLoss: number;
  netProfit: number;
  grossMarginPercent: number;
  netMarginPercent: number;
};

export type ProfitabilityBranch = ProfitabilityFinancials & {
  branchId: number;
  branchCode: string;
  branchName: string;
  paidOrders: number;
  refundCount: number;
};

export type ProfitabilityOrder = {
  orderId: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  channel: "ONLINE" | "POS";
  orderStatus: string;
  paymentStatus: string;
  inventoryState: string;
  paidAt: string;
  grossRevenue: number;
  refundedAmount: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  unpricedAllocations: number;
  costSource: "LOT" | "ESTIMATED" | "MISSING";
};

export type ProfitabilityTimelineItem = ProfitabilityFinancials & {
  date: string;
};

export type ProfitabilityReport = {
  filters: { from: string; to: string; branchId: number | null };
  generatedAt: string;
  accountingBasis: {
    revenue: string;
    refunds: string;
    cogs: string;
    expenses: string;
    payroll: string;
  };
  summary: ProfitabilityFinancials & {
    paidOrders: number;
    refundCount: number;
  };
  dataQuality: {
    zeroCostAllocations: number;
    paidOrdersWithoutConsumedInventory: number;
    pendingPayrollPeriods: number;
    estimatedCostOrders: number;
  };
  branches: ProfitabilityBranch[];
  timeline: ProfitabilityTimelineItem[];
  orders: ProfitabilityOrder[];
};
