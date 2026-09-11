"use client";

import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Pencil,
  Send,
  X,
  XCircle,
} from "lucide-react";

import type {
  InventoryCount,
  InventoryCountStatus,
  InventoryVarianceReason,
} from "@/types/inventory";
import { varianceReasonLabels } from "./inventory-count-form-modal";

export type InventoryCountAction = "submit" | "approve" | "reject" | "cancel";

type Props = {
  mode: "ADMIN" | "BRANCH_MANAGER";
  count: InventoryCount;
  busy: boolean;
  exporting: "pdf" | "xlsx" | null;
  onClose: () => void;
  onEdit: () => void;
  onAction: (action: InventoryCountAction) => void;
  onExport: (format: "pdf" | "xlsx") => void;
};

const statusLabels: Record<InventoryCountStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

const unitLabels = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeClass(status: InventoryCountStatus) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  if (status === "REJECTED") return "bg-red-50 text-red-600";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-600";
  return "bg-blue-50 text-blue-700";
}

export default function InventoryCountDetailModal({
  mode,
  count,
  busy,
  exporting,
  onClose,
  onEdit,
  onAction,
  onExport,
}: Props) {
  const increases = count.items.filter(
    (item) => item.differenceQuantity > 0.0005,
  ).length;
  const shortages = count.items.filter(
    (item) => item.differenceQuantity < -0.0005,
  ).length;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-4 sm:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-[#2A211D]">{count.code}</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(count.status)}`}
              >
                {statusLabels[count.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#78866B]">
              {count.branch.code} · {count.branch.name}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#81766F] hover:bg-[#F7F2EC]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Thời gian kiểm" value={formatDate(count.countedAt)} />
            <Info
              label="Người lập"
              value={count.createdBy.fullName || count.createdBy.email}
            />
            <Info label="Thiếu hụt" value={`${shortages} nguyên liệu`} danger />
            <Info label="Dư thừa" value={`${increases} nguyên liệu`} success />
          </section>

          {(count.note || count.reviewNote) && (
            <section className="mt-4 grid gap-3 md:grid-cols-2">
              {count.note && (
                <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4">
                  <p className="text-xs font-semibold uppercase text-[#8A817B]">
                    Ghi chú kiểm kê
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#2A211D]">
                    {count.note}
                  </p>
                </div>
              )}
              {count.reviewNote && (
                <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4">
                  <p className="text-xs font-semibold uppercase text-[#8A817B]">
                    Phản hồi của Admin
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#2A211D]">
                    {count.reviewNote}
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="mt-5 overflow-x-auto rounded-2xl border border-[#E9E1D8]">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-[#4A2C20] text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-3">Nguyên liệu</th>
                  <th className="px-4 py-3 text-right">Hệ thống</th>
                  <th className="px-4 py-3 text-right">Thực tế</th>
                  <th className="px-4 py-3 text-right">Chênh lệch</th>
                  <th className="px-4 py-3">Nguyên nhân</th>
                  <th className="px-4 py-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE6DE]">
                {count.items.map((item) => {
                  const unit = unitLabels[item.ingredient.unit];
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-[#2A211D]">
                        {item.ingredient.name}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[#6B625C]">
                        {formatQuantity(item.expectedQuantity)} {unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        {formatQuantity(item.countedQuantity)} {unit}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm font-bold ${item.differenceQuantity < 0 ? "text-red-600" : item.differenceQuantity > 0 ? "text-emerald-700" : "text-[#9A9089]"}`}
                      >
                        {item.differenceQuantity > 0 ? "+" : ""}
                        {formatQuantity(item.differenceQuantity)} {unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5E5650]">
                        {item.reason
                          ? varianceReasonLabels[
                              item.reason as InventoryVarianceReason
                            ]
                          : "—"}
                      </td>
                      <td className="max-w-64 px-4 py-3 text-sm text-[#6B625C]">
                        {item.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E1D8] px-5 py-4 sm:px-7">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || exporting !== null}
              onClick={() => onExport("xlsx")}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-50"
            >
              <FileSpreadsheet size={17} />
              {exporting === "xlsx" ? "Đang xuất..." : "Excel"}
            </button>
            <button
              type="button"
              disabled={busy || exporting !== null}
              onClick={() => onExport("pdf")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DCCBBB] px-4 py-2.5 text-sm font-semibold text-[#7B4B2A] disabled:opacity-50"
            >
              <Download size={17} />
              {exporting === "pdf" ? "Đang xuất..." : "PDF"}
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {count.status === "DRAFT" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onEdit}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#DCCBBB] px-4 py-2.5 text-sm font-semibold text-[#6B4A36]"
                >
                  <Pencil size={17} /> Sửa phiếu
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction("submit")}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Send size={17} /> Gửi Admin duyệt
                </button>
              </>
            )}
            {(count.status === "DRAFT" || count.status === "PENDING") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction("cancel")}
                className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600"
              >
                <XCircle size={17} /> Hủy phiếu
              </button>
            )}
            {mode === "ADMIN" && count.status === "PENDING" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction("reject")}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600"
                >
                  <XCircle size={17} /> Từ chối
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction("approve")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <CheckCircle2 size={17} /> Duyệt và cập nhật kho
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  danger,
  success,
}: {
  label: string;
  value: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4">
      <p className="text-xs font-semibold uppercase text-[#8A817B]">{label}</p>
      <p
        className={`mt-2 font-bold ${danger ? "text-red-600" : success ? "text-emerald-700" : "text-[#2A211D]"}`}
      >
        {value}
      </p>
    </div>
  );
}
