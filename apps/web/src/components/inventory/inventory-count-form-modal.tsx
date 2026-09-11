"use client";

import { ClipboardCheck, RotateCcw, Save, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  InventoryBranch,
  InventoryCount,
  InventoryCountInput,
  InventoryRow,
  InventoryVarianceReason,
} from "@/types/inventory";

type Props = {
  branch: InventoryBranch;
  rows: InventoryRow[];
  count?: InventoryCount | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: InventoryCountInput) => void;
};

type DraftItem = {
  ingredientId: number;
  name: string;
  unit: string;
  expectedQuantity: number;
  countedQuantity: string;
  reason: InventoryVarianceReason | "";
  note: string;
};

const unitLabels = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

export const varianceReasonLabels: Record<InventoryVarianceReason, string> = {
  BREAKAGE: "Đổ vỡ",
  SPOILAGE: "Hư hỏng",
  EXPIRED: "Hết hạn",
  LOSS: "Thất thoát",
  COUNTING_ERROR: "Sai số lần kiểm trước",
  OTHER: "Khác",
};

function localDateTime(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

export default function InventoryCountFormModal({
  branch,
  rows,
  count,
  saving,
  onClose,
  onSave,
}: Props) {
  const existingByIngredient = new Map(
    count?.items.map((item) => [item.ingredientId, item]) ?? [],
  );
  const [countedAt, setCountedAt] = useState(
    localDateTime(count ? new Date(count.countedAt) : new Date()),
  );
  const [note, setNote] = useState(count?.note ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<DraftItem[]>(() =>
    rows.map((row) => {
      const existing = existingByIngredient.get(row.ingredient.id);
      return {
        ingredientId: row.ingredient.id,
        name: row.ingredient.name,
        unit: unitLabels[row.ingredient.unit],
        expectedQuantity: existing?.expectedQuantity ?? row.quantity,
        countedQuantity: String(existing?.countedQuantity ?? row.quantity),
        reason: existing?.reason ?? "",
        note: existing?.note ?? "",
      };
    }),
  );

  const visibleItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return keyword
      ? items.filter((item) =>
          item.name.toLocaleLowerCase("vi").includes(keyword),
        )
      : items;
  }, [items, search]);

  function updateItem(ingredientId: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) =>
        item.ingredientId === ingredientId ? { ...item, ...patch } : item,
      ),
    );
  }

  function copySystemQuantities() {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        countedQuantity: String(item.expectedQuantity),
        reason: "",
        note: "",
      })),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const prepared = items.map((item) => ({
      ...item,
      counted: Number(item.countedQuantity),
    }));
    const invalid = prepared.find(
      (item) => !Number.isFinite(item.counted) || item.counted < 0,
    );
    if (invalid) {
      setError(`Số kiểm đếm của ${invalid.name} không hợp lệ.`);
      return;
    }
    const missingReason = prepared.find(
      (item) =>
        Math.abs(item.counted - item.expectedQuantity) > 0.0005 && !item.reason,
    );
    if (missingReason) {
      setError(`Vui lòng chọn lý do chênh lệch cho ${missingReason.name}.`);
      return;
    }
    setError("");
    onSave({
      branchId: branch.id,
      countedAt: new Date(countedAt).toISOString(),
      note: note.trim() || undefined,
      items: prepared.map((item) => ({
        ingredientId: item.ingredientId,
        countedQuantity: item.counted,
        reason: item.reason || undefined,
        note: item.note.trim() || undefined,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 sm:p-6">
      <form
        onSubmit={submit}
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-4 sm:px-7">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#B96E35]">
              <ClipboardCheck size={22} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-[#2A211D]">
                {count ? `Sửa phiếu ${count.code}` : "Lập phiếu kiểm kê"}
              </h2>
              <p className="mt-1 text-sm text-[#78866B]">
                {branch.code} · {branch.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#81766F] hover:bg-[#F7F2EC]"
          >
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <label className="text-sm font-semibold text-[#4A403A]">
              Thời gian kiểm đếm
              <input
                type="datetime-local"
                required
                value={countedAt}
                onChange={(event) => setCountedAt(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#E4D8CC] px-3 font-normal outline-none focus:border-[#C9894B]"
              />
            </label>
            <label className="text-sm font-semibold text-[#4A403A]">
              Ghi chú chung
              <input
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: Kiểm kê cuối tuần, khu vực quầy pha chế..."
                className="mt-2 h-11 w-full rounded-xl border border-[#E4D8CC] px-4 font-normal outline-none focus:border-[#C9894B]"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9089]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm nguyên liệu..."
                className="h-10 w-full rounded-xl border border-[#E4D8CC] bg-white pl-10 pr-3 text-sm outline-none"
              />
            </label>
            <button
              type="button"
              onClick={copySystemQuantities}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DCCBBB] bg-white px-4 text-sm font-semibold text-[#6B4A36]"
            >
              <RotateCcw size={16} /> Sao chép tồn hệ thống
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#E9E1D8]">
            <table className="w-full min-w-[940px] text-left">
              <thead className="bg-[#4A2C20] text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-3">Nguyên liệu</th>
                  <th className="px-4 py-3">Tồn hệ thống</th>
                  <th className="px-4 py-3">Đếm thực tế</th>
                  <th className="px-4 py-3">Chênh lệch</th>
                  <th className="px-4 py-3">Nguyên nhân</th>
                  <th className="px-4 py-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE6DE]">
                {visibleItems.map((item) => {
                  const counted = Number(item.countedQuantity);
                  const difference = Number.isFinite(counted)
                    ? Math.round((counted - item.expectedQuantity) * 1000) /
                      1000
                    : 0;
                  return (
                    <tr key={item.ingredientId}>
                      <td className="px-4 py-3 font-semibold text-[#2A211D]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6B625C]">
                        {formatQuantity(item.expectedQuantity)} {item.unit}
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex w-36 items-center rounded-xl border border-[#E4D8CC] pr-3">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            required
                            value={item.countedQuantity}
                            onChange={(event) =>
                              updateItem(item.ingredientId, {
                                countedQuantity: event.target.value,
                              })
                            }
                            className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                          />
                          <span className="text-xs text-[#8A817B]">
                            {item.unit}
                          </span>
                        </label>
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold ${difference < 0 ? "text-red-600" : difference > 0 ? "text-emerald-700" : "text-[#9A9089]"}`}
                      >
                        {difference > 0 ? "+" : ""}
                        {formatQuantity(difference)} {item.unit}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={item.reason}
                          onChange={(event) =>
                            updateItem(item.ingredientId, {
                              reason: event.target
                                .value as InventoryVarianceReason,
                            })
                          }
                          disabled={Math.abs(difference) <= 0.0005}
                          className="h-10 w-48 rounded-xl border border-[#E4D8CC] bg-white px-3 text-sm outline-none disabled:bg-[#F5F2EF] disabled:text-[#AAA19B]"
                        >
                          <option value="">Chọn nguyên nhân</option>
                          {Object.entries(varianceReasonLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={item.note}
                          maxLength={255}
                          onChange={(event) =>
                            updateItem(item.ingredientId, {
                              note: event.target.value,
                            })
                          }
                          placeholder="Chi tiết nếu có"
                          className="h-10 w-56 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-[#E9E1D8] px-5 py-4 sm:px-7">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-[#DCCBBB] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
          >
            Hủy
          </button>
          <button
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={17} /> {saving ? "Đang lưu..." : "Lưu bản nháp"}
          </button>
        </footer>
      </form>
    </div>
  );
}
