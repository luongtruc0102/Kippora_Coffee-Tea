"use client";

import { CalendarOff, FileUp, LoaderCircle, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import {
  createStaffLeave,
  supplementStaffLeave,
  uploadLeaveEvidence,
} from "@/services/staff-leave.service";
import type {
  MyLeaveSchedule,
  StaffLeaveRequest,
  StaffLeaveScope,
  StaffLeaveType,
} from "@/types/staff-leave";

type Shift = MyLeaveSchedule["shifts"][number];

type Props = {
  shift: Shift;
  request?: StaffLeaveRequest | null;
  onClose: () => void;
  onSaved: (request: StaffLeaveRequest) => void;
};

function formatShift(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function vietnamDateTimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default function StaffLeaveRequestModal({
  shift,
  request,
  onClose,
  onSaved,
}: Props) {
  const supplementing = request?.status === "NEEDS_INFO";
  const [openedAt] = useState(() => Date.now());
  const defaultType = useMemo<StaffLeaveType>(
    () =>
      new Date(shift.startAt).getTime() - openedAt >= 48 * 60 * 60 * 1000
        ? "PLANNED"
        : "EMERGENCY",
    [openedAt, shift.startAt],
  );
  const [type, setType] = useState<StaffLeaveType>(
    request?.type ?? defaultType,
  );
  const [scope, setScope] = useState<StaffLeaveScope>(
    request?.scope ?? (shift.hasAttendance ? "EARLY_LEAVE" : "FULL_SHIFT"),
  );
  const defaultEarlyLeaveAt = useMemo(
    () =>
      vietnamDateTimeLocal(
        new Date(
          (new Date(shift.startAt).getTime() +
            new Date(shift.endAt).getTime()) /
            2,
        ).toISOString(),
      ),
    [shift.endAt, shift.startAt],
  );
  const [requestedStartAt, setRequestedStartAt] = useState(
    request?.requestedStartAt
      ? vietnamDateTimeLocal(request.requestedStartAt)
      : defaultEarlyLeaveAt,
  );
  const [requestedEndAt, setRequestedEndAt] = useState(
    request?.requestedEndAt
      ? vietnamDateTimeLocal(request.requestedEndAt)
      : defaultEarlyLeaveAt,
  );
  const [reason, setReason] = useState(request?.reason ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 5) {
      setError("Anh/chị hãy mô tả lý do ít nhất 5 ký tự.");
      return;
    }

    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      setError("Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      let evidenceUrl: string | undefined;
      if (file) {
        evidenceUrl = (await uploadLeaveEvidence(accessToken, file))
          .evidenceUrl;
      }
      const saved =
        supplementing && request
          ? await supplementStaffLeave(accessToken, request.id, {
              reason: normalizedReason,
              evidenceUrl,
            })
          : await createStaffLeave(accessToken, {
              staffShiftId: shift.id,
              type,
              scope,
              requestedStartAt:
                scope === "LATE_ARRIVAL"
                  ? new Date(`${requestedStartAt}:00+07:00`).toISOString()
                  : undefined,
              requestedEndAt:
                scope === "EARLY_LEAVE"
                  ? new Date(`${requestedEndAt}:00+07:00`).toISOString()
                  : undefined,
              reason: normalizedReason,
              evidenceUrl,
            });
      onSaved(saved);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể gửi yêu cầu nghỉ.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[min(820px,calc(100dvh-1.5rem))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl sm:max-h-[min(820px,calc(100dvh-2rem))]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#EEE5DD] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#C9894B]">
              <CalendarOff size={21} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-[#2A211D]">
                {supplementing
                  ? "Bổ sung yêu cầu xin phép"
                  : "Gửi yêu cầu xin phép"}
              </h2>
              <p className="mt-0.5 text-sm text-[#8A817B]">
                Ca bắt đầu {formatShift(shift.startAt)}
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {supplementing && request?.reviewNote && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Trưởng chi nhánh yêu cầu:</strong> {request.reviewNote}
            </div>
          )}

          {!supplementing && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-[#4A403A]">
                Phạm vi xin phép
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["FULL_SHIFT", "Nghỉ cả ca", "Không chấm công ca này"],
                    [
                      "LATE_ARRIVAL",
                      "Xin đến trễ",
                      "Không phạt tới giờ được duyệt",
                    ],
                    [
                      "EARLY_LEAVE",
                      "Xin về sớm",
                      "Chỉ miễn phạt từ giờ được duyệt",
                    ],
                  ] as const
                ).map(([value, label, description]) => {
                  const disabled =
                    value !== "EARLY_LEAVE" && shift.hasAttendance;
                  return (
                    <label
                      key={value}
                      className={`rounded-2xl border p-3.5 transition ${
                        disabled
                          ? "cursor-not-allowed bg-gray-50 opacity-50"
                          : "cursor-pointer"
                      } ${
                        scope === value
                          ? "border-[#C9894B] bg-[#FFF8F0]"
                          : "border-[#E9E1D8] bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="leaveScope"
                        value={value}
                        disabled={disabled}
                        checked={scope === value}
                        onChange={() => setScope(value)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-bold text-[#2A211D]">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs text-[#8A817B]">
                        {description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {scope === "EARLY_LEAVE" && (
            <label className="block space-y-2 text-sm font-semibold text-[#4A403A]">
              <span>Thời gian xin về *</span>
              <input
                type="datetime-local"
                required
                min={vietnamDateTimeLocal(
                  new Date(
                    new Date(shift.startAt).getTime() + 60_000,
                  ).toISOString(),
                )}
                max={vietnamDateTimeLocal(
                  new Date(
                    new Date(shift.endAt).getTime() - 60_000,
                  ).toISOString(),
                )}
                value={requestedEndAt}
                onChange={(event) => setRequestedEndAt(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#DED5CC] px-3 font-normal outline-none focus:border-[#C9894B]"
              />
            </label>
          )}

          {scope === "LATE_ARRIVAL" && (
            <label className="block space-y-2 text-sm font-semibold text-[#4A403A]">
              <span>Thời gian dự kiến đến *</span>
              <input
                type="datetime-local"
                required
                min={vietnamDateTimeLocal(
                  new Date(
                    new Date(shift.startAt).getTime() + 60_000,
                  ).toISOString(),
                )}
                max={vietnamDateTimeLocal(
                  new Date(
                    new Date(shift.endAt).getTime() - 60_000,
                  ).toISOString(),
                )}
                value={requestedStartAt}
                onChange={(event) => setRequestedStartAt(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#DED5CC] px-3 font-normal outline-none focus:border-[#C9894B]"
              />
              <span className="block text-xs font-normal text-[#8A817B]">
                Thời gian chưa có mặt không tính lương; chỉ phần đến sau mốc
                được duyệt mới bị tính đi trễ.
              </span>
            </label>
          )}

          {!supplementing && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-[#4A403A]">
                Loại yêu cầu
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    [
                      "PLANNED",
                      "Nghỉ báo trước",
                      "Gửi trước ca ít nhất 48 giờ",
                    ],
                    ["EMERGENCY", "Nghỉ đột xuất", "Dùng khi có việc khẩn cấp"],
                  ] as const
                ).map(([value, label, description]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition ${
                      type === value
                        ? "border-[#C9894B] bg-[#FFF8F0]"
                        : "border-[#E9E1D8] bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="leaveType"
                      value={value}
                      checked={type === value}
                      onChange={() => setType(value)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-bold text-[#2A211D]">
                      {label}
                    </span>
                    <span className="mt-1 block text-xs text-[#8A817B]">
                      {description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block space-y-2 text-sm font-semibold text-[#4A403A]">
            <span>Lý do *</span>
            <textarea
              required
              minLength={5}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Mô tả ngắn gọn lý do xin phép..."
              className="w-full resize-none rounded-xl border border-[#DED5CC] px-3 py-3 font-normal outline-none focus:border-[#C9894B]"
            />
          </label>

          <label className="block space-y-2 text-sm font-semibold text-[#4A403A]">
            <span>Minh chứng (không bắt buộc)</span>
            <span className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#D9CABE] bg-[#FCFAF8] px-4 py-3 font-normal text-[#6B625C] hover:border-[#C9894B]">
              <FileUp size={18} className="shrink-0 text-[#C9894B]" />
              <span className="min-w-0 truncate">
                {file ? file.name : "Chọn ảnh hoặc PDF, tối đa 5 MB"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </span>
          </label>

          <p className="text-xs leading-5 text-[#8A817B]">
            Nghỉ báo trước cần gửi tối thiểu 48 giờ. Trường hợp đột xuất có thể
            gửi trong ngày và bổ sung thông tin trong vòng 24 giờ sau ca.
          </p>
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#EEE5DD] bg-[#FCFAF8] px-5 py-3 sm:px-6">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-[#D9CABE] bg-white px-5 py-2.5 text-sm font-semibold text-[#5E5650] hover:bg-[#F7F2EC] disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#382118] disabled:opacity-60"
          >
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            {saving ? "Đang gửi..." : supplementing ? "Gửi bổ sung" : "Gửi đơn"}
          </button>
        </div>
      </form>
    </div>
  );
}
