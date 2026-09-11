export type DashboardOverview = {
  period: DashboardPeriod;
  periodRevenue: number;
  totalRevenue: number;
  periodOrders: number;
  newCustomers: number;
  activeProducts: number;
  activeBranches: number;
  totalBranches: number;
  averageOrderValue: number;
  cancellationRate: number;
  financials: {
    approvedOperatingExpenses: number;
    inventoryPurchases: number;
    estimatedLaborCost: number;
    totalEstimatedCost: number;
    estimatedProfit: number;
    estimatedProfitMargin: number;
  };
  range: {
    startDate: string;
    endDate: string;
  };
  comparison: {
    previousStartDate: string;
    previousEndDate: string;
    revenueChangePercent: number | null;
    orderChangePercent: number | null;
    newCustomerChangePercent: number | null;
    averageOrderValueChangePercent: number | null;
    cancellationRateChangePoints: number;
  };
};

export type RevenueStatistic = {
  date?: string;
  month?: string;
  revenue: number;
  completedOrders: number;
  averageOrderValue: number;
};

export type OrderStatusStatistic = {
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PREPARING"
    | "READY_FOR_PICKUP"
    | "DELIVERING"
    | "COMPLETED"
    | "CANCELLED";
  count: number;
};

export type TopProduct = {
  productId: number;
  productName: string;
  imageUrl: string | null;
  quantitySold: number;
  revenue: number;
};

export type RecentOrder = {
  id: number;
  receiverName: string;
  receiverPhone: string;
  totalPrice: number;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PREPARING"
    | "READY_FOR_PICKUP"
    | "DELIVERING"
    | "COMPLETED"
    | "CANCELLED";
  createdAt: string;
  customer: {
    id: number;
    email: string;
    fullName: string;
  };
  payment: {
    method: "COD" | "BANK_TRANSFER";
    status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  } | null;
};

export type TopTopping = {
  toppingId: number;
  toppingName: string;
  imageUrl: string | null;
  selectedCount: number;
};

export type PaymentStatisticItem = {
  count: number;
  amount: number;
};

export type PaymentStatusStatistic = PaymentStatisticItem & {
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
};

export type PaymentMethodStatistic = PaymentStatisticItem & {
  method: "COD" | "BANK_TRANSFER";
};

export type PaymentStatistics = {
  byStatus: PaymentStatusStatistic[];
  byMethod: PaymentMethodStatistic[];
};

export type VoucherStatisticItem = {
  id: number;
  code: string;
  description: string | null;
  usedCount: number;
  usageLimit: number | null;
  remainingUsage: number | null;
  endAt: string;
  isActive: boolean;
};

export type VoucherStatistics = {
  totalDiscount: number;
  activeVouchers: number;
  topVouchers: VoucherStatisticItem[];
};

export type DashboardPeriod = "7D" | "30D" | "1Y" | "CUSTOM";

export type DashboardDateRange = {
  from: string;
  to: string;
};

export type NewCustomerStatistic = {
  date: string;
  newCustomers: number;
};

export type TopCustomer = {
  userId: number;

  customer: {
    id: number;
    email: string;
    fullName: string;
  } | null;

  totalOrders: number;
  totalSpent: number;
};

export type CustomerRetentionStatistic = {
  date?: string;
  month?: string;
  newCustomers: number;
  returningCustomers: number;
};

export type CustomerRetentionSummary = {
  period: DashboardPeriod;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  newCustomerRate: number;
  returningCustomerRate: number;
  timeline: CustomerRetentionStatistic[];
};

export type BranchRevenueStatistic = {
  branchId: number;
  branchCode: string;
  branchName: string;
  isActive: boolean;
  revenue: number;
  completedOrders: number;
};

export type DashboardOperations = {
  generatedAt: string;
  today: string;
  payrollMonth: string;
  summary: {
    lowStockItems: number;
    pendingLeaveRequests: number;
    attendanceActions: number;
    payrollActions: number;
    activeOrders: number;
    todayShifts: number;
    branchesWithoutShifts: number;
    draftStockReceipts: number;
    pendingExpenses: number;
    pendingCashSessions: number;
    overdueCashSessions: number;
  };
  lowStockItems: Array<{
    stockId: number;
    ingredientName: string;
    unit: "GRAM" | "MILLILITER" | "PIECE";
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    minimumLevel: number;
    branch: DashboardOperationBranch;
  }>;
  pendingLeaveRequests: Array<{
    id: number;
    type: "PLANNED" | "EMERGENCY";
    scope: "FULL_SHIFT" | "LATE_ARRIVAL" | "EARLY_LEAVE";
    reason: string;
    createdAt: string;
    requestedStartAt: string | null;
    requestedEndAt: string | null;
    employeeName: string;
    branch: DashboardOperationBranch;
    shift: { startAt: string; endAt: string };
  }>;
  attendanceActions: Array<{
    branch: DashboardOperationBranch;
    status: "NOT_SUBMITTED" | "DRAFT" | "PENDING" | "RETURNED";
    submittedAt: string | null;
    reviewNote: string | null;
  }>;
  payrollActions: Array<{
    branch: DashboardOperationBranch;
    status: "NOT_CREATED" | "DRAFT" | "FINALIZED";
  }>;
  branchesWithoutShifts: DashboardOperationBranch[];
  activeOrdersByStatus: Array<{
    status:
      "PENDING" | "CONFIRMED" | "PREPARING" | "READY_FOR_PICKUP" | "DELIVERING";
    count: number;
  }>;
  cashSessionActions: Array<{
    id: number;
    code: string;
    businessDate: string;
    status: "OPEN" | "PENDING_REVIEW";
    difference: number | null;
    branch: DashboardOperationBranch;
  }>;
};

export type DashboardOperationBranch = {
  id: number;
  code: string;
  name: string;
};

export type BranchHealth = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  isAcceptingOrders: boolean;
  pauseReason: string | null;
  managerName: string | null;
  activeStaff: number;
  staffOnDuty: number;
  todayShifts: number;
  lowStockItems: number;
  activeOrders: number;
  periodOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  averageOrderValue: number;
  cancellationRate: number;
  health: "HEALTHY" | "ATTENTION" | "PAUSED";
};
