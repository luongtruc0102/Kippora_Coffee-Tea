"use client";

import { PackageCheck, X } from "lucide-react";
import { useState } from "react";

import type { PurchaseOrder } from "@/types/inventory";

type Props = {
  order: PurchaseOrder;
  saving: boolean;
  error: string;
  onClose: () => void;
  onReceive: (input: {
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
  }) => void;
};

const units = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

function localDateTime(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function number(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

export default function PurchaseOrderReceiveModal({
  order,
  saving,
  error,
  onClose,
  onReceive,
}: Props) {
  const remainingItems = order.items.filter(
    (item) => item.receivedQuantity < item.orderedQuantity,
  );
  const [receivedAt, setReceivedAt] = useState(localDateTime());
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>(
    Object.fromEntries(
      remainingItems.map((item) => [
        item.id,
        String(item.orderedQuantity - item.receivedQuantity),
      ]),
    ),
  );
  const [lotData, setLotData] = useState<Record<number, {
    batchCode: string;
    manufacturedAt: string;
    expiresAt: string;
    lotNote: string;
  }>>(Object.fromEntries(remainingItems.map((item) => [item.id, {
    batchCode: "", manufacturedAt: "", expiresAt: "", lotNote: "",
  }])));
  const [localError, setLocalError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const items = remainingItems
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantity: Number(quantities[item.id] || 0),
        batchCode: lotData[item.id]?.batchCode.trim() || undefined,
        manufacturedAt: lotData[item.id]?.manufacturedAt || undefined,
        expiresAt: lotData[item.id]?.expiresAt || undefined,
        lotNote: lotData[item.id]?.lotNote.trim() || undefined,
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setLocalError(
        "Vui lòng nhập số lượng thực nhận của ít nhất một nguyên liệu.",
      );
      return;
    }
    const invalid = items.find((input) => {
      const source = remainingItems.find(
        (item) => item.id === input.purchaseOrderItemId,
      )!;
      return (
        !Number.isFinite(input.quantity) ||
        input.quantity >
          source.orderedQuantity - source.receivedQuantity + 0.0005
      );
    });
    if (invalid) {
      setLocalError("Số thực nhận không được lớn hơn số lượng còn thiếu.");
      return;
    }
    setLocalError("");
    onReceive({
      receivedAt: new Date(receivedAt).toISOString(),
      note: note.trim() || undefined,
      items,
    });
  }

  function updateLot(itemId: number, patch: Partial<(typeof lotData)[number]>) {
    setLotData((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...patch },
    }));
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <form
        onSubmit={submit}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-4 sm:px-7">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PackageCheck size={22} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#2A211D]">
                Nhận hàng theo {order.code}
              </h2>
              <p className="mt-1 text-sm text-[#78866B]">
                Có thể xác nhận nhiều lần nếu nhà cung cấp giao thiếu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-[#81766F]"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Thời gian nhận *
              <input
                type="datetime-local"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#E4D8CC] px-3 font-normal outline-none"
              />
            </label>
            <label className="text-sm font-semibold">
              Ghi chú giao nhận
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="Số lô, tình trạng hàng..."
                className="mt-2 h-11 w-full rounded-xl border border-[#E4D8CC] px-3 font-normal outline-none"
              />
            </label>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#E9E1D8]">
            {remainingItems.map((item) => {
              const remaining = item.orderedQuantity - item.receivedQuantity;
              return (
                <div
                  key={item.id}
                  className="space-y-3 border-t border-[#EEE6DE] p-4 first:border-0"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px] sm:items-center">
                    <div>
                      <p className="font-semibold">{item.ingredient.name}</p>
                      <p className="mt-1 text-xs text-[#78866B]">
                        Đã nhận {number(item.receivedQuantity)} · Còn{" "}
                        {number(remaining)} {units[item.ingredient.unit]}
                      </p>
                    </div>
                    <label className="text-xs font-semibold text-[#78866B]">
                      THỰC NHẬN
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        step="0.001"
                        value={quantities[item.id] ?? ""}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none"
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-semibold text-[#78866B]">MÃ LÔ NCC<input value={lotData[item.id]?.batchCode ?? ""} maxLength={80} onChange={(event) => updateLot(item.id, { batchCode: event.target.value })} placeholder="Tự lấy mã phiếu" className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                    <label className="text-xs font-semibold text-[#78866B]">NGÀY SẢN XUẤT<input type="date" value={lotData[item.id]?.manufacturedAt ?? ""} onChange={(event) => updateLot(item.id, { manufacturedAt: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                    <label className="text-xs font-semibold text-[#78866B]">HẠN DÙNG<input type="date" value={lotData[item.id]?.expiresAt ?? ""} onChange={(event) => updateLot(item.id, { expiresAt: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                    <label className="text-xs font-semibold text-[#78866B]">GHI CHÚ LÔ<input value={lotData[item.id]?.lotNote ?? ""} maxLength={255} onChange={(event) => updateLot(item.id, { lotNote: event.target.value })} placeholder="Tình trạng bao bì..." className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                  </div>
                </div>
              );
            })}
          </div>
          {(localError || error) && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {localError || error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#E9E1D8] px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-xl border border-[#E4D8CC] px-5 font-semibold"
          >
            Đóng
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-xl bg-emerald-700 px-6 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Đang cộng kho..." : "Xác nhận và cộng kho"}
          </button>
        </footer>
      </form>
    </div>
  );
}
