import type {
  FulfillmentMethod,
  Order,
  OrderStatus,
  PaymentMethod,
  RefundMethod,
  ReorderOrderResult,
} from "@/types/order";

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

// ADMIN/STAFF lấy toàn bộ đơn hàng
export async function getAdminOrders(
  accessToken: string,
  query = "",
  signal?: AbortSignal,
): Promise<Order[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());

  const url = `${getApiUrl()}/orders/management/all?${params.toString()}`;
  const response = await fetch(url, {
    headers: getHeaders(accessToken),

    cache: "no-store",
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể tải đơn hàng");
  }

  return data;
}

// ADMIN/STAFF xem chi tiết đơn hàng
export async function getAdminOrderById(
  accessToken: string,
  orderId: number,
): Promise<Order> {
  const response = await fetch(`${getApiUrl()}/orders/management/${orderId}`, {
    headers: getHeaders(accessToken),

    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể tải chi tiết đơn hàng");
  }

  return data;
}

// ADMIN/STAFF cập nhật trạng thái đơn
export async function updateOrderStatus(
  accessToken: string,
  orderId: number,
  status: OrderStatus,
): Promise<Order> {
  const response = await fetch(
    `${getApiUrl()}/orders/management/${orderId}/status`,
    {
      method: "PATCH",

      headers: getHeaders(accessToken),

      body: JSON.stringify({
        status,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;

    throw new Error(message || "Không thể cập nhật trạng thái đơn hàng");
  }

  return data;
}

export type CancelManagedOrderInput = {
  reason: string;
  refundMethod?: RefundMethod;
};

// Hủy đơn quản lý; backend tự hoàn toàn bộ nếu giao dịch đã thanh toán.
export async function cancelManagedOrder(
  accessToken: string,
  orderId: number,
  input: CancelManagedOrderInput,
): Promise<Order> {
  const response = await fetch(
    `${getApiUrl()}/orders/management/${orderId}/cancel`,
    {
      method: "PATCH",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || "Không thể hủy đơn hàng");
  }
  return data as Order;
}

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type DeliveryQuote = {
  latitude: number;
  longitude: number;
  normalizedAddress: string;
  distanceKm: number;
  routeCoordinates: RouteCoordinate[];
  deliveryBaseFee: number;
  deliveryDiscountAmount: number;
  deliveryFee: number;
};

export type AddressSuggestion = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

export async function getDeliveryQuote(
  accessToken: string,
  deliveryAddress: string,
  subtotal: number,
  fulfillmentMethod: FulfillmentMethod,
  branchId?: number,
): Promise<DeliveryQuote> {
  const response = await fetch(`${getApiUrl()}/orders/delivery-quote`, {
    method: "POST",
    headers: getHeaders(accessToken),
    body: JSON.stringify({
      deliveryAddress,
      subtotal,
      fulfillmentMethod,
      branchId,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    throw new Error(message || "Không thể tính phí giao hàng");
  }

  return data;
}

export async function getAddressSuggestions(
  accessToken: string,
  query: string,
  branchId?: number,
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ query: query.trim() });
  if (branchId) params.set("branchId", String(branchId));
  const response = await fetch(
    `${getApiUrl()}/orders/address-suggestions?${params.toString()}`,
    {
      headers: getHeaders(accessToken),
      cache: "no-store",
    },
  );
  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    throw new Error(message || "Không thể tải gợi ý địa chỉ");
  }

  return data;
}

export async function getDeliveryLocationQuote(
  accessToken: string,
  input: {
    latitude: number;
    longitude: number;
    subtotal: number;
    fulfillmentMethod: FulfillmentMethod;
    deliveryAddress?: string;
    branchId?: number;
  },
): Promise<DeliveryQuote> {
  const response = await fetch(
    `${getApiUrl()}/orders/delivery-location-quote`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    throw new Error(message || "Không thể tính khoảng cách tại vị trí này");
  }

  return data;
}

export type CheckoutInput = {
  branchId?: number;
  cartItemIds?: number[];
  reorderOrderId?: number;
  reorderOrderItemIds?: number[];

  receiverName: string;
  receiverPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress: string;
  deliveryLatitude: string;
  deliveryLongitude: string;
  paymentMethod: PaymentMethod;

  note?: string;
  voucherCodes?: string[];

  loyaltyPointsToUse?: number;
};

export async function checkoutOrder(
  accessToken: string,
  input: CheckoutInput,
): Promise<Order> {
  const response = await fetch(`${getApiUrl()}/orders/checkout`, {
    method: "POST",

    headers: getHeaders(accessToken),

    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;

    throw new Error(message || "Không thể tạo đơn hàng");
  }

  return data;
}

export type CreatePosOrderInput = {
  items: Array<{
    productId: number;
    variantId: number;
    quantity: number;
    toppingIds?: number[];
  }>;
  customerName?: string;
  customerPhone?: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  loyaltyPointsToUse?: number;
  note?: string;
};

export type PosCustomerLookupResult = {
  found: boolean;
  source: "USER" | "POS_CUSTOMER" | null;
  fullName: string | null;
  phone: string;
  loyaltyPoints: number;
};

// Tìm tên và điểm khách tại quầy theo số điện thoại.
export async function lookupPosCustomer(
  accessToken: string,
  phone: string,
  signal?: AbortSignal,
): Promise<PosCustomerLookupResult> {
  const response = await fetch(
    `${getApiUrl()}/orders/pos/customers/lookup?phone=${encodeURIComponent(phone.trim())}`,
    {
      headers: getHeaders(accessToken),
      cache: "no-store",
      signal,
    },
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || "Không thể tìm thông tin khách hàng");
  }

  return data;
}

// Trưởng chi nhánh tạo hóa đơn trực tiếp tại quầy, không dùng Cart của user.
export async function createPosOrder(
  accessToken: string,
  input: CreatePosOrderInput,
): Promise<Order> {
  const response = await fetch(`${getApiUrl()}/orders/pos`, {
    method: "POST",
    headers: getHeaders(accessToken),
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message;
    throw new Error(message || "Không thể tạo hóa đơn POS");
  }

  return data;
}

export async function getMyOrders(accessToken: string): Promise<Order[]> {
  const response = await fetch(`${getApiUrl()}/orders`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể tải lịch sử đơn hàng");
  }

  return data;
}
export async function getMyOrderById(
  accessToken: string,
  orderId: number,
): Promise<Order> {
  const response = await fetch(`${getApiUrl()}/orders/${orderId}`, {
    headers: getHeaders(accessToken),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không thể tải chi tiết đơn hàng");
  }

  return data;
}

export async function cancelMyOrder(
  accessToken: string,
  orderId: number,
  reason: string,
): Promise<Order> {
  const response = await fetch(`${getApiUrl()}/orders/${orderId}/cancel`, {
    method: "PATCH",
    headers: getHeaders(accessToken),
    body: JSON.stringify({
      reason,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;

    throw new Error(message || "Không thể hủy đơn hàng");
  }

  return data;
}

// Chỉ gửi mã đơn; backend tự lấy cấu hình cũ và kiểm tra giá/khả dụng hiện tại.
export async function reorderMyOrder(
  accessToken: string,
  orderId: number,
): Promise<ReorderOrderResult> {
  const response = await fetch(`${getApiUrl()}/orders/${orderId}/reorder`, {
    method: "POST",
    headers: getHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;

    throw new Error(message || "Không thể chuẩn bị đơn hàng mua lại");
  }

  return data;
}
