import type {
  SupportConversation,
  SupportConversationList,
  SupportConversationStatus,
  SupportMetrics,
} from "@/types/support";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  return API_URL;
}

function headers(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function read<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || fallback);
  }
  return data as T;
}

export async function getMySupportConversation(
  accessToken: string,
  signal?: AbortSignal,
  route?: { branchId?: number; orderId?: number },
) {
  const query = new URLSearchParams();
  if (route?.branchId) query.set("branchId", String(route.branchId));
  if (route?.orderId) query.set("orderId", String(route.orderId));
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(`${getApiUrl()}/support/me${suffix}`, {
    headers: headers(accessToken),
    cache: "no-store",
    signal,
  });
  return read<SupportConversation | null>(
    response,
    "Không thể tải hội thoại hỗ trợ",
  );
}

export async function getMySupportUnreadCount(
  accessToken: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${getApiUrl()}/support/me/unread-count`, {
    headers: headers(accessToken),
    cache: "no-store",
    signal,
  });
  return read<{ unreadCount: number }>(
    response,
    "Không thể tải số tin nhắn chưa đọc",
  );
}

export async function sendMySupportMessage(
  accessToken: string,
  content: string,
  route?: { branchId?: number; orderId?: number },
) {
  const response = await fetch(`${getApiUrl()}/support/me/messages`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ content, ...route }),
  });
  return read<SupportConversation>(response, "Không thể gửi tin nhắn");
}

export async function getSupportConversations(
  accessToken: string,
  filters: {
    q?: string;
    status?: SupportConversationStatus;
    branchId?: number;
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (filters.q?.trim()) query.set("q", filters.q.trim());
  if (filters.status) query.set("status", filters.status);
  if (filters.branchId) query.set("branchId", String(filters.branchId));
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(
    `${getApiUrl()}/support/management/conversations${suffix}`,
    {
      headers: headers(accessToken),
      cache: "no-store",
      signal,
    },
  );
  return read<SupportConversationList>(response, "Không thể tải hộp thư CSKH");
}

export async function getSupportConversation(
  accessToken: string,
  conversationId: number,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${getApiUrl()}/support/management/conversations/${conversationId}`,
    {
      headers: headers(accessToken),
      cache: "no-store",
      signal,
    },
  );
  return read<SupportConversation>(response, "Không thể tải hội thoại");
}

export async function sendSupportReply(
  accessToken: string,
  conversationId: number,
  content: string,
) {
  const response = await fetch(
    `${getApiUrl()}/support/management/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: headers(accessToken),
      body: JSON.stringify({ content }),
    },
  );
  return read<SupportConversation>(response, "Không thể gửi phản hồi");
}

export async function updateSupportStatus(
  accessToken: string,
  conversationId: number,
  status: SupportConversationStatus,
) {
  const response = await fetch(
    `${getApiUrl()}/support/management/conversations/${conversationId}/status`,
    {
      method: "PATCH",
      headers: headers(accessToken),
      body: JSON.stringify({ status }),
    },
  );
  return read<SupportConversation>(response, "Không thể đổi trạng thái");
}

export async function getSupportMetrics(
  accessToken: string,
  filters: { days: 7 | 30 | 90; branchId?: number },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ days: String(filters.days) });
  if (filters.branchId) query.set("branchId", String(filters.branchId));
  const response = await fetch(
    `${getApiUrl()}/support/management/metrics?${query.toString()}`,
    {
      headers: headers(accessToken),
      cache: "no-store",
      signal,
    },
  );
  return read<SupportMetrics>(response, "Không thể tải hiệu quả CSKH");
}

export async function transferSupportConversation(
  accessToken: string,
  conversationId: number,
  branchId: number,
) {
  const response = await fetch(
    `${getApiUrl()}/support/management/conversations/${conversationId}/branch`,
    {
      method: "PATCH",
      headers: headers(accessToken),
      body: JSON.stringify({ branchId }),
    },
  );
  return read<SupportConversation>(response, "Không thể chuyển chi nhánh");
}
