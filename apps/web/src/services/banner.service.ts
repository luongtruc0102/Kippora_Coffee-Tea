import type { AdminBanner, BannerInput, PublicBanner } from "@/types/banner";

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

export async function getPublicBanners(
  branchId?: number,
  signal?: AbortSignal,
): Promise<PublicBanner[]> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", String(branchId));
  const response = await fetch(`${getApiUrl()}/banners?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  return readResponse(response, "Không thể tải banner");
}

export async function getAdminBanners(
  accessToken: string,
  signal?: AbortSignal,
): Promise<AdminBanner[]> {
  const response = await fetch(`${getApiUrl()}/banners/admin/all`, {
    headers: authHeaders(accessToken),
    cache: "no-store",
    signal,
  });
  return readResponse(response, "Không thể tải danh sách banner");
}

export async function createBanner(
  accessToken: string,
  input: BannerInput,
): Promise<AdminBanner> {
  const response = await fetch(`${getApiUrl()}/banners`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse(response, "Không thể tạo banner");
}

export async function updateBanner(
  accessToken: string,
  id: number,
  input: Partial<BannerInput>,
): Promise<AdminBanner> {
  const response = await fetch(`${getApiUrl()}/banners/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return readResponse(response, "Không thể cập nhật banner");
}

export async function updateBannerStatus(
  accessToken: string,
  id: number,
  isActive: boolean,
): Promise<AdminBanner> {
  const response = await fetch(`${getApiUrl()}/banners/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ isActive }),
  });
  return readResponse(response, "Không thể đổi trạng thái banner");
}
