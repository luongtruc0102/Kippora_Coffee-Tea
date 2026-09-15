import type {
  PricingReport,
  PricingSettings,
  ProductPriceHistoryItem,
} from "@/types/pricing";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  return API_URL;
}

async function readResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || fallback);
  return data as T;
}

export async function getPricingRecommendations(
  accessToken: string,
  branchId?: number,
  signal?: AbortSignal,
): Promise<PricingReport> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", String(branchId));
  const suffix = params.size ? `?${params.toString()}` : "";
  const response = await fetch(
    `${getApiUrl()}/pricing/recommendations${suffix}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    },
  );
  return readResponse<PricingReport>(response, "Không thể tải đề xuất giá bán");
}

export async function updatePricingSettings(
  accessToken: string,
  settings: PricingSettings,
): Promise<PricingSettings> {
  const response = await fetch(`${getApiUrl()}/pricing/settings`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });
  return readResponse<PricingSettings>(
    response,
    "Không thể lưu chính sách định giá",
  );
}

export async function applyProductPrice(
  accessToken: string,
  variantId: number,
  payload: { newPrice: number; branchId?: number; reason: string },
): Promise<{ historyId: number; newMarginPercent: number }> {
  const response = await fetch(
    `${getApiUrl()}/pricing/variants/${variantId}/apply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return readResponse(response, "Không thể áp dụng giá bán mới");
}

export async function getProductPriceHistory(
  accessToken: string,
  limit = 30,
  signal?: AbortSignal,
): Promise<ProductPriceHistoryItem[]> {
  const response = await fetch(
    `${getApiUrl()}/pricing/history?limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal,
    },
  );
  return readResponse(response, "Không thể tải lịch sử thay đổi giá");
}
