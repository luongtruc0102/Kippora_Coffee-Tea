import type {
  ManagedPayment,
  PaymentRecord,
  UpdatePaymentStatusInput,
} from "@/types/payment";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) {
    throw new Error("Thiếu NEXT_PUBLIC_API_URL");
  }

  return API_URL;
}

function getHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function readResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;

    throw new Error(message || fallbackMessage);
  }

  return data as T;
}

export async function getManagedPayments(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ManagedPayment[]> {
  const response = await fetch(`${getApiUrl()}/payments/management/all`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
    signal,
  });

  return readResponse<ManagedPayment[]>(
    response,
    "Không thể tải danh sách thanh toán",
  );
}

export async function updateManagedPaymentStatus(
  accessToken: string,
  paymentId: number,
  input: UpdatePaymentStatusInput,
): Promise<PaymentRecord> {
  const response = await fetch(
    `${getApiUrl()}/payments/management/${paymentId}/status`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );

  return readResponse<PaymentRecord>(
    response,
    "Không thể cập nhật trạng thái thanh toán",
  );
}
