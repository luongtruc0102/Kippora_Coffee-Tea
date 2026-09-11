import type {
  Ingredient,
  IngredientUnit,
  InventoryCount,
  InventoryCountInput,
  InventoryCountList,
  InventoryCountStatus,
  InventoryOverview,
  InventoryLotDetail,
  InventoryLotList,
  InventoryLotStatus,
  InventoryVarianceReason,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderList,
  PurchaseOrderStatus,
  PurchaseOrderSuggestions,
  RecipeOverview,
  StockReceipt,
  StockReceiptInput,
  StockReceiptList,
  StockReceiptStatus,
  Supplier,
  SupplierInput,
} from "@/types/inventory";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function apiUrl() {
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

export async function getInventoryOverview(
  accessToken: string,
  branchId?: number,
  signal?: AbortSignal,
) {
  const query = branchId ? `?branchId=${branchId}` : "";
  const response = await fetch(`${apiUrl()}/inventory${query}`, {
    headers: headers(accessToken),
    cache: "no-store",
    signal,
  });
  return read<InventoryOverview>(response, "Không thể tải tồn kho");
}

export async function getInventoryLots(
  accessToken: string,
  query: {
    branchId?: number;
    status?: InventoryLotStatus | "ALL";
    expiry?: "ALL" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";
    q?: string;
  } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (query.branchId) params.set("branchId", String(query.branchId));
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  if (query.expiry && query.expiry !== "ALL") params.set("expiry", query.expiry);
  if (query.q?.trim()) params.set("q", query.q.trim());
  const response = await fetch(`${apiUrl()}/inventory/lots?${params.toString()}`, {
    headers: headers(accessToken), cache: "no-store", signal,
  });
  return read<InventoryLotList>(response, "Không thể tải danh sách lô");
}

export async function getInventoryLot(accessToken: string, id: number) {
  const response = await fetch(`${apiUrl()}/inventory/lots/${id}`, {
    headers: headers(accessToken), cache: "no-store",
  });
  return read<InventoryLotDetail>(response, "Không thể tải chi tiết lô");
}

export async function disposeInventoryLot(
  accessToken: string,
  id: number,
  input: { quantity: number; reason: InventoryVarianceReason; note?: string },
) {
  const response = await fetch(`${apiUrl()}/inventory/lots/${id}/dispose`, {
    method: "POST", headers: headers(accessToken), body: JSON.stringify(input),
  });
  return read(response, "Không thể ghi nhận hủy lô");
}

export async function createIngredient(
  accessToken: string,
  input: { name: string; unit: IngredientUnit },
) {
  const response = await fetch(`${apiUrl()}/inventory/ingredients`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<Ingredient>(response, "Không thể thêm nguyên liệu");
}

export async function updateInventoryMinimumLevel(
  accessToken: string,
  input: {
    branchId: number;
    ingredientId: number;
    minimumLevel: number;
  },
) {
  const response = await fetch(`${apiUrl()}/inventory/stock`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read(response, "Không thể cập nhật mức cảnh báo");
}

export async function getInventoryRecipes(
  accessToken: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`${apiUrl()}/inventory/recipes`, {
    headers: headers(accessToken),
    cache: "no-store",
    signal,
  });
  return read<RecipeOverview>(response, "Không thể tải công thức");
}

export async function updateInventoryRecipe(
  accessToken: string,
  target: { kind: "variant" | "topping"; id: number },
  items: Array<{ ingredientId: number; quantity: number }>,
) {
  const path = target.kind === "variant" ? "variants" : "toppings";
  const response = await fetch(
    `${apiUrl()}/inventory/recipes/${path}/${target.id}`,
    {
      method: "PUT",
      headers: headers(accessToken),
      body: JSON.stringify({ items }),
    },
  );
  return read(response, "Không thể lưu công thức");
}

export async function getSuppliers(
  accessToken: string,
  query: { q?: string; status?: "ALL" | "ACTIVE" | "INACTIVE" } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.status && query.status !== "ALL") {
    params.set("status", query.status);
  }
  const response = await fetch(
    `${apiUrl()}/inventory/suppliers?${params.toString()}`,
    { headers: headers(accessToken), cache: "no-store", signal },
  );
  return read<Supplier[]>(response, "Không thể tải nhà cung cấp");
}

export async function createSupplier(
  accessToken: string,
  input: SupplierInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/suppliers`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<Supplier>(response, "Không thể thêm nhà cung cấp");
}

export async function updateSupplier(
  accessToken: string,
  id: number,
  input: SupplierInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/suppliers/${id}`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<Supplier>(response, "Không thể cập nhật nhà cung cấp");
}

export async function updateSupplierStatus(
  accessToken: string,
  id: number,
  isActive: boolean,
) {
  const response = await fetch(`${apiUrl()}/inventory/suppliers/${id}/status`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify({ isActive }),
  });
  return read<Supplier>(response, "Không thể đổi trạng thái nhà cung cấp");
}

export async function getStockReceipts(
  accessToken: string,
  query: {
    branchId?: number;
    status?: StockReceiptStatus | "ALL";
    from?: string;
    to?: string;
    q?: string;
  } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (query.branchId) params.set("branchId", String(query.branchId));
  if (query.status && query.status !== "ALL")
    params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.q?.trim()) params.set("q", query.q.trim());
  const response = await fetch(
    `${apiUrl()}/inventory/receipts?${params.toString()}`,
    { headers: headers(accessToken), cache: "no-store", signal },
  );
  return read<StockReceiptList>(response, "Không thể tải phiếu nhập kho");
}

export async function createStockReceipt(
  accessToken: string,
  input: StockReceiptInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/receipts`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<StockReceipt>(response, "Không thể tạo phiếu nhập");
}

export async function updateStockReceipt(
  accessToken: string,
  id: number,
  input: StockReceiptInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/receipts/${id}`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<StockReceipt>(response, "Không thể cập nhật phiếu nhập");
}

export async function completeStockReceipt(accessToken: string, id: number) {
  const response = await fetch(
    `${apiUrl()}/inventory/receipts/${id}/complete`,
    { method: "POST", headers: headers(accessToken) },
  );
  return read<StockReceipt>(response, "Không thể xác nhận nhập kho");
}

export async function cancelStockReceipt(accessToken: string, id: number) {
  const response = await fetch(`${apiUrl()}/inventory/receipts/${id}/cancel`, {
    method: "POST",
    headers: headers(accessToken),
  });
  return read<StockReceipt>(response, "Không thể hủy phiếu nhập");
}

export async function getInventoryCounts(
  accessToken: string,
  query: {
    branchId?: number;
    status?: InventoryCountStatus | "ALL";
    from?: string;
    to?: string;
    q?: string;
  } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (query.branchId) params.set("branchId", String(query.branchId));
  if (query.status && query.status !== "ALL")
    params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.q?.trim()) params.set("q", query.q.trim());
  const response = await fetch(
    `${apiUrl()}/inventory/counts?${params.toString()}`,
    { headers: headers(accessToken), cache: "no-store", signal },
  );
  return read<InventoryCountList>(response, "Không thể tải phiếu kiểm kê");
}

export async function createInventoryCount(
  accessToken: string,
  input: InventoryCountInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/counts`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<InventoryCount>(response, "Không thể tạo phiếu kiểm kê");
}

export async function updateInventoryCount(
  accessToken: string,
  id: number,
  input: InventoryCountInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/counts/${id}`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<InventoryCount>(response, "Không thể cập nhật phiếu kiểm kê");
}

async function runInventoryCountAction(
  accessToken: string,
  id: number,
  action: "submit" | "approve" | "reject" | "cancel",
  reviewNote?: string,
) {
  const response = await fetch(`${apiUrl()}/inventory/counts/${id}/${action}`, {
    method: "POST",
    headers: headers(accessToken),
    body:
      action === "approve" || action === "reject"
        ? JSON.stringify({ reviewNote })
        : undefined,
  });
  return read<InventoryCount>(response, "Không thể xử lý phiếu kiểm kê");
}

export const submitInventoryCount = (accessToken: string, id: number) =>
  runInventoryCountAction(accessToken, id, "submit");

export const approveInventoryCount = (
  accessToken: string,
  id: number,
  reviewNote?: string,
) => runInventoryCountAction(accessToken, id, "approve", reviewNote);

export const rejectInventoryCount = (
  accessToken: string,
  id: number,
  reviewNote: string,
) => runInventoryCountAction(accessToken, id, "reject", reviewNote);

export const cancelInventoryCount = (accessToken: string, id: number) =>
  runInventoryCountAction(accessToken, id, "cancel");

export async function getPurchaseOrderSuggestions(
  accessToken: string,
  branchId?: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", String(branchId));
  const response = await fetch(
    `${apiUrl()}/inventory/purchase-orders/suggestions?${params.toString()}`,
    { headers: headers(accessToken), cache: "no-store", signal },
  );
  return read<PurchaseOrderSuggestions>(
    response,
    "Không thể tính đề xuất nhập hàng",
  );
}

export async function getPurchaseOrders(
  accessToken: string,
  query: {
    branchId?: number;
    supplierId?: number;
    status?: PurchaseOrderStatus | "ALL";
    from?: string;
    to?: string;
    q?: string;
  } = {},
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (query.branchId) params.set("branchId", String(query.branchId));
  if (query.supplierId) params.set("supplierId", String(query.supplierId));
  if (query.status && query.status !== "ALL")
    params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.q?.trim()) params.set("q", query.q.trim());
  const response = await fetch(
    `${apiUrl()}/inventory/purchase-orders?${params.toString()}`,
    { headers: headers(accessToken), cache: "no-store", signal },
  );
  return read<PurchaseOrderList>(response, "Không thể tải đơn đặt hàng");
}

export async function createPurchaseOrder(
  accessToken: string,
  input: PurchaseOrderInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/purchase-orders`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<PurchaseOrder>(response, "Không thể lập đề xuất nhập hàng");
}

export async function updatePurchaseOrder(
  accessToken: string,
  id: number,
  input: PurchaseOrderInput,
) {
  const response = await fetch(`${apiUrl()}/inventory/purchase-orders/${id}`, {
    method: "PUT",
    headers: headers(accessToken),
    body: JSON.stringify(input),
  });
  return read<PurchaseOrder>(response, "Không thể cập nhật đề xuất");
}

async function runPurchaseOrderAction(
  accessToken: string,
  id: number,
  action: "submit" | "approve" | "reject" | "mark-ordered" | "cancel",
  note?: string,
) {
  const response = await fetch(
    `${apiUrl()}/inventory/purchase-orders/${id}/${action}`,
    {
      method: "POST",
      headers: headers(accessToken),
      body:
        action === "approve" || action === "reject"
          ? JSON.stringify({ note })
          : undefined,
    },
  );
  return read<PurchaseOrder>(response, "Không thể xử lý đơn đặt hàng");
}

export const submitPurchaseOrder = (accessToken: string, id: number) =>
  runPurchaseOrderAction(accessToken, id, "submit");
export const approvePurchaseOrder = (
  accessToken: string,
  id: number,
  note?: string,
) => runPurchaseOrderAction(accessToken, id, "approve", note);
export const rejectPurchaseOrder = (
  accessToken: string,
  id: number,
  note: string,
) => runPurchaseOrderAction(accessToken, id, "reject", note);
export const markPurchaseOrderOrdered = (accessToken: string, id: number) =>
  runPurchaseOrderAction(accessToken, id, "mark-ordered");
export const cancelPurchaseOrder = (accessToken: string, id: number) =>
  runPurchaseOrderAction(accessToken, id, "cancel");

export async function receivePurchaseOrder(
  accessToken: string,
  id: number,
  input: {
    receivedAt?: string;
    note?: string;
    items: Array<{
      purchaseOrderItemId: number;
      quantity: number;
      batchCode?: string;
      manufacturedAt?: string;
      expiresAt?: string;
      lotNote?: string;
    }>;
  },
) {
  const response = await fetch(
    `${apiUrl()}/inventory/purchase-orders/${id}/receive`,
    {
      method: "POST",
      headers: headers(accessToken),
      body: JSON.stringify(input),
    },
  );
  return read<PurchaseOrder>(response, "Không thể xác nhận nhận hàng");
}
