export type AuditModule =
  | "STAFF_SCHEDULE"
  | "ATTENDANCE"
  | "LEAVE"
  | "PAYROLL"
  | "INVENTORY"
  | "EXPENSE"
  | "CASH_RECONCILIATION"
  | "ORDER"
  | "PAYMENT";

export type AuditLogItem = {
  id: number;
  actorId: number | null;
  actor: {
    id: number;
    email: string;
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
  branchId: number | null;
  branch: { id: number; code: string; name: string } | null;
  module: AuditModule;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  createdAt: string;
};

export type AuditLogsResponse = {
  items: AuditLogItem[];
  summary: {
    total: number;
    byModule: Partial<Record<AuditModule, number>>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  branches: Array<{ id: number; code: string; name: string }>;
  scopedBranchId: number | null;
};

export type AuditLogFilters = {
  branchId?: number;
  module?: AuditModule;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
};
