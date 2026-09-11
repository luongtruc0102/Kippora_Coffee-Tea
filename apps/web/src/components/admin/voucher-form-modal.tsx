"use client";

import { FormEvent, useEffect, useState } from "react";

import { ChevronDown, X } from "lucide-react";

import { createVoucher, updateVoucher } from "@/services/voucher.service";

import type { DiscountType, Voucher } from "@/types/voucher";
import ToastMessage from "@/components/ui/toast-message";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  voucher?: Voucher | null;

  onClose: () => void;

  onSaved: (voucher: Voucher) => void;
};

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);

  const offset = date.getTimezoneOffset();

  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

export default function VoucherFormModal({
  open,
  mode,
  voucher,
  onClose,
  onSaved,
}: Props) {
  const [code, setCode] = useState("");

  const [description, setDescription] = useState("");

  const [discountType, setDiscountType] = useState<DiscountType>("PERCENT");

  const [discountValue, setDiscountValue] = useState("");

  const [minOrderValue, setMinOrderValue] = useState("");

  const [maxDiscount, setMaxDiscount] = useState("");

  const [usageLimit, setUsageLimit] = useState("");

  const [startAt, setStartAt] = useState("");

  const [endAt, setEndAt] = useState("");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      if (mode === "edit" && voucher) {
        setCode(voucher.code);
        setDescription(voucher.description ?? "");
        setDiscountType(voucher.discountType);
        setDiscountValue(String(voucher.discountValue));
        setMinOrderValue(
          voucher.minOrderValue !== null
            ? String(voucher.minOrderValue)
            : "",
        );
        setMaxDiscount(
          voucher.maxDiscount !== null
            ? String(voucher.maxDiscount)
            : "",
        );
        setUsageLimit(
          voucher.usageLimit !== null
            ? String(voucher.usageLimit)
            : "",
        );
        setStartAt(
          voucher.startAt
            ? toLocalDateTimeInput(voucher.startAt)
            : "",
        );
        setEndAt(
          voucher.endAt
            ? toLocalDateTimeInput(voucher.endAt)
            : "",
        );
        setError("");
        return;
      }

      resetForm();
    });

    return () => {
      cancelled = true;
    };
  }, [open, mode, voucher]);

  function resetForm() {
    setCode("");
    setDescription("");

    setDiscountType("PERCENT");

    setDiscountValue("");

    setMinOrderValue("");
    setMaxDiscount("");
    setUsageLimit("");

    setStartAt("");
    setEndAt("");

    setError("");
  }

  function handleClose() {
    if (saving) {
      return;
    }

    resetForm();

    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      if (code.trim().length < 2) {
        throw new Error("Mã voucher phải có ít nhất 2 ký tự.");
      }

      const numericDiscount = Number(discountValue);

      if (Number.isNaN(numericDiscount) || numericDiscount <= 0) {
        throw new Error("Giá trị giảm phải lớn hơn 0.");
      }

      if (discountType === "PERCENT" && numericDiscount > 100) {
        throw new Error("Voucher phần trăm không được vượt quá 100%.");
      }

      if (!startAt || !endAt) {
        throw new Error("Vui lòng chọn thời gian bắt đầu và kết thúc.");
      }

      if (new Date(startAt) >= new Date(endAt)) {
        throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc.");
      }

      const input = {
        code: code.trim().toUpperCase(),

        description: description.trim() || undefined,

        discountType,

        discountValue: numericDiscount,

        minOrderValue: minOrderValue
          ? Number(minOrderValue)
          : mode === "edit"
            ? null
            : undefined,

        maxDiscount:
          discountType === "PERCENT"
            ? maxDiscount
              ? Number(maxDiscount)
              : mode === "edit"
                ? null
                : undefined
            : mode === "edit"
              ? null
              : undefined,

        usageLimit: usageLimit
          ? Number(usageLimit)
          : mode === "edit"
            ? null
            : undefined,

        startAt: new Date(startAt).toISOString(),

        endAt: new Date(endAt).toISOString(),
      };

      let savedVoucher: Voucher;

      if (mode === "edit" && voucher) {
        savedVoucher = await updateVoucher(accessToken, voucher.id, input);
      } else {
        savedVoucher = await createVoucher(accessToken, input);
      }

      onSaved(savedVoucher);

      resetForm();

      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể lưu voucher",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  const isEdit = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-4">
          <div>
            <h3 className="text-xl font-semibold text-[#1F1B18]">
              {isEdit ? "Chỉnh sửa voucher" : "Thêm voucher"}
            </h3>

            <p className="mt-1 text-sm text-[#78866B]">
              {isEdit
                ? "Cập nhật thông tin mã giảm giá."
                : "Tạo mã giảm giá mới cho khách hàng."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] transition hover:bg-[#FAF8F5]"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <ToastMessage message={error} />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Mã voucher
              </label>

              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Ví dụ: SALE20"
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm uppercase outline-none transition focus:border-[#C9894B]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Loại giảm giá
              </label>

              <div className="relative">
                <select
                  value={discountType}
                  onChange={(event) =>
                    setDiscountType(event.target.value as DiscountType)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none transition focus:border-[#C9894B]"
                >
                  <option value="PERCENT">Giảm theo %</option>

                  <option value="FIXED">Giảm số tiền cố định</option>
                </select>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5E5650]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                {discountType === "PERCENT" ? "Phần trăm giảm" : "Số tiền giảm"}
              </label>

              <input
                type="number"
                min="0"
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                placeholder={
                  discountType === "PERCENT" ? "Ví dụ: 20" : "Ví dụ: 30000"
                }
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Đơn tối thiểu
              </label>

              <input
                type="number"
                min="0"
                value={minOrderValue}
                onChange={(event) => setMinOrderValue(event.target.value)}
                placeholder="Để trống nếu không yêu cầu"
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>

            {discountType === "PERCENT" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Giảm tối đa
                </label>

                <input
                  type="number"
                  min="0"
                  value={maxDiscount}
                  onChange={(event) => setMaxDiscount(event.target.value)}
                  placeholder="Để trống nếu không giới hạn"
                  className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Giới hạn lượt dùng
              </label>

              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(event) => setUsageLimit(event.target.value)}
                placeholder="Để trống nếu không giới hạn"
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Bắt đầu
              </label>

              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Kết thúc
              </label>

              <input
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Mô tả
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Mô tả voucher..."
                className="w-full resize-none rounded-xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#F0E8E0] pt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] transition hover:bg-[#FAF8F5]"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
            >
              {saving
                ? "Đang lưu..."
                : isEdit
                  ? "Lưu thay đổi"
                  : "Thêm voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
