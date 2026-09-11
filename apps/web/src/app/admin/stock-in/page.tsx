"use client";

import {
  CalendarDays,
  CheckCircle2,
  CircleX,
  Clock3,
  Eye,
  FilePlus2,
  PackageCheck,
  Pencil,
  Search,
  Truck,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import StockReceiptDetailModal from "@/components/admin/stock-receipt-detail-modal";
import StockReceiptFormModal from "@/components/admin/stock-receipt-form-modal";
import { useAppToast } from "@/components/ui/app-toast-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  cancelStockReceipt,
  completeStockReceipt,
  createStockReceipt,
  getInventoryRecipes,
  getStockReceipts,
  getSuppliers,
  updateStockReceipt,
} from "@/services/inventory.service";
import type {
  Ingredient,
  StockReceipt,
  StockReceiptInput,
  StockReceiptList,
  StockReceiptStatus,
  Supplier,
} from "@/types/inventory";

const statusLabels = {
  DRAFT: "Phiếu nháp",
  COMPLETED: "Đã nhập kho",
  CANCELLED: "Đã hủy",
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

export default function AdminStockInPage() {
  const { showToast } = useAppToast();
  const [data, setData] = useState<StockReceiptList | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedBranchId, setSelectedBranchId] = useState<number>();
  const [status, setStatus] = useState<StockReceiptStatus | "ALL">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockReceipt | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<StockReceipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setError("");
        const [receiptData, supplierData, recipeData] = await Promise.all([
          getStockReceipts(
            accessToken,
            {
              branchId: selectedBranchId,
              status,
              from: from || undefined,
              to: to || undefined,
              q: debouncedSearch,
            },
            signal,
          ),
          getSuppliers(accessToken, { status: "ACTIVE" }, signal),
          getInventoryRecipes(accessToken, signal),
        ]);
        setData(receiptData);
        setSuppliers(supplierData);
        setIngredients(recipeData.ingredients);
        setSelectedBranchId(receiptData.selectedBranch.id);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải phiếu nhập kho",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [debouncedSearch, from, selectedBranchId, status, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  function openCreate() {
    if (!suppliers.length) {
      showToast("Cần có ít nhất một nhà cung cấp đang hoạt động", "error");
      return;
    }
    if (!ingredients.length) {
      showToast("Cần thêm nguyên liệu trước khi lập phiếu", "error");
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(receipt: StockReceipt) {
    setSelectedReceipt(null);
    setEditing(receipt);
    setFormError("");
    setFormOpen(true);
  }

  async function saveReceipt(input: StockReceiptInput) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      setFormError("");
      const receipt = editing
        ? await updateStockReceipt(accessToken, editing.id, input)
        : await createStockReceipt(accessToken, input);
      setFormOpen(false);
      setEditing(null);
      setSelectedReceipt(receipt);
      showToast(
        editing ? "Đã cập nhật phiếu nháp" : "Đã tạo phiếu nhập nháp",
        "success",
      );
      await load();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu phiếu nhập",
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeReceipt(receipt: StockReceipt) {
    if (!window.confirm(`Xác nhận cộng toàn bộ nguyên liệu của ${receipt.code} vào kho?`)) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setProcessing(true);
      const updated = await completeStockReceipt(accessToken, receipt.id);
      setSelectedReceipt(updated);
      showToast("Đã nhập nguyên liệu vào kho", "success");
      await load();
    } catch (completeError) {
      showToast(
        completeError instanceof Error
          ? completeError.message
          : "Không thể xác nhận nhập kho",
        "error",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function cancelReceipt(receipt: StockReceipt) {
    if (!window.confirm(`Hủy phiếu nháp ${receipt.code}?`)) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setProcessing(true);
      const updated = await cancelStockReceipt(accessToken, receipt.id);
      setSelectedReceipt(updated);
      showToast("Đã hủy phiếu nhập", "success");
      await load();
    } catch (cancelError) {
      showToast(
        cancelError instanceof Error
          ? cancelError.message
          : "Không thể hủy phiếu nhập",
        "error",
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">Kho hàng</p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">Phiếu nhập kho</h1>
          <p className="mt-2 text-sm text-[#78866B]">Lập phiếu theo chi nhánh và chỉ cộng tồn khi đã xác nhận.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white"><FilePlus2 size={18} /> Tạo phiếu nhập</button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={PackageCheck} label="Tổng phiếu" value={String(data?.summary.total ?? 0)} tone="brown" />
        <SummaryCard icon={Clock3} label="Phiếu nháp" value={String(data?.summary.draft ?? 0)} tone="amber" />
        <SummaryCard icon={CheckCircle2} label="Đã nhập kho" value={String(data?.summary.completed ?? 0)} tone="green" />
        <SummaryCard icon={WalletCards} label="Giá trị đã nhập" value={currency(data?.summary.totalCost ?? 0)} tone="orange" />
      </section>

      <section className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_230px_180px_170px_170px]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[#E4D8CC] px-4"><Search size={18} className="text-[#8A817B]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã phiếu hoặc nhà cung cấp..." className="w-full bg-transparent text-sm outline-none" /></label>
          <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(Number(event.target.value))} className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none">{data?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value as StockReceiptStatus | "ALL")} className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none"><option value="ALL">Tất cả trạng thái</option><option value="DRAFT">Phiếu nháp</option><option value="COMPLETED">Đã nhập kho</option><option value="CANCELLED">Đã hủy</option></select>
          <label className="relative"><CalendarDays size={16} className="pointer-events-none absolute left-3 top-3.5 text-[#8A817B]" /><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-11 w-full rounded-xl border border-[#E4D8CC] pl-10 pr-3 text-sm outline-none" title="Từ ngày" /></label>
          <label className="relative"><CalendarDays size={16} className="pointer-events-none absolute left-3 top-3.5 text-[#8A817B]" /><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-11 w-full rounded-xl border border-[#E4D8CC] pl-10 pr-3 text-sm outline-none" title="Đến ngày" /></label>
        </div>
        {(from || to) && <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="mt-3 text-xs font-semibold text-[#C2763D]">Xóa lọc ngày</button>}
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left">
            <thead className="border-b border-[#E9E1D8] bg-[#FCFAF8] text-xs uppercase tracking-wide text-[#78866B]"><tr><th className="px-5 py-4">Mã phiếu</th><th className="px-4 py-4">Nhà cung cấp</th><th className="px-4 py-4">Nguyên liệu</th><th className="px-4 py-4">Tổng tiền</th><th className="px-4 py-4">Ngày lập / nhập</th><th className="px-4 py-4">Người lập</th><th className="px-4 py-4">Trạng thái</th><th className="px-5 py-4 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-[#F0E8E0]">
              {loading ? <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-[#8A817B]">Đang tải phiếu nhập...</td></tr> : !data?.receipts.length ? <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-[#8A817B]">Chưa có phiếu nhập phù hợp.</td></tr> : data.receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="px-5 py-4"><p className="font-bold text-[#4A2C20]">{receipt.code}</p><span className="text-xs text-[#8A817B]">{receipt.branch.code}</span></td>
                  <td className="px-4 py-4"><p className="font-semibold text-[#2A211D]">{receipt.supplier.name}</p><span className="text-xs text-[#8A817B]">{receipt.supplier.code}</span></td>
                  <td className="px-4 py-4"><p className="font-semibold text-[#2A211D]">{receipt.items.length} loại</p><span className="block max-w-48 truncate text-xs text-[#8A817B]">{receipt.items.map((item) => item.ingredient.name).join(", ")}</span></td>
                  <td className="px-4 py-4 font-semibold text-[#4A2C20]">{currency(receipt.totalCost)}</td>
                  <td className="px-4 py-4 text-sm text-[#5E5650]"><p>{dateTime(receipt.createdAt)}</p><span className="text-xs text-[#8A817B]">{receipt.receivedAt ? `Nhập: ${dateTime(receipt.receivedAt)}` : "Chưa nhập kho"}</span></td>
                  <td className="px-4 py-4 text-sm text-[#5E5650]">{receipt.createdBy.fullName || receipt.createdBy.email}</td>
                  <td className="px-4 py-4"><StatusBadge status={receipt.status} /></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelectedReceipt(receipt)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F7F0] text-[#637458]" title="Xem chi tiết"><Eye size={16} /></button>{receipt.status === "DRAFT" && <><button type="button" onClick={() => openEdit(receipt)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF5E9] text-[#C2763D]" title="Chỉnh sửa"><Pencil size={16} /></button><button type="button" disabled={processing} onClick={() => void completeReceipt(receipt)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700" title="Xác nhận nhập kho"><CheckCircle2 size={17} /></button></>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && data && <StockReceiptFormModal branches={data.branches} suppliers={suppliers} ingredients={ingredients} initialBranchId={selectedBranchId ?? data.selectedBranch.id} receipt={editing} saving={saving} error={formError} onClose={() => !saving && setFormOpen(false)} onSave={(input) => void saveReceipt(input)} />}
      {selectedReceipt && <StockReceiptDetailModal receipt={selectedReceipt} busy={processing} onClose={() => !processing && setSelectedReceipt(null)} onEdit={() => openEdit(selectedReceipt)} onComplete={() => void completeReceipt(selectedReceipt)} onCancel={() => void cancelReceipt(selectedReceipt)} />}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Truck; label: string; value: string; tone: "brown" | "amber" | "green" | "orange" }) {
  const colors = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "orange" ? "bg-[#FFF5E9] text-[#C2763D]" : "bg-[#F3E9DE] text-[#4A2C20]";
  return <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors}`}><Icon size={20} /></span><p className="mt-4 text-sm text-[#78866B]">{label}</p><strong className="mt-1 block text-2xl text-[#2A211D]">{value}</strong></div>;
}

function StatusBadge({ status }: { status: StockReceiptStatus }) {
  const classes = status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : status === "CANCELLED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700";
  const Icon = status === "COMPLETED" ? CheckCircle2 : status === "CANCELLED" ? CircleX : Clock3;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${classes}`}><Icon size={14} />{statusLabels[status]}</span>;
}
