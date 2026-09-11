"use client";

import {
  Building2,
  LockKeyhole,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Truck,
  UnlockKeyhole,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  createSupplier,
  getSuppliers,
  updateSupplier,
  updateSupplierStatus,
} from "@/services/inventory.service";
import type { Supplier, SupplierInput } from "@/types/inventory";

const emptyForm: SupplierInput = {
  code: "",
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  note: "",
};

export default function AdminSuppliersPage() {
  const { showToast } = useAppToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(emptyForm);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setError("");
        setSuppliers(
          await getSuppliers(
            accessToken,
            { q: debouncedSearch, status },
            signal,
          ),
        );
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải nhà cung cấp",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [debouncedSearch, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  const summary = useMemo(
    () => ({
      active: suppliers.filter((item) => item.isActive).length,
      inactive: suppliers.filter((item) => !item.isActive).length,
      receipts: suppliers.reduce(
        (sum, item) => sum + item._count.stockReceipts,
        0,
      ),
    }),
    [suppliers],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      code: supplier.code,
      name: supplier.name,
      contactName: supplier.contactName ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      note: supplier.note ?? "",
    });
    setError("");
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      setError("");
      const normalized = {
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
      };
      if (editing) {
        await updateSupplier(accessToken, editing.id, normalized);
        showToast("Đã cập nhật nhà cung cấp", "success");
      } else {
        await createSupplier(accessToken, normalized);
        showToast("Đã thêm nhà cung cấp", "success");
      }
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu nhà cung cấp",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(supplier: Supplier) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setUpdatingId(supplier.id);
      await updateSupplierStatus(accessToken, supplier.id, !supplier.isActive);
      showToast(
        supplier.isActive
          ? "Đã ngừng hợp tác nhà cung cấp"
          : "Đã kích hoạt nhà cung cấp",
        "success",
      );
      await load();
    } catch (statusError) {
      showToast(
        statusError instanceof Error
          ? statusError.message
          : "Không thể đổi trạng thái",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">
            Kho hàng
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">
            Nhà cung cấp
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Quản lý thông tin liên hệ và lịch sử cung ứng nguyên liệu.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white"
        >
          <Plus size={18} /> Thêm nhà cung cấp
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Truck} label="Đang hợp tác" value={summary.active} tone="green" />
        <SummaryCard icon={Building2} label="Ngừng hợp tác" value={summary.inactive} tone="gray" />
        <SummaryCard icon={Truck} label="Tổng phiếu nhập" value={summary.receipts} tone="orange" />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-[#E4D8CC] px-4">
          <Search size={18} className="text-[#8A817B]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã, tên, người liên hệ hoặc SĐT..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")
          }
          className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hợp tác</option>
          <option value="INACTIVE">Ngừng hợp tác</option>
        </select>
      </section>

      {error && !formOpen && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="border-b border-[#E9E1D8] bg-[#FCFAF8] text-xs uppercase tracking-wide text-[#78866B]">
              <tr>
                <th className="px-5 py-4">Nhà cung cấp</th>
                <th className="px-4 py-4">Người liên hệ</th>
                <th className="px-4 py-4">Liên lạc</th>
                <th className="px-4 py-4">Địa chỉ</th>
                <th className="px-4 py-4">Phiếu nhập</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E8E0]">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-sm text-[#8A817B]">Đang tải nhà cung cấp...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-sm text-[#8A817B]">Chưa có nhà cung cấp phù hợp.</td></tr>
              ) : suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-5 py-4"><p className="font-semibold text-[#2A211D]">{supplier.name}</p><span className="mt-1 inline-flex rounded-md bg-[#F3E9DE] px-2 py-0.5 text-xs font-semibold text-[#8A512C]">{supplier.code}</span></td>
                  <td className="px-4 py-4 text-sm text-[#5E5650]">{supplier.contactName ? <span className="inline-flex items-center gap-2"><UserRound size={15} className="text-[#C2763D]" />{supplier.contactName}</span> : "—"}</td>
                  <td className="px-4 py-4 text-sm text-[#5E5650]"><div className="space-y-1">{supplier.phone && <a href={`tel:${supplier.phone}`} className="flex items-center gap-2"><Phone size={14} />{supplier.phone}</a>}{supplier.email && <a href={`mailto:${supplier.email}`} className="flex items-center gap-2"><Mail size={14} />{supplier.email}</a>}{!supplier.phone && !supplier.email && "—"}</div></td>
                  <td className="max-w-64 px-4 py-4 text-sm text-[#5E5650]">{supplier.address ? <span className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[#C2763D]" />{supplier.address}</span> : "—"}</td>
                  <td className="px-4 py-4 font-semibold text-[#4A2C20]">{supplier._count.stockReceipts}</td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${supplier.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{supplier.isActive ? "Đang hợp tác" : "Ngừng hợp tác"}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(supplier)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF5E9] text-[#C2763D]" title="Chỉnh sửa"><Pencil size={16} /></button><button type="button" disabled={updatingId !== null} onClick={() => void toggleStatus(supplier)} className={`flex h-9 w-9 items-center justify-center rounded-xl ${supplier.isActive ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-700"}`} title={supplier.isActive ? "Ngừng hợp tác" : "Kích hoạt"}>{supplier.isActive ? <LockKeyhole size={16} /> : <UnlockKeyhole size={16} />}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submit} className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5"><div><h2 className="text-xl font-bold text-[#2A211D]">{editing ? "Chỉnh sửa nhà cung cấp" : "Thêm nhà cung cấp"}</h2><p className="mt-1 text-sm text-[#78866B]">Thông tin dùng khi lập và tra cứu phiếu nhập.</p></div><button type="button" onClick={() => !saving && setFormOpen(false)} className="text-[#8A817B]"><X size={21} /></button></div>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto p-6 sm:grid-cols-2">
              <FormField label="Mã nhà cung cấp *"><input required pattern="[A-Za-z0-9_-]{2,30}" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="VD: NCC-SUA" className="w-full rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" /></FormField>
              <FormField label="Tên nhà cung cấp *"><input required minLength={2} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Tên đơn vị cung cấp" className="w-full rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" /></FormField>
              <FormField label="Người liên hệ"><input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} placeholder="Họ tên người phụ trách" className="w-full rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" /></FormField>
              <FormField label="Số điện thoại"><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="0901234567" className="w-full rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" /></FormField>
              <FormField label="Email"><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="contact@example.com" className="w-full rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" /></FormField>
              <FormField label="Địa chỉ"><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Địa chỉ nhà cung cấp" className="w-full rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" /></FormField>
              <div className="sm:col-span-2"><FormField label="Ghi chú"><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} placeholder="Điều khoản, lịch giao hàng..." className="w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]" /></FormField></div>
              {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 border-t border-[#E9E1D8] px-6 py-4"><button type="button" onClick={() => !saving && setFormOpen(false)} className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold text-[#5E5650]">Hủy</button><button disabled={saving} className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm nhà cung cấp"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Truck; label: string; value: number; tone: "green" | "gray" | "orange" }) {
  const colors = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "orange" ? "bg-[#FFF5E9] text-[#C2763D]" : "bg-slate-100 text-slate-600";
  return <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors}`}><Icon size={20} /></span><p className="mt-4 text-sm text-[#78866B]">{label}</p><strong className="mt-1 block text-2xl text-[#2A211D]">{value}</strong></div>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-[#3D332D]">{label}</span>{children}</label>;
}
