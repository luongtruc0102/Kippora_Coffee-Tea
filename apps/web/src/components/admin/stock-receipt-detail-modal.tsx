"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Clock3,
  MapPin,
  Pencil,
  UserRound,
  X,
} from "lucide-react";

import type { StockReceipt } from "@/types/inventory";

type Props = {
  receipt: StockReceipt;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
};

const statusLabels = {
  DRAFT: "Phiếu nháp",
  COMPLETED: "Đã nhập kho",
  CANCELLED: "Đã hủy",
} as const;

const unitLabels = {
  GRAM: "g",
  MILLILITER: "ml",
  PIECE: "cái",
} as const;

function currency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Không có";
}

export default function StockReceiptDetailModal({
  receipt,
  busy,
  onClose,
  onEdit,
  onComplete,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-[#2A211D]">{receipt.code}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${receipt.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : receipt.status === "CANCELLED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{statusLabels[receipt.status]}</span>
            </div>
            <p className="mt-1 text-sm text-[#78866B]">Tạo lúc {dateTime(receipt.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8A817B]"><X size={21} /></button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard icon={MapPin} label="Chi nhánh" value={`${receipt.branch.code} · ${receipt.branch.name}`} />
            <InfoCard icon={UserRound} label="Nhà cung cấp" value={`${receipt.supplier.code} · ${receipt.supplier.name}`} />
            <InfoCard icon={UserRound} label="Người lập phiếu" value={receipt.createdBy.fullName || receipt.createdBy.email} />
            <InfoCard icon={Clock3} label="Thời điểm nhập kho" value={receipt.receivedAt ? dateTime(receipt.receivedAt) : "Chưa xác nhận"} />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#E9E1D8]">
            <table className="w-full min-w-[600px] text-left">
              <thead className="border-b border-[#E9E1D8] bg-[#FCFAF8] text-xs uppercase text-[#78866B]"><tr><th className="px-4 py-3">Nguyên liệu</th><th className="px-4 py-3">Số lượng</th><th className="px-4 py-3">Đơn giá</th><th className="px-4 py-3 text-right">Thành tiền</th></tr></thead>
              <tbody className="divide-y divide-[#F0E8E0]">{receipt.items.map((item) => <tr key={item.id}><td className="px-4 py-3"><p className="font-semibold text-[#2A211D]">{item.ingredient.name}</p><p className="mt-1 text-xs text-[#78866B]">Lô: {item.batchCode || item.lots?.[0]?.batchCode || "Tự động"} · NSX: {shortDate(item.manufacturedAt)} · HSD: {shortDate(item.expiresAt)}</p></td><td className="px-4 py-3 text-sm text-[#5E5650]">{Number(item.quantity).toLocaleString("vi-VN")} {unitLabels[item.ingredient.unit]}</td><td className="px-4 py-3 text-sm text-[#5E5650]">{currency(item.unitCost)}</td><td className="px-4 py-3 text-right font-semibold text-[#4A2C20]">{currency(item.lineTotal)}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#FAF8F5] px-5 py-4"><span className="text-sm text-[#78866B]">Tổng giá trị phiếu</span><strong className="text-xl text-[#4A2C20]">{currency(receipt.totalCost)}</strong></div>

          {receipt.note && <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4"><p className="text-xs font-semibold uppercase text-amber-700">Ghi chú</p><p className="mt-1 text-sm leading-6 text-[#5E5650]">{receipt.note}</p></div>}

          {receipt.status === "DRAFT" && <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" /><p className="text-sm leading-6 text-amber-800">Sau khi xác nhận, số lượng trong phiếu sẽ được cộng vào kho và phiếu không thể sửa hoặc hủy.</p></div>}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[#E9E1D8] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold text-[#5E5650]">Đóng</button>
          {receipt.status === "DRAFT" && <><button type="button" disabled={busy} onClick={onCancel} className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"><CircleX size={16} /> Hủy phiếu</button><button type="button" disabled={busy} onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#6B4A36] disabled:opacity-50"><Pencil size={16} /> Chỉnh sửa</button><button type="button" disabled={busy} onClick={onComplete} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={17} /> {busy ? "Đang xử lý..." : "Xác nhận nhập kho"}</button></>}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <div className="rounded-2xl border border-[#E9E1D8] px-4 py-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#8A817B]"><Icon size={14} className="text-[#C2763D]" />{label}</p><p className="mt-2 text-sm font-semibold text-[#2A211D]">{value}</p></div>;
}
