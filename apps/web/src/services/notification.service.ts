export type UserNotification = {
  id: number;
  userId: number;
  orderId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  category?: OperationalAlertCategory;
  severity?: OperationalAlertSeverity;
  actionUrl?: string;
  requiresAction?: boolean;
};

export type NotificationList = {
  items: UserNotification[];
  unreadCount: number;
};

export type OperationalAlertCategory =
  | "INVENTORY"
  | "PROCUREMENT"
  | "FINANCE"
  | "STAFFING"
  | "PAYMENT"
  | "ACCOUNTING"
  | "SYSTEM";

export type OperationalAlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export type OperationalAlertsResponse = {
  items: Array<
    UserNotification & {
      category: OperationalAlertCategory;
      severity: OperationalAlertSeverity;
      actionUrl: string;
      requiresAction: boolean;
    }
  >;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    total: number;
    unread: number;
    critical: number;
    requiresAction: number;
  };
};

export type OperationalAlertQuery = {
  q?: string;
  category?: OperationalAlertCategory | "ALL";
  severity?: OperationalAlertSeverity | "ALL";
  readStatus?: "ALL" | "UNREAD" | "READ";
  page?: number;
  limit?: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) {
    throw new Error("Thiếu NEXT_PUBLIC_API_URL trong .env.local");
  }
  return API_URL;
}

function getHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(response: Response, fallback: string) {
  const data = await response.json();
  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    throw new Error(message || fallback);
  }
  return data as T;
}

export async function getMyNotifications(accessToken: string) {
  const response = await fetch(`${getApiUrl()}/notifications`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
  });
  return parseResponse<NotificationList>(response, "Không thể tải thông báo");
}

export async function getOperationalAlerts(
  accessToken: string,
  query: OperationalAlertQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.severity) params.set("severity", query.severity);
  if (query.readStatus) params.set("readStatus", query.readStatus);
  params.set("page", String(query.page || 1));
  params.set("limit", String(query.limit || 20));
  const response = await fetch(
    `${getApiUrl()}/notifications/operational?${params.toString()}`,
    {
      headers: getHeaders(accessToken),
      cache: "no-store",
      signal,
    },
  );
  return parseResponse<OperationalAlertsResponse>(
    response,
    "Không thể tải cảnh báo vận hành",
  );
}

export async function markNotificationRead(
  accessToken: string,
  notificationId: number,
) {
  const response = await fetch(
    `${getApiUrl()}/notifications/${notificationId}/read`,
    { method: "PATCH", headers: getHeaders(accessToken) },
  );
  return parseResponse<UserNotification>(
    response,
    "Không thể đánh dấu thông báo",
  );
}

export async function markAllNotificationsRead(accessToken: string) {
  const response = await fetch(`${getApiUrl()}/notifications/read-all`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
  });
  return parseResponse<{ updatedCount: number; readAt: string }>(
    response,
    "Không thể đánh dấu tất cả thông báo",
  );
}

export async function markAllOperationalAlertsRead(accessToken: string) {
  const response = await fetch(
    `${getApiUrl()}/notifications/operational/read-all`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
    },
  );
  return parseResponse<{ updatedCount: number; readAt: string }>(
    response,
    "Không thể đánh dấu tất cả cảnh báo",
  );
}
