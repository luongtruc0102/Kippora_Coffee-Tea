"use client";

import { Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  Ingredient,
  InventoryBranch,
  StockReceipt,
  StockReceiptInput,
  Supplier,
} from "@/types/inventory";

type DraftItem = {
  ingredientId: number;
  quantity: string;
  unitCost: string;
  batchCode: string;
  manufacturedAt: string;
  expiresAt: string;
  lotNote: string;
};

type Props = {
  branches: InventoryBranch[];
  suppliers: Supplier[];
  ingredients: Ingredient[];
  initialBranchId: number;
  receipt?: StockReceipt | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: StockReceiptInput) => void;
};

const unitLabels = {
  GRAM: "g",
  MILLILITER: "ml",
  PIECE: "cái",
} as const;

function currency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function StockReceiptFormModal({
  branches,
  suppliers,
  ingredients,
  initialBranchId,
  receipt,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const [branchId, setBranchId] = useState(
    receipt?.branchId ?? initialBranchId,
  );
  const [supplierId, setSupplierId] = useState(
    receipt?.supplierId ?? suppliers[0]?.id ?? 0,
  );
  const [note, setNote] = useState(receipt?.note ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    receipt?.items.length
      ? receipt.items.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: String(item.quantity),
          unitCost: String(item.unitCost),
          batchCode: item.batchCode ?? "",
          manufacturedAt: item.manufacturedAt?.slice(0, 10) ?? "",
          expiresAt: item.expiresAt?.slice(0, 10) ?? "",
          lotNote: item.lotNote ?? "",
        }))
      : ingredients[0]
        ? [{ ingredientId: ingredients[0].id, quantity: "", unitCost: "", batchCode: "", manufacturedAt: "", expiresAt: "", lotNote: "" }]
        : [],
  );

  const usedIds = useMemo(
    () => new Set(items.map((item) => item.ingredientId)),
    [items],
  );
  const totalCost = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
        0,
      ),
    [items],
  );

  function addItem() {
    const ingredient = ingredients.find((item) => !usedIds.has(item.id));
    if (!ingredient) return;
    setItems((current) => [
      ...current,
      { ingredientId: ingredient.id, quantity: "", unitCost: "", batchCode: "", manufacturedAt: "", expiresAt: "", lotNote: "" },
    ]);
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!branchId || !supplierId || !items.length) return;
    const parsed = items.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      batchCode: item.batchCode.trim() || undefined,
      manufacturedAt: item.manufacturedAt || undefined,
      expiresAt: item.expiresAt || undefined,
      lotNote: item.lotNote.trim() || undefined,
    }));
    if (
      parsed.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitCost) ||
          item.unitCost < 0,
      )
    ) {
      return;
    }
    onSave({
      branchId,
      supplierId,
      note: note.trim() || undefined,
      items: parsed,
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#2A211D]">
              {receipt ? `Chỉnh sửa ${receipt.code}` : "Tạo phiếu nhập kho"}
            </h2>
            <p className="mt-1 text-sm text-[#78866B]">
              Phiếu được lưu nháp và chưa cộng kho cho đến khi xác nhận.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8A817B]">
            <X size={21} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
                Chi nhánh nhập *
              </span>
              <select
                required
                disabled={Boolean(receipt)}
                value={branchId}
                onChange={(event) => setBranchId(Number(event.target.value))}
                className="w-full rounded-xl border border-[#E4D8CC] bg-white px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
                Nhà cung cấp *
              </span>
              <select
                required
                value={supplierId}
                onChange={(event) => setSupplierId(Number(event.target.value))}
                className="w-full rounded-xl border border-[#E4D8CC] bg-white px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
              >
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} · {supplier.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[#E9E1D8]">
            <div className="bg-[#FCFAF8] px-4 py-3 text-xs font-semibold uppercase text-[#78866B]">
              Nguyên liệu và thông tin lô
            </div>
            <div className="divide-y divide-[#F0E8E0]">
              {items.map((item, index) => {
                const ingredient = ingredients.find(
                  (candidate) => candidate.id === item.ingredientId,
                );
                const lineTotal =
                  (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
                return (
                  <div key={`${item.ingredientId}-${index}`} className="space-y-3 px-4 py-4">
                    <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_140px_160px_130px_44px] sm:items-center">
                      <select value={item.ingredientId} onChange={(event) => updateItem(index, { ingredientId: Number(event.target.value) })} className="min-w-0 rounded-xl border border-[#E4D8CC] bg-white px-3 py-2.5 text-sm outline-none">
                        {ingredients.map((option) => <option key={option.id} value={option.id} disabled={usedIds.has(option.id) && option.id !== item.ingredientId}>{option.name}</option>)}
                      </select>
                      <label className="flex items-center rounded-xl border border-[#E4D8CC] pr-3"><input aria-label="Số lượng" required type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" /><span className="text-xs text-[#8A817B]">{ingredient ? unitLabels[ingredient.unit] : ""}</span></label>
                      <label className="flex items-center rounded-xl border border-[#E4D8CC] pr-3"><input aria-label="Đơn giá" required type="number" min="0" step="1" value={item.unitCost} onChange={(event) => updateItem(index, { unitCost: event.target.value })} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" /><span className="text-xs text-[#8A817B]">đ</span></label>
                      <strong className="text-sm text-[#4A2C20]">{currency(lineTotal)}</strong>
                      <button type="button" aria-label="Xóa nguyên liệu" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 disabled:opacity-30"><Trash2 size={16} /></button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <label className="text-xs font-semibold text-[#78866B]">MÃ LÔ NCC<input value={item.batchCode} maxLength={80} onChange={(event) => updateItem(index, { batchCode: event.target.value })} placeholder="Tự lấy mã phiếu" className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                      <label className="text-xs font-semibold text-[#78866B]">NGÀY SẢN XUẤT<input type="date" value={item.manufacturedAt} onChange={(event) => updateItem(index, { manufacturedAt: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                      <label className="text-xs font-semibold text-[#78866B]">HẠN DÙNG<input type="date" value={item.expiresAt} onChange={(event) => updateItem(index, { expiresAt: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                      <label className="text-xs font-semibold text-[#78866B]">GHI CHÚ LÔ<input value={item.lotNote} maxLength={255} onChange={(event) => updateItem(index, { lotNote: event.target.value })} placeholder="Tình trạng bao bì..." className="mt-1 h-10 w-full rounded-xl border border-[#E4D8CC] px-3 text-sm font-normal text-[#2A211D] outline-none" /></label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <button type="button" disabled={items.length >= ingredients.length} onClick={addItem} className="inline-flex items-center gap-2 rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#6B4A36] disabled:opacity-40"><Plus size={16} /> Thêm nguyên liệu</button>
            <p className="text-sm text-[#78866B]">Tổng tiền: <strong className="ml-2 text-lg text-[#4A2C20]">{currency(totalCost)}</strong></p>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-[#3D332D]">Ghi chú</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} placeholder="Số hóa đơn nhà cung cấp, tình trạng giao hàng..." className="w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" />
          </label>
          {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E9E1D8] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold text-[#5E5650]">Hủy</button>
          <button disabled={saving || !suppliers.length || !ingredients.length} className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} /> {saving ? "Đang lưu..." : "Lưu phiếu nháp"}</button>
        </div>
      </form>
    </div>
  );
}
