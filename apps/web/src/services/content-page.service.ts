import type {
  AdminContentPage,
  ContentPage,
  ContentPageCategory,
  ContentPageInput,
  ContentPageLink,
} from "@/types/content-page";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  return API_URL;
}

function authHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function readResponse<T>(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || fallback);
  }
  return data as T;
}

export async function getContentNavigation(
  signal?: AbortSignal,
): Promise<ContentPageLink[]> {
  const response = await fetch(`${getApiUrl()}/content-pages/navigation`, {
    cache: "no-store",
    signal,
  });
  return readResponse(response, "Không thể tải điều hướng nội dung");
}

export async function getPublicContentPage(
  slug: string,
  signal?: AbortSignal,
): Promise<ContentPage> {
  const response = await fetch(
    `${getApiUrl()}/content-pages/${encodeURIComponent(slug)}`,
    { cache: "no-store", signal },
  );
  return readResponse(response, "Không thể tải trang nội dung");
}

export async function getAdminContentPages(
  accessToken: string,
  filters: {
    q?: string;
    category?: ContentPageCategory;
    status?: "ALL" | "PUBLISHED" | "DRAFT";
  } = {},
  signal?: AbortSignal,
): Promise<AdminContentPage[]> {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  const response = await fetch(
    `${getApiUrl()}/content-pages/admin/all?${params.toString()}`,
    { headers: authHeaders(accessToken), cache: "no-store", signal },
  );
  return readResponse(response, "Không thể tải danh sách trang nội dung");
}

export async function createContentPage(
  accessToken: string,
  input: ContentPageInput,
): Promise<AdminContentPage> {
  const response = await fetch(`${getApiUrl()}/content-pages`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse(response, "Không thể tạo trang nội dung");
}

export async function updateContentPage(
  accessToken: string,
  id: number,
  input: Partial<ContentPageInput>,
): Promise<AdminContentPage> {
  const response = await fetch(`${getApiUrl()}/content-pages/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse(response, "Không thể cập nhật trang nội dung");
}

export async function updateContentPageStatus(
  accessToken: string,
  id: number,
  isPublished: boolean,
): Promise<AdminContentPage> {
  const response = await fetch(`${getApiUrl()}/content-pages/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ isPublished }),
  });
  return readResponse(response, "Không thể thay đổi trạng thái trang");
}
