import type { ProfitabilityReport } from "@/types/profitability";

export type MonthCloseStatus = "OPEN" | "CLOSED";

export type MonthCloseReadinessItem = {
  code: string;
  label: string;
  count: number;
  href: string | null;
};

export type MonthCloseSnapshot = {
  schemaVersion: number;
  month: string;
  version: number;
  closedAt: string;
  branch: { id: number; code: string; name: string };
  report: ProfitabilityReport;
  warnings: MonthCloseReadinessItem[];
};

export type MonthClosePeriod = {
  id: number;
  status: MonthCloseStatus;
  version: number;
  periodStart: string;
  periodEnd: string;
  snapshot: MonthCloseSnapshot | null;
  closedAt: string | null;
  closedByName: string;
  closeNote: string | null;
  reopenedAt: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
  events: Array<{
    id: number;
    type: "CLOSED" | "REOPENED";
    version: number;
    reason: string | null;
    createdAt: string;
    actorName: string;
  }>;
};

export type MonthCloseOverview = {
  month: string;
  branch: { id: number; code: string; name: string };
  periodStart: string;
  periodEnd: string;
  periodHasEnded: boolean;
  status: MonthCloseStatus;
  canClose: boolean;
  permissions: { canClose: boolean; canReopen: boolean };
  blockers: MonthCloseReadinessItem[];
  warnings: MonthCloseReadinessItem[];
  liveReport: ProfitabilityReport;
  period: MonthClosePeriod | null;
};
