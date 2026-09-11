"use client";

import {
  AlertTriangle,
  Clock3,
  Eye,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderSuggestions,
  getSuppliers,
  markPurchaseOrderOrdered,
  receivePurchaseOrder,
  rejectPurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from "@/services/inventory.service";
import type {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderList,
  PurchaseOrderStatus,
  PurchaseOrderSuggestions,
  Supplier,
} from "@/types/inventory";
import PurchaseOrderDetailModal, {
  type PurchaseOrderAction,
  purchaseOrderStatusLabels,
} from "./purchase-order-detail-modal";
import PurchaseOrderFormModal from "./purchase-order-form-modal";
import PurchaseOrderReceiveModal from "./purchase-order-receive-modal";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

function dateKey(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  return `${dateKey().slice(0, 7)}-01`;
}

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}

function badge(status: PurchaseOrderStatus) {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  if (status === "REJECTED" || status === "CANCELLED")
    return "bg-red-50 text-red-600";
  if (status === "ORDERED" || status === "PARTIALLY_RECEIVED")
    return "bg-violet-50 text-violet-700";
  return "bg-blue-50 text-blue-700";
}

const actionCopy: Record<
  Exclude<PurchaseOrderAction, "receive">,
  { title: string; description: string; button: string }
> = {
  submit: {
    title: "Gửi đề xuất cho Admin duyệt?",
    description:
      "Sau khi gửi, nội dung đơn sẽ được khóa cho đến khi Admin xử lý.",
    button: "Gửi duyệt",
  },
  approve: {
    title: "Duyệt đề xuất nhập hàng?",
    description:
      "Đơn được duyệt vẫn chưa cộng kho; Admin cần xác nhận đã đặt với nhà cung cấp.",
    button: "Duyệt đề xuất",
  },
  reject: {
    title: "Yêu cầu chỉnh lại đề xuất?",
    description: "Vui lòng ghi rõ lý do để người lập chỉnh sửa và gửi lại.",
    button: "Từ chối",
  },
  "mark-ordered": {
    title: "Xác nhận đã đặt với nhà cung cấp?",
    description:
      "Sau bước này chi nhánh có thể ghi nhận từng lần giao hàng thực tế.",
    button: "Đã đặt hàng",
  },
  cancel: {
    title: "Hủy đơn nhập hàng?",
    description: "Đơn sẽ chỉ còn trong lịch sử và không cộng vào kho.",
    button: "Hủy đơn",
  },
};

export default function PurchaseOrdersPage({ mode }: Props) {
  const { showToast } = useAppToast();
  const [data, setData] = useState<PurchaseOrderList | null>(null);
  const [suggestions, setSuggestions] =
    useState<PurchaseOrderSuggestions | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branchId, setBranchId] = useState<number>();
  const [status, setStatus] = useState<PurchaseOrderStatus | "ALL">("ALL");
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(dateKey);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [action, setAction] = useState<Exclude<
    PurchaseOrderAction,
    "receive"
  > | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const token = sessionStorage.getItem("accessToken");
      if (!token) return;
      try {
        setLoading(true);
        setError("");
        const [orderData, suggestionData, supplierData] = await Promise.all([
          getPurchaseOrders(
            token,
            { branchId, status, from, to, q: keyword },
            signal,
          ),
          getPurchaseOrderSuggestions(token, branchId, signal),
          getSuppliers(token, { status: "ACTIVE" }, signal),
        ]);
        setData(orderData);
        setSuggestions(suggestionData);
        setSuppliers(supplierData);
        setBranchId(orderData.selectedBranch.id);
        setSelected((current) =>
          current
            ? (orderData.orders.find((item) => item.id === current.id) ?? null)
            : null,
        );
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải đơn nhập hàng.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branchId, from, keyword, status, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(order: PurchaseOrder) {
    setEditing(order);
    setSelected(null);
    setFormOpen(true);
  }

  async function save(input: PurchaseOrderInput) {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setSaving(true);
      const saved = editing
        ? await updatePurchaseOrder(token, editing.id, input)
        : await createPurchaseOrder(token, input);
      setFormOpen(false);
      setEditing(null);
      setSelected(saved);
      showToast(
        editing ? "Đã cập nhật đề xuất" : "Đã lập đề xuất nhập hàng",
        "success",
      );
      await load();
    } catch (saveError) {
      showToast(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu đề xuất",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function requestAction(next: PurchaseOrderAction) {
    if (next === "receive") {
      setActionError("");
      setReceiveOpen(true);
      return;
    }
    setReviewNote("");
    setActionError("");
    setAction(next);
  }

  async function executeAction() {
    if (!selected || !action) return;
    if (action === "reject" && reviewNote.trim().length < 3) {
      setActionError("Vui lòng nhập lý do từ chối có ít nhất 3 ký tự.");
      return;
    }
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setBusy(true);
      setActionError("");
      const updated =
        action === "submit"
          ? await submitPurchaseOrder(token, selected.id)
          : action === "approve"
            ? await approvePurchaseOrder(
                token,
                selected.id,
                reviewNote.trim() || undefined,
              )
            : action === "reject"
              ? await rejectPurchaseOrder(token, selected.id, reviewNote.trim())
              : action === "mark-ordered"
                ? await markPurchaseOrderOrdered(token, selected.id)
                : await cancelPurchaseOrder(token, selected.id);
      setSelected(updated);
      setAction(null);
      showToast(
        action === "submit"
          ? "Đã gửi đề xuất cho Admin"
          : action === "approve"
            ? "Đã duyệt đề xuất"
            : action === "reject"
              ? "Đã gửi yêu cầu chỉnh lại"
              : action === "mark-ordered"
                ? "Đã xác nhận đặt hàng"
                : "Đã hủy đơn",
        "success",
      );
      await load();
    } catch (processError) {
      setActionError(
        processError instanceof Error
          ? processError.message
          : "Không thể xử lý đơn.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function receive(input: Parameters<typeof receivePurchaseOrder>[2]) {
    if (!selected) return;
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setBusy(true);
      setActionError("");
      const updated = await receivePurchaseOrder(token, selected.id, input);
      setSelected(updated);
      setReceiveOpen(false);
      showToast(
        updated.status === "COMPLETED"
          ? "Đã nhận đủ và cộng kho"
          : "Đã nhận một phần và cộng kho",
        "success",
      );
      await load();
    } catch (receiveError) {
      setActionError(
        receiveError instanceof Error
          ? receiveError.message
          : "Không thể nhận hàng.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportOrder(format: "pdf" | "xlsx") {
    if (!selected || exporting) return;
    try {
      setExporting(format);
      if (format === "xlsx") {
        const { downloadPurchaseOrderExcel } =
          await import("@/utils/purchase-order-report-excel");
        await downloadPurchaseOrderExcel(selected);
      } else {
        const { downloadPurchaseOrderPdf } =
          await import("@/utils/purchase-order-report-pdf");
        await downloadPurchaseOrderPdf(selected);
      }
      showToast(`Đã xuất đơn ${selected.code}`, "success");
    } catch (exportError) {
      showToast(
        exportError instanceof Error
          ? exportError.message
          : "Không thể xuất đơn",
        "error",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">
            Kho hàng
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">
            Đặt hàng nhà cung cấp
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Tự động đề xuất theo tồn kho và mức dùng gần đây; hàng chỉ cộng kho
            khi xác nhận thực nhận.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCreate}
            disabled={!suggestions || loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <PackagePlus size={17} /> Lập đề xuất
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4D8CC] bg-white text-[#6B4A36]"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </section>
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          icon={ShoppingCart}
          label="Tổng đơn"
          value={String(data?.summary.total ?? 0)}
        />
        <Summary
          icon={Clock3}
          label="Chờ Admin duyệt"
          value={String(data?.summary.pending ?? 0)}
          amber
        />
        <Summary
          icon={PackageCheck}
          label="Đang giao"
          value={String(data?.summary.inTransit ?? 0)}
          violet
        />
        <Summary
          icon={AlertTriangle}
          label="Đơn trễ hẹn"
          value={String(data?.summary.overdue ?? 0)}
          red
        />
      </section>
      <section className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(230px,1fr)_210px_190px_160px_160px_auto]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setKeyword(search.trim());
            }}
            className="relative"
          >
            <Search
              size={17}
              className="absolute left-3 top-3 text-[#9A9089]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã, nhà cung cấp..."
              className="h-11 w-full rounded-xl border border-[#E4D8CC] pl-10 pr-3 text-sm outline-none"
            />
          </form>
          {data && mode === "ADMIN" && (
            <select
              value={branchId}
              onChange={(event) => setBranchId(Number(event.target.value))}
              className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-3 text-sm"
            >
              <>
                {data.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </>
            </select>
          )}
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PurchaseOrderStatus | "ALL")
            }
            className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-3 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(purchaseOrderStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-11 rounded-xl border border-[#E4D8CC] px-3 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 rounded-xl border border-[#E4D8CC] px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => setKeyword(search.trim())}
            className="h-11 rounded-xl bg-[#F3E9DE] px-4 text-sm font-semibold text-[#6B4A36]"
          >
            Lọc
          </button>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left">
            <thead className="bg-[#FCFAF8] text-xs uppercase text-[#78866B]">
              <tr>
                <th className="px-5 py-4">Đơn đặt</th>
                <th className="px-4 py-4">Nhà cung cấp</th>
                <th className="px-4 py-4">Dự kiến giao</th>
                <th className="px-4 py-4">Tiến độ nhận</th>
                <th className="px-4 py-4">Giá trị</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data?.orders.map((order) => {
                const completedItems = order.items.filter(
                  (item) =>
                    item.receivedQuantity + 0.0005 >= item.orderedQuantity,
                ).length;
                return (
                  <tr key={order.id} className="border-t border-[#EEE6DE]">
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#2A211D]">{order.code}</p>
                      <p className="mt-1 text-xs text-[#8A817B]">
                        {order.branch.code} · {order.items.length} nguyên liệu
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">{order.supplier.name}</p>
                      <p className="text-xs text-[#8A817B]">
                        {order.supplier.code}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {date(order.expectedAt)}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <b>{completedItems}</b> / {order.items.length} nguyên liệu
                    </td>
                    <td className="px-4 py-4 font-semibold">
                      {money(order.totalCost)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${badge(order.status)}`}
                      >
                        {purchaseOrderStatusLabels[order.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(order)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4D8CC] px-4 text-sm font-semibold"
                      >
                        <Eye size={16} /> Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && data?.orders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#8A817B]"
                  >
                    Chưa có đơn đặt hàng phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {formOpen && suggestions && (
        <PurchaseOrderFormModal
          key={editing?.id ?? "new"}
          order={editing}
          suggestions={suggestions.rows}
          suppliers={suppliers}
          branchId={suggestions.selectedBranch.id}
          branchLabel={`${suggestions.selectedBranch.code} · ${suggestions.selectedBranch.name}`}
          saving={saving}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={(input) => void save(input)}
        />
      )}
      {selected && (
        <PurchaseOrderDetailModal
          order={selected}
          mode={mode}
          busy={busy}
          exporting={exporting}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onAction={requestAction}
          onExport={(format) => void exportOrder(format)}
        />
      )}
      {receiveOpen && selected && (
        <PurchaseOrderReceiveModal
          order={selected}
          saving={busy}
          error={actionError}
          onClose={() => {
            setReceiveOpen(false);
            setActionError("");
          }}
          onReceive={(input) => void receive(input)}
        />
      )}
      {action && selected && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {actionCopy[action].title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#786D66]">
                  {actionCopy[action].description}
                </p>
              </div>
              <button type="button" onClick={() => setAction(null)}>
                <X size={20} />
              </button>
            </div>
            {(action === "approve" || action === "reject") && (
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder={
                  action === "reject"
                    ? "Lý do cần chỉnh lại *"
                    : "Ghi chú duyệt (không bắt buộc)"
                }
                className="mt-5 min-h-24 w-full rounded-xl border border-[#E4D8CC] p-3 text-sm outline-none"
              />
            )}
            {actionError && (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAction(null)}
                disabled={busy}
                className="h-11 rounded-xl border border-[#E4D8CC] px-5 font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => void executeAction()}
                disabled={busy}
                className={`h-11 rounded-xl px-5 font-semibold text-white disabled:opacity-50 ${action === "reject" || action === "cancel" ? "bg-red-600" : "bg-[#4A2C20]"}`}
              >
                {busy ? "Đang xử lý..." : actionCopy[action].button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  amber,
  violet,
  red,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  amber?: boolean;
  violet?: boolean;
  red?: boolean;
}) {
  const color = red
    ? "bg-red-50 text-red-600"
    : amber
      ? "bg-amber-50 text-amber-700"
      : violet
        ? "bg-violet-50 text-violet-700"
        : "bg-[#F3E9DE] text-[#B96E35]";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm text-[#78866B]">{label}</p>
        <p className="mt-2 text-2xl font-bold text-[#201B18]">{value}</p>
      </div>
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}
      >
        <Icon size={21} />
      </span>
    </div>
  );
}
