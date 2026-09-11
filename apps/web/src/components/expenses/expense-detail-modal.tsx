"use client";

import {
  Ban,
  CheckCircle2,
  Pencil,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import {
  expenseCategoryLabels,
  expenseCurrency,
  expenseDate,
  expenseDateTime,
  expensePaymentMethodLabels,
  expenseStatusClasses,
  expenseStatusLabels,
} from "./expense.constants";
import type { BranchExpense } from "@/types/expense";

type Props = {
  expense: BranchExpense;
  mode: "ADMIN" | "BRANCH_MANAGER";
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onApprove: (note?: string) => void;
  onReject: (note: string) => void;
  onCancel: () => void;
};

export default function ExpenseDetailModal({
  expense,
  mode,
  busy,
  onClose,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onCancel,
}: Props) {
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const editable = expense.status === "DRAFT" || expense.status === "REJECTED";

  function reject() {
    if (!reviewNote.trim()) {
      setReviewError("Vui lòng nhập lý do để người lập chỉnh sửa.");
      return;
    }
    setReviewError("");
    onReject(reviewNote.trim());
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[#2A211D]">
                {expense.code}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${expenseStatusClasses[expense.status]}`}
              >
                {expenseStatusLabels[expense.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#78866B]">
              {expense.branch.code} · {expense.branch.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-[#8A817B]"
          >
            <X size={21} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <section className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-5">
            <p className="text-sm text-[#78866B]">
              {expenseCategoryLabels[expense.category]}
            </p>
            <p className="mt-2 text-3xl font-bold text-[#4A2C20]">
              {expenseCurrency(expense.amount)}
            </p>
            <h3 className="mt-4 text-lg font-bold text-[#2A211D]">
              {expense.description}
            </h3>
            {expense.note && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#6B625C]">
                {expense.note}
              </p>
            )}
          </section>

          <section className="mt-5 grid gap-4 rounded-2xl border border-[#E9E1D8] p-5 sm:grid-cols-2">
            <Info label="Ngày phát sinh" value={expenseDate(expense.incurredOn)} />
            <Info
              label="Hình thức chi"
              value={expensePaymentMethodLabels[expense.paymentMethod]}
            />
            <Info
              label="Người lập"
              value={expense.createdBy.fullName || expense.createdBy.email}
            />
            <Info label="Thời điểm lập" value={expenseDateTime(expense.createdAt)} />
            <Info
              label="Thời điểm gửi"
              value={expense.submittedAt ? expenseDateTime(expense.submittedAt) : "Chưa gửi"}
            />
            {expense.reviewedBy && (
              <Info
                label="Admin xử lý"
                value={expense.reviewedBy.fullName || expense.reviewedBy.email}
              />
            )}
            {expense.reviewedAt && (
              <Info
                label="Thời điểm xử lý"
                value={expenseDateTime(expense.reviewedAt)}
              />
            )}
          </section>

          {expense.reviewNote && (
            <section
              className={`mt-5 rounded-2xl border p-5 ${
                expense.status === "REJECTED"
                  ? "border-red-200 bg-red-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <p className="text-sm font-bold text-[#2A211D]">
                Phản hồi của Admin
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#5E5650]">
                {expense.reviewNote}
              </p>
            </section>
          )}

          {mode === "ADMIN" && expense.status === "PENDING" && (
            <section className="mt-5 rounded-2xl border border-[#E9E1D8] p-5">
              <label>
                <span className="mb-2 block text-sm font-bold text-[#2A211D]">
                  Ghi chú duyệt
                </span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reviewNote}
                  onChange={(event) => {
                    setReviewNote(event.target.value);
                    setReviewError("");
                  }}
                  placeholder="Không bắt buộc khi duyệt; bắt buộc khi từ chối."
                  className="w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
                />
              </label>
              {reviewError && (
                <p className="mt-2 text-sm text-red-600">{reviewError}</p>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={reject}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 disabled:opacity-50"
                >
                  <XCircle size={17} /> Từ chối
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onApprove(reviewNote.trim() || undefined)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={17} /> Duyệt khoản chi
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#E9E1D8] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
          >
            Đóng
          </button>
          {editable && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancel(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"
              >
                <Ban size={16} /> Hủy phiếu
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#6B4A36] disabled:opacity-50"
              >
                <Pencil size={16} /> Chỉnh sửa
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSubmit}
                className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Send size={16} /> Gửi Admin duyệt
              </button>
            </>
          )}
        </div>
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#2A211D]">
              Hủy khoản chi này?
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#78866B]">
              {expense.code} sẽ được giữ trong lịch sử với trạng thái đã hủy và
              không được tính vào báo cáo.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancel(false)}
                className="rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#5E5650]"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8A817B]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#2A211D]">{value}</p>
    </div>
  );
}
