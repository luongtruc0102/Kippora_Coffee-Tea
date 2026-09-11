"use client";

import { PackagePlus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderSuggestion,
  Supplier,
} from "@/types/inventory";

type Props = {
  order?: PurchaseOrder | null;
  suggestions: PurchaseOrderSuggestion[];
  suppliers: Supplier[];
  branchId: number;
  branchLabel: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: PurchaseOrderInput) => void;
};

type DraftRow = PurchaseOrderSuggestion & {
  selected: boolean;
  quantity: string;
  unitCost: string;
  note: string;
};

const units = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

function dateKey(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function quantity(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

export default function PurchaseOrderFormModal({
  order,
  suggestions,
  suppliers,
  branchId,
  branchLabel,
  saving,
  onClose,
  onSave,
}: Props) {
  const existing = new Map(
    order?.items.map((item) => [item.ingredientId, item]),
  );
  const [supplierId, setSupplierId] = useState(String(order?.supplierId ?? ""));
  const [expectedAt, setExpectedAt] = useState(
    order?.expectedAt ? dateKey(new Date(order.expectedAt)) : "",
  );
  const [note, setNote] = useState(order?.note ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<DraftRow[]>(() =>
    suggestions.map((row) => {
      const item = existing.get(row.ingredient.id);
      return {
        ...row,
        selected: Boolean(item) || (!order && row.suggestedQuantity > 0),
        quantity: String(
          (item?.orderedQuantity ?? row.suggestedQuantity) || "",
        ),
        unitCost: String(item?.unitCost ?? row.lastUnitCost ?? ""),
        note: item?.note ?? "",
      };
    }),
  );
  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return keyword
      ? rows.filter((row) =>
          row.ingredient.name.toLocaleLowerCase("vi").includes(keyword),
        )
      : rows;
  }, [rows, search]);
  const selectedRows = rows.filter((row) => row.selected);
  const total = selectedRows.reduce(
    (sum, row) =>
      sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0),
    0,
  );

  function patchRow(id: number, patch: Partial<DraftRow>) {
    setRows((current) =>
      current.map((row) =>
        row.ingredient.id === id ? { ...row, ...patch } : row,
      ),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number(supplierId)) {
      setError("Vui lòng chọn nhà cung cấp.");
      return;
    }
    if (!selectedRows.length) {
      setError("Vui lòng chọn ít nhất một nguyên liệu.");
      return;
    }
    const invalid = selectedRows.find(
      (row) =>
        !Number.isFinite(Number(row.quantity)) ||
        Number(row.quantity) <= 0 ||
        !Number.isFinite(Number(row.unitCost)) ||
        Number(row.unitCost) < 0,
    );
    if (invalid) {
      setError(
        `Số lượng hoặc đơn giá của ${invalid.ingredient.name} chưa hợp lệ.`,
      );
      return;
    }
    setError("");
    onSave({
      branchId,
      supplierId: Number(supplierId),
      expectedAt: expectedAt || undefined,
      note: note.trim() || undefined,
      items: selectedRows.map((row) => ({
        ingredientId: row.ingredient.id,
        quantity: Number(row.quantity),
        unitCost: Number(row.unitCost),
        note: row.note.trim() || undefined,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 sm:p-6">
      <form
        onSubmit={submit}
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-4 sm:px-7">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#B96E35]">
              <PackagePlus size={22} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#2A211D]">
                {order ? `Sửa đề xuất ${order.code}` : "Lập đề xuất nhập hàng"}
              </h2>
              <p className="mt-1 text-sm text-[#78866B]">{branchLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-[#81766F] hover:bg-[#F7F2EC]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="text-sm font-semibold text-[#4A403A]">
              Nhà cung cấp *
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-[#E4D8CC] bg-white px-3 font-normal outline-none"
              >
                <option value="">Chọn nhà cung cấp</option>
                {suppliers
                  .filter((supplier) => supplier.isActive)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.code} · {supplier.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#4A403A]">
              Ngày dự kiến giao
              <input
                type="date"
                value={expectedAt}
                onChange={(event) => setExpectedAt(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-[#E4D8CC] px-3 font-normal outline-none"
              />
            </label>
            <label className="text-sm font-semibold text-[#4A403A]">
              Ghi chú
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="Lịch giao, yêu cầu đóng gói..."
                className="mt-2 h-12 w-full rounded-xl border border-[#E4D8CC] px-3 font-normal outline-none"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-bold text-[#2A211D]">Nguyên liệu cần đặt</h3>
              <p className="mt-1 text-xs text-[#78866B]">
                Gợi ý đã trừ lượng đang đặt chưa nhận; anh vẫn có thể sửa số
                lượng.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                size={17}
                className="absolute left-3 top-3 text-[#9A9089]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm nguyên liệu..."
                className="h-11 w-full rounded-xl border border-[#E4D8CC] pl-10 pr-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[#E9E1D8]">
            <div className="hidden grid-cols-[48px_minmax(170px,1.4fr)_repeat(4,minmax(100px,0.8fr))_110px_130px] gap-3 bg-[#FCFAF8] px-4 py-3 text-xs font-bold uppercase text-[#78866B] xl:grid">
              <span /> <span>Nguyên liệu</span>
              <span>Có thể dùng</span>
              <span>Đang về</span>
              <span>Dùng/ngày</span>
              <span>Đề xuất</span>
              <span>Số đặt</span>
              <span>Đơn giá</span>
            </div>
            {visibleRows.map((row) => (
              <div
                key={row.ingredient.id}
                className={`grid gap-3 border-t border-[#EEE6DE] p-4 first:border-t-0 xl:grid-cols-[48px_minmax(170px,1.4fr)_repeat(4,minmax(100px,0.8fr))_110px_130px] xl:items-center ${row.selected ? "bg-amber-50/30" : "bg-white"}`}
              >
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(event) =>
                    patchRow(row.ingredient.id, {
                      selected: event.target.checked,
                    })
                  }
                  className="h-5 w-5 accent-[#B96E35]"
                />
                <div>
                  <p className="font-semibold text-[#2A211D]">
                    {row.ingredient.name}
                  </p>
                  <p className="text-xs text-[#8A817B]">
                    {units[row.ingredient.unit]}
                  </p>
                </div>
                <Metric
                  label="Có thể dùng"
                  value={quantity(row.availableQuantity)}
                />
                <Metric
                  label="Đang về"
                  value={quantity(row.incomingQuantity)}
                />
                <Metric
                  label="Dùng/ngày"
                  value={quantity(row.averageDailyUsage)}
                />
                <Metric
                  label="Đề xuất"
                  value={quantity(row.suggestedQuantity)}
                  strong
                />
                <input
                  aria-label={`Số lượng ${row.ingredient.name}`}
                  disabled={!row.selected}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={row.quantity}
                  onChange={(event) =>
                    patchRow(row.ingredient.id, {
                      quantity: event.target.value,
                    })
                  }
                  className="h-10 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none disabled:bg-slate-50"
                />
                <input
                  aria-label={`Đơn giá ${row.ingredient.name}`}
                  disabled={!row.selected}
                  type="number"
                  min="0"
                  step="1"
                  value={row.unitCost}
                  onChange={(event) =>
                    patchRow(row.ingredient.id, {
                      unitCost: event.target.value,
                    })
                  }
                  className="h-10 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none disabled:bg-slate-50"
                />
              </div>
            ))}
          </div>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col justify-between gap-3 border-t border-[#E9E1D8] px-5 py-4 sm:flex-row sm:items-center sm:px-7">
          <p className="text-sm text-[#6F655F]">
            Đã chọn <b>{selectedRows.length}</b> nguyên liệu · Dự kiến{" "}
            <b>{new Intl.NumberFormat("vi-VN").format(total)} đ</b>
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 rounded-xl border border-[#E4D8CC] px-5 font-semibold text-[#5E5650]"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 rounded-xl bg-[#4A2C20] px-6 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function Metric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[#8A817B] xl:hidden">{label}</p>
      <p
        className={
          strong ? "font-bold text-[#B15D24]" : "text-sm text-[#4A403A]"
        }
      >
        {value}
      </p>
    </div>
  );
}
