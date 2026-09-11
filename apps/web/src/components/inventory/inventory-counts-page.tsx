"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FilePlus2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  approveInventoryCount,
  cancelInventoryCount,
  createInventoryCount,
  getInventoryCounts,
  getInventoryOverview,
  rejectInventoryCount,
  submitInventoryCount,
  updateInventoryCount,
} from "@/services/inventory.service";
import type {
  InventoryCount,
  InventoryCountInput,
  InventoryCountList,
  InventoryCountStatus,
  InventoryOverview,
} from "@/types/inventory";
import InventoryCountFormModal from "./inventory-count-form-modal";
import InventoryCountDetailModal, {
  type InventoryCountAction,
} from "./inventory-count-detail-modal";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

const statusLabels: Record<InventoryCountStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

function dateKey(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  return `${dateKey().slice(0, 7)}-01`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeClass(status: InventoryCountStatus) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  if (status === "REJECTED") return "bg-red-50 text-red-600";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-600";
  return "bg-blue-50 text-blue-700";
}

const actionCopy: Record<
  InventoryCountAction,
  { title: string; description: string; button: string }
> = {
  submit: {
    title: "Gửi phiếu cho Admin duyệt?",
    description:
      "Sau khi gửi, phiếu sẽ khóa chỉnh sửa. Tồn kho chưa thay đổi cho đến khi Admin duyệt.",
    button: "Gửi duyệt",
  },
  approve: {
    title: "Duyệt và cập nhật tồn kho?",
    description:
      "Hệ thống sẽ cộng hoặc trừ đúng phần chênh lệch và ghi biến động kho không thể xóa.",
    button: "Duyệt phiếu",
  },
  reject: {
    title: "Từ chối phiếu kiểm kê?",
    description: "Phiếu sẽ không làm thay đổi tồn kho. Vui lòng nêu rõ lý do.",
    button: "Từ chối",
  },
  cancel: {
    title: "Hủy phiếu kiểm kê?",
    description: "Phiếu bị hủy sẽ chỉ được lưu lại để tra cứu lịch sử.",
    button: "Hủy phiếu",
  },
};

export default function InventoryCountsPage({ mode }: Props) {
  const { showToast } = useAppToast();
  const [data, setData] = useState<InventoryCountList | null>(null);
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number>();
  const [status, setStatus] = useState<InventoryCountStatus | "ALL">("ALL");
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(dateKey);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCount | null>(null);
  const [selected, setSelected] = useState<InventoryCount | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<InventoryCountAction | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setError("");
        const [countData, inventoryData] = await Promise.all([
          getInventoryCounts(
            accessToken,
            {
              branchId: selectedBranchId,
              status,
              from,
              to,
              q: keyword,
            },
            signal,
          ),
          getInventoryOverview(accessToken, selectedBranchId, signal),
        ]);
        setData(countData);
        setOverview(inventoryData);
        setSelectedBranchId(countData.selectedBranch.id);
        setSelected((current) =>
          current
            ? (countData.counts.find((item) => item.id === current.id) ?? null)
            : null,
        );
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải phiếu kiểm kê.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [from, keyword, selectedBranchId, status, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(count: InventoryCount) {
    setEditing(count);
    setSelected(null);
    setFormOpen(true);
  }

  async function saveCount(input: InventoryCountInput) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      const saved = editing
        ? await updateInventoryCount(accessToken, editing.id, input)
        : await createInventoryCount(accessToken, input);
      setFormOpen(false);
      setEditing(null);
      setSelected(saved);
      showToast(
        editing ? "Đã cập nhật phiếu kiểm kê" : "Đã lập phiếu kiểm kê",
        "success",
      );
      await load();
    } catch (saveError) {
      showToast(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu phiếu kiểm kê",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  function requestAction(nextAction: InventoryCountAction) {
    setReviewNote("");
    setActionError("");
    setAction(nextAction);
  }

  async function executeAction() {
    if (!selected || !action) return;
    if (action === "reject" && reviewNote.trim().length < 3) {
      setActionError("Vui lòng nhập lý do từ chối có ít nhất 3 ký tự.");
      return;
    }
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setBusy(true);
      setActionError("");
      const updated =
        action === "submit"
          ? await submitInventoryCount(accessToken, selected.id)
          : action === "approve"
            ? await approveInventoryCount(
                accessToken,
                selected.id,
                reviewNote.trim() || undefined,
              )
            : action === "reject"
              ? await rejectInventoryCount(
                  accessToken,
                  selected.id,
                  reviewNote.trim(),
                )
              : await cancelInventoryCount(accessToken, selected.id);
      setSelected(updated);
      setAction(null);
      showToast(
        action === "approve"
          ? "Đã duyệt và cập nhật tồn kho"
          : action === "reject"
            ? "Đã từ chối phiếu kiểm kê"
            : action === "submit"
              ? "Đã gửi phiếu cho Admin duyệt"
              : "Đã hủy phiếu kiểm kê",
        "success",
      );
      await load();
    } catch (processError) {
      setActionError(
        processError instanceof Error
          ? processError.message
          : "Không thể xử lý phiếu kiểm kê.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportCount(format: "pdf" | "xlsx") {
    if (!selected || exporting) return;
    try {
      setExporting(format);
      if (format === "xlsx") {
        const { downloadInventoryCountExcel } =
          await import("@/utils/inventory-count-report-excel");
        await downloadInventoryCountExcel(selected);
      } else {
        const { downloadInventoryCountPdf } =
          await import("@/utils/inventory-count-report-pdf");
        await downloadInventoryCountPdf(selected);
      }
      showToast(`Đã xuất phiếu kiểm kê ${selected.code}`, "success");
    } catch (exportError) {
      showToast(
        exportError instanceof Error
          ? exportError.message
          : "Không thể xuất phiếu kiểm kê",
        "error",
      );
    } finally {
      setExporting(null);
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
            Kiểm kê kho
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Ghi nhận số đếm thực tế. Chỉ phiếu được Admin duyệt mới cập nhật tồn
            kho.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCreate}
            disabled={!overview || loading}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <FilePlus2 size={17} /> Lập phiếu kiểm kê
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Làm mới"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4D8CC] bg-white text-[#6B4A36] disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={ClipboardCheck}
          label="Tổng phiếu"
          value={data?.summary.total ?? 0}
        />
        <SummaryCard
          icon={Clock3}
          label="Chờ Admin duyệt"
          value={data?.summary.pending ?? 0}
          amber
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Đã duyệt"
          value={data?.summary.approved ?? 0}
          green
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Dòng thiếu hụt"
          value={data?.summary.shortageItems ?? 0}
          red
        />
      </section>

      <section className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(230px,1fr)_210px_170px_170px_170px_auto]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setKeyword(search.trim());
            }}
            className="relative"
          >
            <Search
              size={17}
              className="absolute left-3 top-3 text-[#9A9089]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã hoặc ghi chú..."
              className="h-11 w-full rounded-xl border border-[#E4D8CC] pl-10 pr-3 text-sm outline-none"
            />
          </form>
          {data && mode === "ADMIN" && (
            <select
              value={selectedBranchId}
              onChange={(event) =>
                setSelectedBranchId(Number(event.target.value))
              }
              className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-3 text-sm outline-none"
            >
              {data.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as InventoryCountStatus | "ALL")
            }
            className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-3 text-sm outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-11 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 rounded-xl border border-[#E4D8CC] px-3 text-sm outline-none"
          />
          <button
            onClick={() => setKeyword(search.trim())}
            className="h-11 rounded-xl bg-[#F3E9DE] px-4 text-sm font-semibold text-[#6B4A36]"
          >
            Lọc
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left">
            <thead className="border-b border-[#E9E1D8] bg-[#FCFAF8] text-xs uppercase tracking-wide text-[#78866B]">
              <tr>
                <th className="px-5 py-4">Phiếu</th>
                <th className="px-4 py-4">Chi nhánh</th>
                <th className="px-4 py-4">Thời gian kiểm</th>
                <th className="px-4 py-4">Người lập</th>
                <th className="px-4 py-4">Chênh lệch</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E8E0]">
              {data?.counts.map((count) => {
                const shortage = count.items.filter(
                  (item) => item.differenceQuantity < -0.0005,
                ).length;
                const surplus = count.items.filter(
                  (item) => item.differenceQuantity > 0.0005,
                ).length;
                return (
                  <tr key={count.id} className="hover:bg-[#FCFAF8]">
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#2A211D]">{count.code}</p>
                      <span className="text-xs text-[#8A817B]">
                        {count.items.length} nguyên liệu
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-[#4A403A]">
                      {count.branch.code}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#5E5650]">
                      {formatDate(count.countedAt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#5E5650]">
                      {count.createdBy.fullName || count.createdBy.email}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className="font-semibold text-red-600">
                        Thiếu {shortage}
                      </span>
                      <span className="mx-2 text-[#C8BDB5]">·</span>
                      <span className="font-semibold text-emerald-700">
                        Dư {surplus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(count.status)}`}
                      >
                        {statusLabels[count.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(count)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#DCCBBB] px-4 py-2 text-sm font-semibold text-[#6B4A36]"
                      >
                        <Eye size={16} /> Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && data?.counts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#8A817B]"
                  >
                    Chưa có phiếu kiểm kê phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
              {loading && !data && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#8A817B]"
                  >
                    Đang tải phiếu kiểm kê...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && overview && (
        <InventoryCountFormModal
          branch={overview.selectedBranch}
          rows={overview.rows}
          count={editing}
          saving={saving}
          onClose={() => !saving && setFormOpen(false)}
          onSave={(input) => void saveCount(input)}
        />
      )}

      {selected && (
        <InventoryCountDetailModal
          mode={mode}
          count={selected}
          busy={busy}
          exporting={exporting}
          onClose={() => !busy && setSelected(null)}
          onEdit={() => openEdit(selected)}
          onAction={requestAction}
          onExport={(format) => void exportCount(format)}
        />
      )}

      {selected && action && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#E9E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[#2A211D]">
                  {actionCopy[action].title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#78866B]">
                  {actionCopy[action].description}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#81766F] hover:bg-[#F7F2EC]"
              >
                <X size={19} />
              </button>
            </div>
            {(action === "approve" || action === "reject") && (
              <label className="mt-5 block text-sm font-semibold text-[#4A403A]">
                {action === "reject"
                  ? "Lý do từ chối *"
                  : "Ghi chú duyệt (không bắt buộc)"}
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  maxLength={500}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-[#E4D8CC] p-3 font-normal outline-none focus:border-[#C9894B]"
                />
              </label>
            )}
            {actionError && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
                className="rounded-xl border border-[#DCCBBB] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executeAction()}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${action === "approve" || action === "submit" ? "bg-[#4A2C20]" : "bg-red-600"}`}
              >
                {busy ? "Đang xử lý..." : actionCopy[action].button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  amber,
  green,
  red,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: number;
  amber?: boolean;
  green?: boolean;
  red?: boolean;
}) {
  const color = red
    ? "bg-red-50 text-red-600"
    : green
      ? "bg-emerald-50 text-emerald-700"
      : amber
        ? "bg-amber-50 text-amber-700"
        : "bg-[#F3E9DE] text-[#B96E35]";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm text-[#78866B]">{label}</p>
        <strong className="mt-2 block text-2xl text-[#2A211D]">{value}</strong>
      </div>
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}
      >
        <Icon size={21} />
      </span>
    </div>
  );
}
