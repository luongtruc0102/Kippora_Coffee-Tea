"use client";

import { CalendarDays, Clock3, LoaderCircle, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import type { ScheduleEmployee } from "@/types/staff-schedule";

export type StaffShiftDraft = {
  shiftId?: number;
  employeeId: number;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
};

type Props = {
  employees: ScheduleEmployee[];
  initialValue: StaffShiftDraft;
  saving: boolean;
  onClose: () => void;
  onSave: (value: StaffShiftDraft) => void;
};

export default function StaffShiftModal({
  employees,
  initialValue,
  saving,
  onClose,
  onSave,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(value);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-form-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div>
            <h2 id="shift-form-title" className="text-xl font-bold text-[#1F1B18]">
              {value.shiftId ? "Chỉnh sửa ca làm" : "Xếp ca làm"}
            </h2>
            <p className="mt-1 text-sm text-[#78866B]">
              Nhân viên được điểm danh từ 5 phút trước giờ vào ca.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#78866B] hover:bg-[#FAF8F5]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#3B332E]">Nhân viên</span>
            <select
              value={value.employeeId}
              disabled={Boolean(value.shiftId) || saving}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  employeeId: Number(event.target.value),
                }))
              }
              className="h-12 w-full rounded-xl border border-[#DED5CC] bg-white px-4 text-sm outline-none focus:border-[#C9894B] disabled:bg-[#F7F2EC]"
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName || employee.email}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3B332E]">
                <CalendarDays size={16} className="text-[#C9894B]" /> Ngày làm
              </span>
              <input
                type="date"
                required
                value={value.date}
                disabled={saving}
                onChange={(event) =>
                  setValue((current) => ({ ...current, date: event.target.value }))
                }
                className="h-12 w-full rounded-xl border border-[#DED5CC] px-3 text-sm outline-none focus:border-[#C9894B]"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3B332E]">
                <Clock3 size={16} className="text-[#C9894B]" /> Vào ca
              </span>
              <input
                type="time"
                required
                value={value.startTime}
                disabled={saving}
                onChange={(event) =>
                  setValue((current) => ({ ...current, startTime: event.target.value }))
                }
                className="h-12 w-full rounded-xl border border-[#DED5CC] px-3 text-sm outline-none focus:border-[#C9894B]"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#3B332E]">
                <Clock3 size={16} className="text-[#C9894B]" /> Ra ca
              </span>
              <input
                type="time"
                required
                value={value.endTime}
                disabled={saving}
                onChange={(event) =>
                  setValue((current) => ({ ...current, endTime: event.target.value }))
                }
                className="h-12 w-full rounded-xl border border-[#DED5CC] px-3 text-sm outline-none focus:border-[#C9894B]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#3B332E]">Ghi chú (không bắt buộc)</span>
            <textarea
              rows={3}
              maxLength={250}
              value={value.note}
              disabled={saving}
              placeholder="Ví dụ: Phụ trách quầy pha chế"
              onChange={(event) =>
                setValue((current) => ({ ...current, note: event.target.value }))
              }
              className="w-full resize-none rounded-xl border border-[#DED5CC] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E9E1D8] bg-[#FCFAF8] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#DED5CC] bg-white px-5 py-3 text-sm font-semibold text-[#5E5650]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving && <LoaderCircle size={17} className="animate-spin" />}
            {value.shiftId ? "Lưu thay đổi" : "Xếp ca"}
          </button>
        </div>
      </form>
    </div>
  );
}
