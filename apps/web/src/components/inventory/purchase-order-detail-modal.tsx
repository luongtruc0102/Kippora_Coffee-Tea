"use client";

import {
  CheckCircle2,
  Download,
  PackageCheck,
  Pencil,
  Send,
  ShoppingCart,
  X,
  XCircle,
} from "lucide-react";

import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/inventory";

export type PurchaseOrderAction =
  "submit" | "approve" | "reject" | "mark-ordered" | "receive" | "cancel";

type Props = {
  order: PurchaseOrder;
  mode: "ADMIN" | "BRANCH_MANAGER";
  busy: boolean;
  exporting: "pdf" | "xlsx" | null;
  onClose: () => void;
  onEdit: () => void;
  onAction: (action: PurchaseOrderAction) => void;
  onExport: (format: "pdf" | "xlsx") => void;
};

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt",
  ORDERED: "Đã đặt nhà cung cấp",
  PARTIALLY_RECEIVED: "Đã nhận một phần",
  COMPLETED: "Đã nhận đủ",
  REJECTED: "Cần chỉnh lại",
  CANCELLED: "Đã hủy",
};

const units = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

function number(value: number, maximumFractionDigits = 3) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(
    value,
  );
}

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function date(value: string | null, time = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(
    "vi-VN",
    time ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" },
  ).format(new Date(value));
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

export default function PurchaseOrderDetailModal({
  order,
  mode,
  busy,
  exporting,
  onClose,
  onEdit,
  onAction,
  onExport,
}: Props) {
  const editable = ["DRAFT", "REJECTED"].includes(order.status);
  const canCancel =
    mode === "ADMIN"
      ? ["DRAFT", "PENDING", "APPROVED", "ORDERED"].includes(order.status)
      : ["DRAFT", "PENDING"].includes(order.status);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-4 sm:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-[#2A211D]">
                Đơn nhập hàng {order.code}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${badge(order.status)}`}
              >
                {purchaseOrderStatusLabels[order.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#78866B]">
              {order.branch.code} · {order.supplier.name} · Lập lúc{" "}
              {date(order.createdAt, true)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#81766F] hover:bg-[#F7F2EC]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Nhà cung cấp" value={order.supplier.name} />
            <Info label="Ngày dự kiến giao" value={date(order.expectedAt)} />
            <Info label="Tổng giá trị dự kiến" value={money(order.totalCost)} />
            <Info
              label="Người lập"
              value={order.createdBy.fullName || order.createdBy.email}
            />
          </section>
          {(order.note || order.reviewNote) && (
            <section className="mt-4 grid gap-3 sm:grid-cols-2">
              {order.note && (
                <Info label="Ghi chú đặt hàng" value={order.note} />
              )}
              {order.reviewNote && (
                <Info label="Phản hồi của Admin" value={order.reviewNote} />
              )}
            </section>
          )}

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E1D8]">
            <div className="hidden grid-cols-[minmax(180px,1.5fr)_repeat(5,minmax(100px,0.8fr))] gap-3 bg-[#FCFAF8] px-4 py-3 text-xs font-bold uppercase text-[#78866B] lg:grid">
              <span>Nguyên liệu</span>
              <span>Đề xuất</span>
              <span>Đã đặt</span>
              <span>Đã nhận</span>
              <span>Còn lại</span>
              <span>Thành tiền</span>
            </div>
            {order.items.map((item) => {
              const remaining = Math.max(
                0,
                item.orderedQuantity - item.receivedQuantity,
              );
              const progress = Math.min(
                100,
                item.orderedQuantity
                  ? (item.receivedQuantity / item.orderedQuantity) * 100
                  : 0,
              );
              return (
                <div
                  key={item.id}
                  className="grid gap-3 border-t border-[#EEE6DE] p-4 first:border-t-0 lg:grid-cols-[minmax(180px,1.5fr)_repeat(5,minmax(100px,0.8fr))] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-[#2A211D]">
                      {item.ingredient.name}
                    </p>
                    <p className="mt-1 text-xs text-[#8A817B]">
                      Có thể dùng lúc lập: {number(item.availableSnapshot)}{" "}
                      {units[item.ingredient.unit]}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEE8E2]">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <Cell
                    label="Đề xuất"
                    value={`${number(item.suggestedQuantity)} ${units[item.ingredient.unit]}`}
                  />
                  <Cell
                    label="Đã đặt"
                    value={`${number(item.orderedQuantity)} ${units[item.ingredient.unit]}`}
                  />
                  <Cell
                    label="Đã nhận"
                    value={`${number(item.receivedQuantity)} ${units[item.ingredient.unit]}`}
                    green={item.receivedQuantity > 0}
                  />
                  <Cell
                    label="Còn lại"
                    value={`${number(remaining)} ${units[item.ingredient.unit]}`}
                    amber={remaining > 0}
                  />
                  <Cell label="Thành tiền" value={money(item.lineTotal)} />
                </div>
              );
            })}
          </section>

          {order.receipts.length > 0 && (
            <section className="mt-5">
              <h3 className="font-bold text-[#2A211D]">Các lần nhận hàng</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {order.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4"
                  >
                    <p className="font-bold text-[#4A2C20]">{receipt.code}</p>
                    <p className="mt-1 text-xs text-[#78866B]">
                      {date(receipt.receivedAt, true)} · {receipt.items.length}{" "}
                      nguyên liệu
                    </p>
                    <p className="mt-3 font-semibold">
                      {money(receipt.totalCost)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="flex flex-col justify-between gap-3 border-t border-[#E9E1D8] px-5 py-4 lg:flex-row lg:items-center sm:px-7">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => onExport("xlsx")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 px-4 text-sm font-semibold text-emerald-700"
            >
              <Download size={16} />{" "}
              {exporting === "xlsx" ? "Đang xuất..." : "Excel"}
            </button>
            <button
              type="button"
              disabled={Boolean(exporting)}
              onClick={() => onExport("pdf")}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4D8CC] px-4 text-sm font-semibold text-[#9A572B]"
            >
              <Download size={16} />{" "}
              {exporting === "pdf" ? "Đang xuất..." : "PDF"}
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {editable && (
              <button
                type="button"
                disabled={busy}
                onClick={onEdit}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4D8CC] px-4 text-sm font-semibold"
              >
                <Pencil size={16} /> Sửa
              </button>
            )}
            {order.status === "DRAFT" && (
              <Action
                icon={Send}
                label="Gửi duyệt"
                onClick={() => onAction("submit")}
                busy={busy}
              />
            )}
            {mode === "ADMIN" && order.status === "PENDING" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction("reject")}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600"
                >
                  <XCircle size={16} /> Từ chối
                </button>
                <Action
                  icon={CheckCircle2}
                  label="Duyệt"
                  onClick={() => onAction("approve")}
                  busy={busy}
                />
              </>
            )}
            {mode === "ADMIN" && order.status === "APPROVED" && (
              <Action
                icon={ShoppingCart}
                label="Xác nhận đã đặt"
                onClick={() => onAction("mark-ordered")}
                busy={busy}
              />
            )}
            {["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status) && (
              <Action
                icon={PackageCheck}
                label="Nhận hàng"
                onClick={() => onAction("receive")}
                busy={busy}
              />
            )}
            {canCancel && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction("cancel")}
                className="h-10 rounded-xl px-4 text-sm font-semibold text-red-600"
              >
                Hủy đơn
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#E4D8CC] px-4 text-sm font-semibold"
            >
              Đóng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  busy,
}: {
  icon: typeof Send;
  label: string;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white disabled:opacity-50"
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4">
      <p className="text-xs font-semibold uppercase text-[#8A817B]">{label}</p>
      <p className="mt-2 font-semibold text-[#2A211D]">{value}</p>
    </div>
  );
}

function Cell({
  label,
  value,
  green,
  amber,
}: {
  label: string;
  value: string;
  green?: boolean;
  amber?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[#8A817B] lg:hidden">{label}</p>
      <p
        className={`text-sm font-semibold ${green ? "text-emerald-700" : amber ? "text-amber-700" : "text-[#3F3732]"}`}
      >
        {value}
      </p>
    </div>
  );
}
