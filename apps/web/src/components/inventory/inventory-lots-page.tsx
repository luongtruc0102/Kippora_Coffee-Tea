"use client";

import { AlertTriangle, Boxes, CalendarClock, Eye, PackageX, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAppToast } from "@/components/ui/app-toast-provider";
import { disposeInventoryLot, getInventoryLot, getInventoryLots } from "@/services/inventory.service";
import type { InventoryLot, InventoryLotDetail, InventoryLotList, InventoryLotStatus, InventoryVarianceReason } from "@/types/inventory";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };
const units = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;
const reasons: Array<{ value: InventoryVarianceReason; label: string }> = [
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "SPOILAGE", label: "Hư hỏng" },
  { value: "BREAKAGE", label: "Vỡ / đổ" },
  { value: "LOSS", label: "Thất thoát" },
  { value: "OTHER", label: "Khác" },
];

function number(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
}
function currency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Không có hạn";
}
function expiryCopy(lot: InventoryLot) {
  if (lot.expiryState === "EXPIRED") return { text: `Quá hạn ${Math.abs(lot.daysToExpiry ?? 0)} ngày`, cls: "bg-red-50 text-red-700" };
  if (lot.expiryState === "EXPIRING") return { text: lot.daysToExpiry === 0 ? "Hết hạn hôm nay" : `Còn ${lot.daysToExpiry} ngày`, cls: "bg-amber-50 text-amber-700" };
  if (lot.expiryState === "NO_EXPIRY") return { text: "Không có hạn", cls: "bg-slate-100 text-slate-600" };
  return { text: `Còn ${lot.daysToExpiry} ngày`, cls: "bg-emerald-50 text-emerald-700" };
}

export default function InventoryLotsPage({ mode }: Props) {
  const { showToast } = useAppToast();
  const [data, setData] = useState<InventoryLotList | null>(null);
  const [branchId, setBranchId] = useState<number>();
  const [status, setStatus] = useState<InventoryLotStatus | "ALL">("ACTIVE");
  const [expiry, setExpiry] = useState<"ALL" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY">("ALL");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<InventoryLotDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [disposing, setDisposing] = useState<InventoryLot | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<InventoryVarianceReason>("EXPIRED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setLoading(true); setError("");
      const result = await getInventoryLots(token, { branchId, status, expiry, q: keyword }, signal);
      setData(result); setBranchId(result.selectedBranch.id);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách lô.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [branchId, expiry, keyword, status]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function openDetail(lot: InventoryLot) {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try { setDetailLoading(true); setDetail(await getInventoryLot(token, lot.id)); }
    catch (detailError) { showToast(detailError instanceof Error ? detailError.message : "Không thể tải chi tiết lô", "error"); }
    finally { setDetailLoading(false); }
  }

  function openDispose(lot: InventoryLot) {
    setDisposing(lot); setQuantity(String(lot.availableQuantity)); setReason(lot.expiryState === "EXPIRED" ? "EXPIRED" : "SPOILAGE"); setNote(""); setActionError("");
  }

  async function submitDisposal(event: React.FormEvent) {
    event.preventDefault();
    if (!disposing) return;
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > disposing.availableQuantity + 0.0005) {
      setActionError("Số lượng hủy phải lớn hơn 0 và không vượt lượng có thể dùng của lô."); return;
    }
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setSaving(true); setActionError("");
      await disposeInventoryLot(token, disposing.id, { quantity: parsed, reason, note: note.trim() || undefined });
      setDisposing(null); showToast("Đã ghi nhận hủy lô và trừ tồn kho.", "success"); await load();
    } catch (saveError) { setActionError(saveError instanceof Error ? saveError.message : "Không thể hủy lô."); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] px-4 py-6 text-[#2A211D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[.18em] text-[#C97932]">Kho hàng · FEFO</p><h1 className="mt-1 text-3xl font-bold">Lô & hạn sử dụng</h1><p className="mt-2 text-sm text-[#78866B]">Lô gần hết hạn được giữ và xuất trước; lô hết hạn không được dùng cho đơn mới.</p></div>
        </header>

        {data && <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            ["Lô đang còn hàng", data.summary.active, Boxes, "text-emerald-700 bg-emerald-50"],
            ["Sắp hết hạn", data.summary.expiring, CalendarClock, "text-amber-700 bg-amber-50"],
            ["Đã hết hạn", data.summary.expired, AlertTriangle, "text-red-700 bg-red-50"],
            ["Giá trị tồn theo lô", currency(data.summary.inventoryValue), Boxes, "text-blue-700 bg-blue-50"],
          ] as const).map(([label, value, Icon, cls]) => <article key={String(label)} className="rounded-2xl border border-[#E9E1D8] bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-[#78866B]">{String(label)}</p><p className="mt-2 text-xl font-bold">{String(value)}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${cls}`}><Icon size={20} /></span></div></article>)}
        </section>}

        <section className="mt-5 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
          <form onSubmit={(event) => { event.preventDefault(); setKeyword(search); }} className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_190px_190px_190px]">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E4D8CC] px-3"><Search size={17} className="text-[#8A817B]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã lô hoặc nguyên liệu..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            {mode === "ADMIN" && <select value={branchId ?? ""} onChange={(event) => setBranchId(Number(event.target.value))} className="h-11 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none">{data?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</select>}
            <select value={status} onChange={(event) => setStatus(event.target.value as InventoryLotStatus | "ALL")} className="h-11 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none"><option value="ACTIVE">Đang còn hàng</option><option value="ALL">Tất cả trạng thái</option><option value="DEPLETED">Đã dùng hết</option><option value="DISPOSED">Đã hủy hết</option></select>
            <select value={expiry} onChange={(event) => setExpiry(event.target.value as typeof expiry)} className="h-11 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none"><option value="ALL">Tất cả hạn dùng</option><option value="EXPIRING">Sắp hết hạn trong 7 ngày</option><option value="EXPIRED">Đã hết hạn</option><option value="NO_EXPIRY">Không có hạn dùng</option></select>
          </form>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
          {error ? <p className="p-6 text-red-700">{error}</p> : loading ? <p className="p-10 text-center text-[#78866B]">Đang tải các lô nguyên liệu...</p> : !data?.lots.length ? <p className="p-12 text-center text-[#8A817B]">Chưa có lô phù hợp với bộ lọc.</p> : <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-[#FCFAF8] text-xs uppercase text-[#78866B]"><tr><th className="px-5 py-4">Lô / nguyên liệu</th><th className="px-4 py-4">Ngày nhập</th><th className="px-4 py-4">Hạn dùng</th><th className="px-4 py-4">Tồn / đang giữ</th><th className="px-4 py-4">Có thể dùng</th><th className="px-4 py-4">Giá vốn</th><th className="px-5 py-4 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-[#EEE6DE]">{data.lots.map((lot) => { const expiryInfo = expiryCopy(lot); return <tr key={lot.id} className={lot.expiryState === "EXPIRED" ? "bg-red-50/30" : ""}><td className="px-5 py-4"><p className="font-bold">{lot.ingredient.name}</p><p className="mt-1 text-xs text-[#78866B]">{lot.code}{lot.batchCode ? ` · NCC: ${lot.batchCode}` : ""}</p></td><td className="px-4 py-4">{date(lot.receivedAt)}</td><td className="px-4 py-4"><p>{date(lot.expiresAt)}</p><span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${expiryInfo.cls}`}>{expiryInfo.text}</span></td><td className="px-4 py-4"><b>{number(lot.quantity)}</b> / {number(lot.reservedQuantity)} {units[lot.ingredient.unit]}</td><td className="px-4 py-4 font-bold text-emerald-700">{number(lot.availableQuantity)} {units[lot.ingredient.unit]}</td><td className="px-4 py-4"><p>{currency(lot.unitCost)} / {units[lot.ingredient.unit]}</p><p className="mt-1 text-xs text-[#78866B]">Tổng {currency(lot.inventoryValue)}</p></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => void openDetail(lot)} disabled={detailLoading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DCCFC3] px-3 font-semibold"><Eye size={16} /> Chi tiết</button><button onClick={() => openDispose(lot)} disabled={lot.availableQuantity <= 0} className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-50 px-3 font-semibold text-red-700 disabled:opacity-40"><PackageX size={16} /> Hủy lô</button></div></td></tr>; })}</tbody></table></div>}
        </section>
      </div>

      {detail && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="sticky top-0 flex items-start justify-between border-b border-[#E9E1D8] bg-white px-6 py-5"><div><h2 className="text-xl font-bold">{detail.ingredient.name} · {detail.code}</h2><p className="mt-1 text-sm text-[#78866B]">Mã NCC: {detail.batchCode || "Không có"} · Phiếu: {detail.stockReceiptItem?.receipt.code || "Tồn đầu kỳ"}</p></div><button onClick={() => setDetail(null)}><X size={20} /></button></header><div className="space-y-5 p-6"><div className="grid gap-3 sm:grid-cols-3"><Info label="Ngày sản xuất" value={date(detail.manufacturedAt)} /><Info label="Hạn dùng" value={date(detail.expiresAt)} /><Info label="Ngày nhận" value={date(detail.receivedAt)} /><Info label="Số lượng ban đầu" value={`${number(detail.initialQuantity)} ${units[detail.ingredient.unit]}`} /><Info label="Còn lại" value={`${number(detail.quantity)} ${units[detail.ingredient.unit]}`} /><Info label="Giá trị còn lại" value={currency(detail.inventoryValue)} /></div><History title="Đơn hàng đã dùng / đang giữ" empty="Lô này chưa được dùng cho đơn hàng.">{detail.allocations.map((item) => <div key={item.id} className="flex justify-between gap-4 border-t border-[#EEE6DE] py-3 first:border-0"><span>Đơn #{item.order.id} · {item.state}</span><b>{number(item.quantity)} {units[detail.ingredient.unit]} · {currency(item.costAmount)}</b></div>)}</History><History title="Lịch sử hủy lô" empty="Chưa có lượng nào bị hủy.">{detail.disposals.map((item) => <div key={item.id} className="flex justify-between gap-4 border-t border-[#EEE6DE] py-3 first:border-0"><span>{date(item.createdAt)} · {reasons.find((reason) => reason.value === item.reason)?.label}{item.note ? ` · ${item.note}` : ""}</span><b className="text-red-700">-{number(item.quantity)} {units[detail.ingredient.unit]}</b></div>)}</History></div></section></div>}

      {disposing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><form onSubmit={submitDisposal} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5"><div><h2 className="text-xl font-bold">Ghi nhận hủy lô</h2><p className="mt-1 text-sm text-[#78866B]">{disposing.ingredient.name} · {disposing.code}</p></div><button type="button" onClick={() => setDisposing(null)}><X size={20} /></button></header><div className="space-y-4 p-6"><p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Thao tác sẽ trừ tồn kho và ghi nhật ký, không thể hoàn tác trực tiếp.</p><label className="block text-sm font-semibold">Số lượng hủy *<input required type="number" min="0.001" max={disposing.availableQuantity} step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#E4D8CC] px-3 outline-none" /></label><label className="block text-sm font-semibold">Lý do *<select value={reason} onChange={(event) => setReason(event.target.value as InventoryVarianceReason)} className="mt-2 h-11 w-full rounded-xl border border-[#E4D8CC] px-3 outline-none">{reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block text-sm font-semibold">Ghi chú<textarea rows={3} maxLength={255} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-[#E4D8CC] p-3 outline-none" /></label>{actionError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}</div><footer className="flex justify-end gap-2 border-t border-[#E9E1D8] px-6 py-4"><button type="button" onClick={() => setDisposing(null)} className="h-11 rounded-xl border border-[#DCCFC3] px-5 font-semibold">Đóng</button><button disabled={saving} className="h-11 rounded-xl bg-red-700 px-5 font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Xác nhận hủy lô"}</button></footer></form></div>}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#E9E1D8] p-4"><p className="text-xs uppercase text-[#78866B]">{label}</p><p className="mt-2 font-bold">{value}</p></div>; }
function History({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#E9E1D8] p-4"><h3 className="font-bold">{title}</h3><div className="mt-2 text-sm">{Array.isArray(children) && children.length === 0 ? <p className="py-3 text-[#8A817B]">{empty}</p> : children}</div></section>; }
