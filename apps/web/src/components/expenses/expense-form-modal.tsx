"use client";

import { CalendarDays, Save, X } from "lucide-react";
import { useState } from "react";

import {
  expenseCategoryLabels,
  expensePaymentMethodLabels,
} from "./expense.constants";
import type {
  BranchExpense,
  ExpenseBranch,
  ExpenseCategory,
  ExpenseInput,
  ExpensePaymentMethod,
} from "@/types/expense";

type Props = {
  branches: ExpenseBranch[];
  initialBranchId: number;
  expense?: BranchExpense | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: ExpenseInput) => void;
};

function dateInputValue(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export default function ExpenseFormModal({
  branches,
  initialBranchId,
  expense,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const [branchId, setBranchId] = useState(
    expense?.branchId ?? initialBranchId,
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "UTILITIES",
  );
  const [amount, setAmount] = useState(
    expense ? String(expense.amount) : "",
  );
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(
    expense?.paymentMethod ?? "CASH",
  );
  const [incurredOn, setIncurredOn] = useState(
    expense ? expense.incurredOn.slice(0, 10) : dateInputValue(),
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [note, setNote] = useState(expense?.note ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (
      !branchId ||
      !incurredOn ||
      !description.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return;
    }
    onSave({
      branchId,
      category,
      paymentMethod,
      amount: parsedAmount,
      incurredOn,
      description: description.trim(),
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#2A211D]">
              {expense ? `Chỉnh sửa ${expense.code}` : "Lập khoản chi"}
            </h2>
            <p className="mt-1 text-sm text-[#78866B]">
              Lưu bản nháp trước khi gửi Admin duyệt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[#8A817B]"
          >
            <X size={21} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
                Chi nhánh *
              </span>
              <select
                required
                disabled={Boolean(expense) || branches.length === 1}
                value={branchId}
                onChange={(event) => setBranchId(Number(event.target.value))}
                className="h-12 w-full rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5]"
              >
                {branches
                  .filter((branch) => branch.isActive || branch.id === branchId)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} · {branch.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
                Hình thức chi *
              </span>
              <select
                required
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as ExpensePaymentMethod)
                }
                className="h-12 w-full rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
              >
                {Object.entries(expensePaymentMethodLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
                Ngày phát sinh *
              </span>
              <span className="relative block">
                <CalendarDays
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A817B]"
                />
                <input
                  required
                  type="date"
                  max={dateInputValue()}
                  value={incurredOn}
                  onChange={(event) => setIncurredOn(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E4D8CC] pl-11 pr-4 text-sm outline-none focus:border-[#C9894B]"
                />
              </span>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
                Nhóm chi phí *
              </span>
              <select
                required
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ExpenseCategory)
                }
                className="h-12 w-full rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
              >
                {Object.entries(expenseCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
                Số tiền *
              </span>
              <span className="flex h-12 items-center rounded-xl border border-[#E4D8CC] pr-4 focus-within:border-[#C9894B]">
                <input
                  required
                  type="number"
                  min="1"
                  max="1000000000"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Ví dụ: 500000"
                  className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none"
                />
                <span className="text-sm text-[#8A817B]">đ</span>
              </span>
            </label>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
              Nội dung khoản chi *
            </span>
            <input
              required
              maxLength={180}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ví dụ: Thanh toán tiền điện tháng 9"
              className="h-12 w-full rounded-xl border border-[#E4D8CC] px-4 text-sm outline-none focus:border-[#C9894B]"
            />
          </label>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-[#3D332D]">
              Ghi chú
            </span>
            <textarea
              rows={4}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Số hóa đơn, đơn vị nhận tiền hoặc nội dung cần đối soát..."
              className="w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
            />
          </label>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E9E1D8] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
          >
            Đóng
          </button>
          <button
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Đang lưu..." : "Lưu bản nháp"}
          </button>
        </div>
      </form>
    </div>
  );
}
