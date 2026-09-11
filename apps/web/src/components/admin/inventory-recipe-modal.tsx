"use client";

import { Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Ingredient, RecipeIngredient } from "@/types/inventory";

type RecipeDraft = { ingredientId: number; quantity: string };

type Props = {
  title: string;
  ingredients: Ingredient[];
  initialItems: RecipeIngredient[];
  saving: boolean;
  onClose: () => void;
  onSave: (items: Array<{ ingredientId: number; quantity: number }>) => void;
};

const unitLabels = {
  GRAM: "g",
  MILLILITER: "ml",
  PIECE: "cái",
} as const;

export default function InventoryRecipeModal({
  title,
  ingredients,
  initialItems,
  saving,
  onClose,
  onSave,
}: Props) {
  const [items, setItems] = useState<RecipeDraft[]>(
    initialItems.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: String(item.quantity),
    })),
  );
  const usedIds = useMemo(
    () => new Set(items.map((item) => item.ingredientId)),
    [items],
  );

  function addItem() {
    const ingredient = ingredients.find((item) => !usedIds.has(item.id));
    if (!ingredient) return;
    setItems((current) => [
      ...current,
      { ingredientId: ingredient.id, quantity: "" },
    ]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = items.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: Number(item.quantity),
    }));
    if (parsed.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      return;
    }
    onSave(parsed);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#2A211D]">{title}</h2>
            <p className="mt-1 text-sm text-[#78866B]">
              Định lượng dưới đây được tính cho một sản phẩm.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8A817B]">
            <X size={21} />
          </button>
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D9CABE] px-5 py-10 text-center text-sm text-[#8A817B]">
              Chưa có nguyên liệu trong công thức.
            </div>
          ) : (
            items.map((item, index) => {
              const ingredient = ingredients.find(
                (candidate) => candidate.id === item.ingredientId,
              );
              return (
                <div key={`${item.ingredientId}-${index}`} className="grid grid-cols-[1fr_150px_40px] gap-2">
                  <select
                    value={item.ingredientId}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, ingredientId: Number(event.target.value) }
                            : row,
                        ),
                      )
                    }
                    className="rounded-xl border border-[#E4D8CC] px-3 py-2.5 text-sm outline-none focus:border-[#C9894B]"
                  >
                    {ingredients.map((option) => (
                      <option
                        key={option.id}
                        value={option.id}
                        disabled={usedIds.has(option.id) && option.id !== item.ingredientId}
                      >
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center rounded-xl border border-[#E4D8CC] pr-3 focus-within:border-[#C9894B]">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      value={item.quantity}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, quantity: event.target.value }
                              : row,
                          ),
                        )
                      }
                      placeholder="Định lượng"
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                    />
                    <span className="text-xs text-[#8A817B]">
                      {ingredient ? unitLabels[ingredient.unit] : ""}
                    </span>
                  </label>
                  <button
                    type="button"
                    aria-label="Xóa nguyên liệu"
                    onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                    className="flex items-center justify-center rounded-xl bg-red-50 text-red-500"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })
          )}

          <button
            type="button"
            disabled={items.length >= ingredients.length}
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#6B4A36] disabled:opacity-40"
          >
            <Plus size={16} /> Thêm nguyên liệu
          </button>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E9E1D8] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold text-[#5E5650]">
            Hủy
          </button>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Save size={16} /> {saving ? "Đang lưu..." : "Lưu công thức"}
          </button>
        </div>
      </form>
    </div>
  );
}
