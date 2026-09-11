"use client";

import { Clock3, LoaderCircle, Save, X } from "lucide-react";
import { FormEvent, useState } from "react";

import type {
  AttendanceReportRow,
  UpdateStaffAttendanceInput,
} from "@/types/staff-schedule";
import {
  formatAttendanceDate,
  formatAttendanceTime,
  toVietnamDateTimeInput,
  vietnamDateTimeInputToIso,
} from "@/utils/attendance-report.util";

type Props = {
  row: AttendanceReportRow;
  saving: boolean;
  onClose: () => void;
  onSave: (input: UpdateStaffAttendanceInput) => void;
};

export default function AttendanceAdjustmentModal({
  row,
  saving,
  onClose,
  onSave,
}: Props) {
  const [clockIn, setClockIn] = useState(() =>
    toVietnamDateTimeInput(row.clockIn),
  );
  const [clockOut, setClockOut] = useState(() =>
    toVietnamDateTimeInput(row.clockOut),
  );
  const [reason, setReason] = useState(row.adjustmentReason || "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const normalizedReason = reason.trim();
      if (normalizedReason.length < 3) {
        setError("Anh hãy nhập lý do điều chỉnh ít nhất 3 ký tự.");
        return;
      }
      const input: UpdateStaffAttendanceInput = {
        clockIn: vietnamDateTimeInputToIso(clockIn),
        clockOut: vietnamDateTimeInputToIso(clockOut),
        reason: normalizedReason,
      };
      if (new Date(input.clockOut) <= new Date(input.clockIn)) {
        setError("Giờ ra ca phải sau giờ vào ca.");
        return;
      }
      setError("");
      onSave(input);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Thời gian chấm công không hợp lệ.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EEE5DD] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#C9894B]">
              <Clock3 size={21} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#2A211D]">Điều chỉnh chấm công</h2>
              <p className="mt-0.5 text-sm text-[#8A817B]">
                {row.employee.fullName || row.employee.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            disabled={saving}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#F7F2EC] disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {row.scheduledStart && row.scheduledEnd && (
            <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4 text-sm">
              <p className="font-semibold text-[#2A211D]">
                Ca dự kiến · {formatAttendanceDate(row.scheduledStart)}
              </p>
              <p className="mt-1 text-[#8A817B]">
                {formatAttendanceTime(row.scheduledStart)} – {formatAttendanceTime(row.scheduledEnd)}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
              <span>Giờ vào thực tế</span>
              <input
                required
                type="datetime-local"
                value={clockIn}
                onChange={(event) => setClockIn(event.target.value)}
                className="h-12 w-full rounded-xl border border-[#DED5CC] px-3 font-normal outline-none focus:border-[#C9894B]"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
              <span>Giờ ra thực tế</span>
              <input
                required
                type="datetime-local"
                value={clockOut}
                onChange={(event) => setClockOut(event.target.value)}
                className="h-12 w-full rounded-xl border border-[#DED5CC] px-3 font-normal outline-none focus:border-[#C9894B]"
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm font-semibold text-[#4A403A]">
            <span>Lý do điều chỉnh *</span>
            <textarea
              required
              minLength={3}
              maxLength={255}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ví dụ: Nhân viên quên bấm kết thúc ca..."
              className="w-full resize-none rounded-xl border border-[#DED5CC] px-3 py-3 font-normal outline-none focus:border-[#C9894B]"
            />
          </label>
          <p className="text-xs leading-5 text-[#8A817B]">
            Sau khi lưu, thời gian làm và trạng thái đúng giờ, đi trễ hoặc về sớm sẽ được hệ thống tính lại tự động.
          </p>
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-[#D9CABE] bg-white px-5 py-2.5 text-sm font-semibold text-[#5E5650] hover:bg-[#F7F2EC] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#382118] disabled:opacity-60"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Đang lưu..." : "Lưu điều chỉnh"}
          </button>
        </div>
      </form>
    </div>
  );
}
