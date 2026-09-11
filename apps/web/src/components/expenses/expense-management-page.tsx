"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FilePlus2,
  Files,
  RotateCcw,
  Search,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  cancelExpense,
  createExpense,
  getExpenses,
  reviewExpense,
  submitExpense,
  updateExpense,
} from "@/services/expense.service";
import type {
  BranchExpense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseList,
  ExpenseStatus,
} from "@/types/expense";
import {
  expenseCategoryLabels,
  expenseCurrency,
  expenseDate,
  expensePaymentMethodLabels,
  expenseStatusClasses,
  expenseStatusLabels,
} from "./expense.constants";
import ExpenseDetailModal from "./expense-detail-modal";
import ExpenseFormModal from "./expense-form-modal";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

function dateInputValue(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function monthStart() {
  return `${dateInputValue().slice(0, 7)}-01`;
}

export default function ExpenseManagementPage({ mode }: Props) {
  const { showToast } = useAppToast();
  const [data, setData] = useState<ExpenseList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [selectedBranchId, setSelectedBranchId] = useState(0);
  const [status, setStatus] = useState<ExpenseStatus | "ALL">("ALL");
  const [category, setCategory] = useState<ExpenseCategory | "ALL">("ALL");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(dateInputValue);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchExpense | null>(null);
  const [selectedExpense, setSelectedExpense] =
    useState<BranchExpense | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        setError("");
        const result = await getExpenses(
          accessToken,
          {
            branchId: selectedBranchId || undefined,
            status,
            category,
            from: from || undefined,
            to: to || undefined,
            q: debouncedSearch,
          },
          signal,
        );
        setData(result);
        if (mode === "BRANCH_MANAGER" && result.scopedBranchId) {
          setSelectedBranchId(result.scopedBranchId);
        }
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải khoản chi",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [category, debouncedSearch, from, mode, selectedBranchId, status, to],
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
    const branch = selectedBranchId
      ? data?.branches.find((item) => item.id === selectedBranchId)
      : data?.branches.find((item) => item.isActive);
    if (!branch) {
      showToast("Không có chi nhánh hoạt động để lập khoản chi", "error");
      return;
    }
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(expense: BranchExpense) {
    setSelectedExpense(null);
    setEditing(expense);
    setFormError("");
    setFormOpen(true);
  }

  async function saveExpense(input: ExpenseInput) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      setFormError("");
      const saved = editing
        ? await updateExpense(accessToken, editing.id, input)
        : await createExpense(accessToken, input);
      setFormOpen(false);
      setEditing(null);
      setSelectedExpense(saved);
      showToast(
        editing ? "Đã cập nhật khoản chi" : "Đã lưu khoản chi nháp",
        "success",
      );
      await load();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu khoản chi",
      );
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    action: (accessToken: string) => Promise<BranchExpense>,
    successMessage: string,
  ) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setBusy(true);
      const updated = await action(accessToken);
      setSelectedExpense(updated);
      showToast(successMessage, "success");
      await load();
    } catch (actionError) {
      showToast(
        actionError instanceof Error
          ? actionError.message
          : "Không thể xử lý khoản chi",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const initialBranchId =
    editing?.branchId ||
    selectedBranchId ||
    data?.branches.find((branch) => branch.isActive)?.id ||
    0;
  const hasCustomDate = from !== monthStart() || to !== dateInputValue();
  const hasActiveFilters = Boolean(
    (mode === "ADMIN" && selectedBranchId ? 1 : 0) +
      (category !== "ALL" ? 1 : 0) +
      (status !== "ALL" ? 1 : 0) +
      (hasCustomDate ? 1 : 0) +
      (search.trim() ? 1 : 0),
  );

  function resetFilters() {
    if (mode === "ADMIN") setSelectedBranchId(0);
    setSearch("");
    setStatus("ALL");
    setCategory("ALL");
    setFrom(monthStart());
    setTo(dateInputValue());
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">
            Tài chính
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">
            Quản lý chi phí
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            {mode === "ADMIN"
              ? "Duyệt khoản chi vận hành của các chi nhánh trước khi đưa vào báo cáo."
              : "Lập khoản chi của chi nhánh và gửi Admin kiểm tra, phê duyệt."}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white"
        >
          <FilePlus2 size={18} /> Lập khoản chi
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Files}
          label="Tổng chứng từ"
          value={String(data?.summary.total ?? 0)}
          tone="brown"
        />
        <SummaryCard
          icon={Clock3}
          label="Chờ Admin duyệt"
          value={String(data?.summary.pending ?? 0)}
          subValue={expenseCurrency(data?.summary.pendingAmount ?? 0)}
          tone="amber"
        />
        <SummaryCard
          icon={WalletCards}
          label="Chi phí đã duyệt"
          value={expenseCurrency(data?.summary.approvedAmount ?? 0)}
          subValue={`${data?.summary.approved ?? 0} chứng từ`}
          tone="green"
        />
        <SummaryCard
          icon={XCircle}
          label="Bị từ chối"
          value={String(data?.summary.rejected ?? 0)}
          tone="red"
        />
      </section>

      <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#2A211D]">Bộ lọc khoản chi</h2>
            <p className="mt-0.5 text-xs text-[#8A817B]">
              Tìm nhanh hoặc thu hẹp danh sách theo thông tin cần xem.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label
            className={`flex h-11 min-w-0 items-center gap-3 rounded-xl border border-[#E4D8CC] bg-[#FCFAF8] px-4 focus-within:border-[#C2763D] focus-within:bg-white ${
              mode === "ADMIN" ? "xl:col-span-2" : "xl:col-span-3"
            }`}
          >
            <Search size={18} className="text-[#8A817B]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã, nội dung hoặc người lập..."
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </label>
          {mode === "ADMIN" && (
            <select
              aria-label="Lọc theo chi nhánh"
              value={selectedBranchId}
              onChange={(event) =>
                setSelectedBranchId(Number(event.target.value))
              }
              className="h-11 min-w-0 w-full rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none"
            >
              <option value={0}>Tất cả chi nhánh</option>
              {data?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ExpenseStatus | "ALL")
            }
            className="h-11 min-w-0 w-full rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none focus:border-[#C2763D]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(expenseStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc theo nhóm chi"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as ExpenseCategory | "ALL")
            }
            className="h-11 min-w-0 w-full rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none"
          >
            <option value="ALL">Tất cả nhóm chi</option>
            {Object.entries(expenseCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#F0E8E0] bg-[#FCFAF8] p-3 lg:flex-row lg:items-end">
          <div className="min-w-44 px-1 pb-1">
            <p className="text-sm font-semibold text-[#5E5650]">
              Khoảng thời gian
            </p>
            <p className="mt-0.5 text-xs text-[#9A8F87]">
              Mặc định từ đầu tháng đến hôm nay
            </p>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <DateFilter
              title="Từ ngày"
              value={from}
              max={to || undefined}
              onChange={setFrom}
            />
            <DateFilter
              title="Đến ngày"
              value={to}
              min={from || undefined}
              max={dateInputValue()}
              onChange={setTo}
            />
          </div>
          <div className="flex min-h-11 items-center justify-end lg:min-w-36">
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#C2763D] transition hover:bg-[#F3E9DE] disabled:cursor-not-allowed disabled:text-[#B9B0AA] disabled:hover:bg-transparent"
            >
              <RotateCcw size={14} /> Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left">
            <thead className="border-b border-[#E9E1D8] bg-[#FCFAF8] text-xs uppercase tracking-wide text-[#78866B]">
              <tr>
                <th className="px-5 py-4">Chứng từ</th>
                <th className="px-4 py-4">Nội dung</th>
                <th className="px-4 py-4">Nhóm chi</th>
                <th className="px-4 py-4 text-right">Số tiền</th>
                <th className="px-4 py-4">Ngày phát sinh</th>
                <th className="px-4 py-4">Người lập</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E8E0]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-[#8A817B]">
                    Đang tải khoản chi...
                  </td>
                </tr>
              ) : !data?.expenses.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-[#8A817B]">
                    Chưa có khoản chi phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                data.expenses.map((expense) => (
                  <tr key={expense.id} className="text-sm text-[#5E5650]">
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#4A2C20]">{expense.code}</p>
                      <span className="text-xs text-[#8A817B]">
                        {expense.branch.code}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="max-w-72 truncate font-semibold text-[#2A211D]">
                        {expense.description}
                      </p>
                      <span className="block max-w-72 truncate text-xs text-[#8A817B]">
                        {expense.note || "Không có ghi chú"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {expenseCategoryLabels[expense.category]}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-[#4A2C20]">
                      <span className="block">{expenseCurrency(expense.amount)}</span>
                      <span className="mt-0.5 block text-xs font-normal text-[#8A817B]">
                        {expensePaymentMethodLabels[expense.paymentMethod]}
                      </span>
                    </td>
                    <td className="px-4 py-4">{expenseDate(expense.incurredOn)}</td>
                    <td className="px-4 py-4">
                      {expense.createdBy.fullName || expense.createdBy.email}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${expenseStatusClasses[expense.status]}`}
                      >
                        {expenseStatusLabels[expense.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedExpense(expense)}
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#F4F7F0] px-3 text-xs font-semibold text-[#637458]"
                        >
                          <Eye size={16} /> Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && data && (
        <ExpenseFormModal
          key={editing?.id ?? "new"}
          branches={data.branches}
          initialBranchId={initialBranchId}
          expense={editing}
          saving={saving}
          error={formError}
          onClose={() => !saving && setFormOpen(false)}
          onSave={(input) => void saveExpense(input)}
        />
      )}

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          mode={mode}
          busy={busy}
          onClose={() => !busy && setSelectedExpense(null)}
          onEdit={() => openEdit(selectedExpense)}
          onSubmit={() =>
            void runAction(
              (token) => submitExpense(token, selectedExpense.id),
              "Đã gửi khoản chi cho Admin duyệt",
            )
          }
          onApprove={(note) =>
            void runAction(
              (token) =>
                reviewExpense(token, selectedExpense.id, {
                  decision: "APPROVE",
                  note,
                }),
              "Đã duyệt khoản chi",
            )
          }
          onReject={(note) =>
            void runAction(
              (token) =>
                reviewExpense(token, selectedExpense.id, {
                  decision: "REJECT",
                  note,
                }),
              "Đã trả khoản chi cho người lập chỉnh sửa",
            )
          }
          onCancel={() =>
            void runAction(
              (token) => cancelExpense(token, selectedExpense.id),
              "Đã hủy khoản chi",
            )
          }
        />
      )}
    </div>
  );
}

function DateFilter({
  title,
  value,
  min,
  max,
  onChange,
}: {
  title: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-[#78866B]">
        {title}
      </span>
      <span className="relative block">
        <CalendarDays
          size={16}
          className="pointer-events-none absolute left-3 top-3.5 text-[#8A817B]"
        />
        <input
          type="date"
          title={title}
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 min-w-0 w-full max-w-full rounded-xl border border-[#E4D8CC] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#C2763D]"
        />
      </span>
    </label>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subValue,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  subValue?: string;
  tone: "brown" | "amber" | "green" | "red";
}) {
  const colors =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : tone === "red"
          ? "bg-red-50 text-red-600"
          : "bg-[#F3E9DE] text-[#4A2C20]";
  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors}`}>
        <Icon size={20} />
      </span>
      <p className="mt-4 text-sm text-[#78866B]">{label}</p>
      <strong className="mt-1 block text-2xl text-[#2A211D]">{value}</strong>
      {subValue && <span className="mt-1 block text-xs text-[#8A817B]">{subValue}</span>}
    </div>
  );
}
