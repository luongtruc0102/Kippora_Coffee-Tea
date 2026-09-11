"use client";

import {
  AlertTriangle,
  Boxes,
  ChefHat,
  History,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import InventoryRecipeModal from "@/components/admin/inventory-recipe-modal";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  createIngredient,
  getInventoryOverview,
  getInventoryRecipes,
  updateInventoryRecipe,
  updateInventoryMinimumLevel,
} from "@/services/inventory.service";
import type {
  IngredientUnit,
  InventoryOverview,
  RecipeIngredient,
  RecipeOverview,
} from "@/types/inventory";

type Tab = "stock" | "recipes";
type StockDraft = { minimumLevel: string };
type RecipeTarget = {
  kind: "variant" | "topping";
  id: number;
  title: string;
  items: RecipeIngredient[];
};

const unitLabels: Record<IngredientUnit, string> = {
  GRAM: "g",
  MILLILITER: "ml",
  PIECE: "cái",
};

const movementLabels = {
  ADJUST: "Điều chỉnh",
  RECEIVE: "Nhập kho",
  RESERVE: "Giữ cho đơn",
  RELEASE: "Hoàn giữ",
  CONSUME: "Đã sử dụng",
} as const;

function number(value: number | string) {
  return Number(value);
}

function formatQuantity(value: number | string, unit: IngredientUnit) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(number(value))} ${unitLabels[unit]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminInventoryPage() {
  const { showToast } = useAppToast();
  const [tab, setTab] = useState<Tab>("stock");
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [recipes, setRecipes] = useState<RecipeOverview | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number>();
  const [drafts, setDrafts] = useState<Record<number, StockDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientUnit, setIngredientUnit] = useState<IngredientUnit>("GRAM");
  const [creatingIngredient, setCreatingIngredient] = useState(false);
  const [recipeTarget, setRecipeTarget] = useState<RecipeTarget | null>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const syncDrafts = useCallback((data: InventoryOverview) => {
    setDrafts(
      Object.fromEntries(
        data.rows.map((row) => [
          row.ingredient.id,
          {
            minimumLevel: String(row.minimumLevel),
          },
        ]),
      ),
    );
  }, []);

  const load = useCallback(
    async (branchId?: number, signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setError("");
        const [inventoryData, recipeData] = await Promise.all([
          getInventoryOverview(accessToken, branchId, signal),
          getInventoryRecipes(accessToken, signal),
        ]);
        setOverview(inventoryData);
        setRecipes(recipeData);
        setSelectedBranchId(inventoryData.selectedBranch.id);
        syncDrafts(inventoryData);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu kho");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [syncDrafts],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void load(undefined, controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  const reservedKinds = useMemo(
    () => overview?.rows.filter((row) => row.reservedQuantity > 0).length ?? 0,
    [overview],
  );

  async function changeBranch(branchId: number) {
    setSelectedBranchId(branchId);
    await load(branchId);
  }

  async function saveMinimumLevel(ingredientId: number) {
    if (!overview) return;
    const draft = drafts[ingredientId];
    const minimumLevel = Number(draft?.minimumLevel);
    if (!Number.isFinite(minimumLevel) || minimumLevel < 0) {
      showToast("Mức cảnh báo phải là số không âm", "error");
      return;
    }
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSavingId(ingredientId);
      await updateInventoryMinimumLevel(accessToken, {
        branchId: overview.selectedBranch.id,
        ingredientId,
        minimumLevel,
      });
      showToast("Đã cập nhật mức cảnh báo", "success");
      await load(overview.selectedBranch.id);
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : "Không thể cập nhật mức cảnh báo", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function addIngredient(event: React.FormEvent) {
    event.preventDefault();
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken || !ingredientName.trim()) return;
    try {
      setCreatingIngredient(true);
      await createIngredient(accessToken, {
        name: ingredientName.trim(),
        unit: ingredientUnit,
      });
      setIngredientName("");
      showToast("Đã thêm nguyên liệu", "success");
      await load(selectedBranchId);
    } catch (createError) {
      showToast(createError instanceof Error ? createError.message : "Không thể thêm nguyên liệu", "error");
    } finally {
      setCreatingIngredient(false);
    }
  }

  async function saveRecipe(items: Array<{ ingredientId: number; quantity: number }>) {
    if (!recipeTarget) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSavingRecipe(true);
      await updateInventoryRecipe(accessToken, recipeTarget, items);
      const next = await getInventoryRecipes(accessToken);
      setRecipes(next);
      setRecipeTarget(null);
      showToast("Đã lưu công thức", "success");
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : "Không thể lưu công thức", "error");
    } finally {
      setSavingRecipe(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">Kho hàng</p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">Tồn kho & công thức</h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Theo dõi nguyên liệu theo chi nhánh và định lượng cho từng size món.
          </p>
        </div>
        <div className="flex gap-2">
          {overview && (
            <select
              value={selectedBranchId}
              onChange={(event) => void changeBranch(Number(event.target.value))}
              className="min-w-56 rounded-xl border border-[#E4D8CC] bg-white px-4 py-2.5 text-sm font-semibold text-[#4A2C20] outline-none"
            >
              {overview.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
              ))}
            </select>
          )}
          <Link
            href="/admin/stock-in"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white transition hover:bg-[#382118]"
          >
            <PackagePlus size={17} /> Nhập kho
          </Link>
          <button
            type="button"
            onClick={() => void load(selectedBranchId)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4D8CC] bg-white text-[#6B4A36]"
            title="Làm mới"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#C2763D]"><Boxes size={20} /></span>
          <p className="mt-4 text-sm text-[#78866B]">Nguyên liệu</p>
          <strong className="mt-1 block text-2xl text-[#2A211D]">{overview?.rows.length ?? 0}</strong>
        </div>
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500"><AlertTriangle size={20} /></span>
          <p className="mt-4 text-sm text-[#78866B]">Đang chạm mức cảnh báo</p>
          <strong className="mt-1 block text-2xl text-red-600">{overview?.lowStockCount ?? 0}</strong>
        </div>
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Warehouse size={20} /></span>
          <p className="mt-4 text-sm text-[#78866B]">Loại đang giữ cho đơn</p>
          <strong className="mt-1 block text-2xl text-[#2A211D]">{reservedKinds}</strong>
        </div>
      </section>

      <div className="inline-flex rounded-2xl border border-[#E9E1D8] bg-white p-1 shadow-sm">
        <button onClick={() => setTab("stock")} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === "stock" ? "bg-[#4A2C20] text-white" : "text-[#6B625C]"}`}>
          <Warehouse size={17} /> Tồn kho
        </button>
        <button onClick={() => setTab("recipes")} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${tab === "recipes" ? "bg-[#4A2C20] text-white" : "text-[#6B625C]"}`}>
          <ChefHat size={17} /> Công thức món
        </button>
      </div>

      {loading && !overview ? (
        <div className="rounded-2xl border border-[#E9E1D8] bg-white py-20 text-center text-sm text-[#8A817B]">Đang tải dữ liệu kho...</div>
      ) : tab === "stock" ? (
        <>
          <form onSubmit={addIngredient} className="flex flex-col gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#C2763D]"><PackagePlus size={20} /></span>
            <input value={ingredientName} onChange={(event) => setIngredientName(event.target.value)} required minLength={2} placeholder="Tên nguyên liệu mới..." className="h-11 flex-1 rounded-xl border border-[#E4D8CC] px-4 text-sm outline-none focus:border-[#C9894B]" />
            <select value={ingredientUnit} onChange={(event) => setIngredientUnit(event.target.value as IngredientUnit)} className="h-11 rounded-xl border border-[#E4D8CC] px-4 text-sm outline-none">
              <option value="GRAM">Gram (g)</option>
              <option value="MILLILITER">Mililit (ml)</option>
              <option value="PIECE">Đơn vị/cái</option>
            </select>
            <button disabled={creatingIngredient} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white disabled:opacity-60"><Plus size={17} /> Thêm nguyên liệu</button>
          </form>

          <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-[#E9E1D8] bg-[#FFF9F2] px-5 py-4 text-sm text-[#7B4B2A]">
              <Warehouse size={18} className="mt-0.5 shrink-0" />
              <p><strong>Tồn kho không thể sửa trực tiếp.</strong> Số lượng chỉ tăng khi hoàn tất phiếu nhập kho và giảm khi nguyên liệu được sử dụng cho đơn.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className="border-b border-[#E9E1D8] bg-[#FCFAF8] text-xs uppercase tracking-wide text-[#78866B]">
                  <tr><th className="px-5 py-4">Nguyên liệu</th><th className="px-4 py-4">Tồn kho</th><th className="px-4 py-4">Đã giữ cho đơn</th><th className="px-4 py-4">Có thể dùng</th><th className="px-4 py-4">Cảnh báo khi còn</th><th className="px-5 py-4 text-right">Thao tác</th></tr>
                </thead>
                <tbody className="divide-y divide-[#F0E8E0]">
                  {overview?.rows.map((row) => {
                    const draft = drafts[row.ingredient.id] ?? { minimumLevel: "0" };
                    return (
                      <tr key={row.ingredient.id} className={row.isLow ? "bg-red-50/35" : ""}>
                        <td className="px-5 py-4"><p className="font-semibold text-[#2A211D]">{row.ingredient.name}</p><span className="text-xs text-[#8A817B]">Đơn vị: {unitLabels[row.ingredient.unit]}</span></td>
                        <td className="px-4 py-4"><span title="Chỉ thay đổi qua nhập kho và sử dụng nguyên liệu" className="inline-flex min-w-28 items-center rounded-xl bg-[#F3F0ED] px-3 py-2 text-sm font-semibold text-[#3B332E]">{formatQuantity(row.quantity, row.ingredient.unit)}</span></td>
                        <td className="px-4 py-4 font-medium text-amber-700">{formatQuantity(row.reservedQuantity, row.ingredient.unit)}</td>
                        <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${!row.isConfigured ? "bg-slate-100 text-slate-600" : row.isLow ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{row.isConfigured ? formatQuantity(row.availableQuantity, row.ingredient.unit) : "Chưa thiết lập"}</span></td>
                        <td className="px-4 py-4"><label className="flex w-36 items-center rounded-xl border border-[#E4D8CC] bg-white pr-3"><input type="number" min="0" step="0.001" value={draft.minimumLevel} onChange={(event) => setDrafts((current) => ({ ...current, [row.ingredient.id]: { ...draft, minimumLevel: event.target.value } }))} className="w-full bg-transparent px-3 py-2 text-sm outline-none" /><span className="text-xs text-[#8A817B]">{unitLabels[row.ingredient.unit]}</span></label></td>
                        <td className="px-5 py-4 text-right"><button type="button" disabled={savingId !== null} onClick={() => void saveMinimumLevel(row.ingredient.id)} className="inline-flex items-center gap-2 rounded-xl bg-[#F3E9DE] px-4 py-2 text-sm font-semibold text-[#7B4B2A] disabled:opacity-50"><Save size={16} /> {savingId === row.ingredient.id ? "Đang lưu" : "Lưu cảnh báo"}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><History size={19} className="text-[#C2763D]" /><h2 className="text-lg font-bold text-[#2A211D]">Biến động gần đây</h2></div>
            <div className="mt-4 divide-y divide-[#F0E8E0]">
              {overview?.movements.length ? overview.movements.map((movement) => (
                <div key={movement.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_150px_180px] sm:items-center">
                  <div><p className="font-semibold text-[#2A211D]">{movement.ingredient.name}</p><p className="mt-0.5 text-xs text-[#8A817B]">{movement.note || movementLabels[movement.type]} · {movement.actor?.fullName || movement.actor?.email || "Hệ thống"}</p></div>
                  <span className={`font-semibold ${number(movement.quantityDelta) < 0 ? "text-red-600" : number(movement.quantityDelta) > 0 ? "text-emerald-700" : "text-amber-700"}`}>{movementLabels[movement.type]} {number(movement.quantityDelta) !== 0 ? formatQuantity(movement.quantityDelta, movement.ingredient.unit) : ""}</span>
                  <span className="text-xs text-[#8A817B] sm:text-right">{formatDate(movement.createdAt)}</span>
                </div>
              )) : <p className="py-8 text-center text-sm text-[#8A817B]">Chưa có biến động kho.</p>}
            </div>
          </section>
        </>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <div><h2 className="text-lg font-bold text-[#2A211D]">Công thức sản phẩm</h2><p className="mt-1 text-sm text-[#78866B]">Mỗi size có định lượng riêng cho một ly.</p></div>
            <div className="mt-5 space-y-4">
              {recipes?.products.map((product) => (
                <div key={product.id} className="rounded-2xl border border-[#E9E1D8] p-4">
                  <h3 className="font-bold text-[#2A211D]">{product.name}</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {product.variants.map((variant) => (
                      <button key={variant.id} type="button" onClick={() => setRecipeTarget({ kind: "variant", id: variant.id, title: `${product.name} · Size ${variant.size}`, items: variant.recipeIngredients })} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-4 py-3 text-left transition hover:bg-[#F3E9DE]">
                        <span><strong className="block text-sm text-[#4A2C20]">Size {variant.size}</strong><small className={variant.recipeIngredients.length ? "text-emerald-700" : "text-red-500"}>{variant.recipeIngredients.length ? `${variant.recipeIngredients.length} nguyên liệu` : "Chưa có công thức"}</small></span><Pencil size={16} className="text-[#C2763D]" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <div><h2 className="text-lg font-bold text-[#2A211D]">Công thức topping</h2><p className="mt-1 text-sm text-[#78866B]">Định lượng cộng thêm cho mỗi món.</p></div>
            <div className="mt-5 space-y-2">
              {recipes?.toppings.map((topping) => (
                <button key={topping.id} type="button" onClick={() => setRecipeTarget({ kind: "topping", id: topping.id, title: `Topping · ${topping.name}`, items: topping.recipeIngredients })} className="flex w-full items-center justify-between rounded-xl border border-[#E9E1D8] px-4 py-3 text-left transition hover:bg-[#FAF8F5]">
                  <span><strong className="block text-sm text-[#2A211D]">{topping.name}</strong><small className={topping.recipeIngredients.length ? "text-emerald-700" : "text-red-500"}>{topping.recipeIngredients.length ? `${topping.recipeIngredients.length} nguyên liệu` : "Chưa có công thức"}</small></span><Pencil size={16} className="text-[#C2763D]" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {recipeTarget && recipes && (
        <InventoryRecipeModal title={recipeTarget.title} ingredients={recipes.ingredients} initialItems={recipeTarget.items} saving={savingRecipe} onClose={() => setRecipeTarget(null)} onSave={(items) => void saveRecipe(items)} />
      )}
    </div>
  );
}
