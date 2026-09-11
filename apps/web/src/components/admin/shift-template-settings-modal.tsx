"use client";

import { Clock3, LoaderCircle, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  StaffShiftPeriod,
  StaffShiftTemplate,
  UpdateStaffShiftTemplatesInput,
} from "@/types/staff-schedule";

const labels: Record<StaffShiftPeriod, string> = {
  MORNING: "Ca sáng",
  AFTERNOON: "Ca chiều",
  EVENING: "Ca tối",
};

type Props = {
  branchName: string;
  initialTemplates: StaffShiftTemplate[];
  saving: boolean;
  onClose: () => void;
  onSave: (templates: UpdateStaffShiftTemplatesInput) => void;
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function ShiftTemplateSettingsModal({
  branchName,
  initialTemplates,
  saving,
  onClose,
  onSave,
}: Props) {
  const [templates, setTemplates] = useState<UpdateStaffShiftTemplatesInput>(
    initialTemplates.map(({ period, startTime, endTime }) => ({
      period,
      startTime,
      endTime,
    })),
  );
  const [error, setError] = useState("");
  const ordered = useMemo(
    () =>
      (["MORNING", "AFTERNOON", "EVENING"] as StaffShiftPeriod[]).map(
        (period) => templates.find((item) => item.period === period)!,
      ),
    [templates],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function change(
    period: StaffShiftPeriod,
    field: "startTime" | "endTime",
    value: string,
  ) {
    setError("");
    setTemplates((current) =>
      current.map((item) =>
        item.period === period ? { ...item, [field]: value } : item,
      ),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      ordered.some(
        (item) => toMinutes(item.startTime) >= toMinutes(item.endTime),
      )
    ) {
      setError("Giờ kết thúc của mỗi ca phải sau giờ bắt đầu.");
      return;
    }
    if (
      toMinutes(ordered[0].endTime) > toMinutes(ordered[1].startTime) ||
      toMinutes(ordered[1].endTime) > toMinutes(ordered[2].startTime)
    ) {
      setError("Các khung ca không được trùng thời gian.");
      return;
    }
    onSave(ordered);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-template-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#A45F2F]">
              <Settings2 size={21} />
            </span>
            <div>
              <h2 id="shift-template-title" className="text-xl font-bold text-[#1F1B18]">
                Giờ hoạt động của ca
              </h2>
              <p className="mt-1 text-sm text-[#78866B]">{branchName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-xl text-[#78866B] hover:bg-[#FAF8F5]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 p-6">
          <p className="mb-4 text-sm leading-6 text-[#6B625C]">
            Giờ này được dùng làm mặc định khi trưởng chi nhánh kéo nhân viên vào lịch. Các ca đã xếp trước đó không bị thay đổi.
          </p>
          {ordered.map((template) => (
            <div key={template.period} className="grid items-end gap-3 rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4 sm:grid-cols-[1fr_160px_160px]">
              <div>
                <p className="font-bold text-[#2A211D]">{labels[template.period]}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-[#8A817B]"><Clock3 size={13} /> Khung giờ chuẩn</p>
              </div>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-[#6B625C]">Bắt đầu</span>
                <input type="time" required disabled={saving} value={template.startTime} onChange={(event) => change(template.period, "startTime", event.target.value)} className="h-11 w-full rounded-xl border border-[#DED5CC] bg-white px-3 text-sm outline-none focus:border-[#C9894B]" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-[#6B625C]">Kết thúc</span>
                <input type="time" required disabled={saving} value={template.endTime} onChange={(event) => change(template.period, "endTime", event.target.value)} className="h-11 w-full rounded-xl border border-[#DED5CC] bg-white px-3 text-sm outline-none focus:border-[#C9894B]" />
              </label>
            </div>
          ))}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E9E1D8] bg-[#FCFAF8] px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-[#DED5CC] bg-white px-5 py-3 text-sm font-semibold text-[#5E5650]">Hủy</button>
          <button type="submit" disabled={saving} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <LoaderCircle size={17} className="animate-spin" />}
            Lưu giờ ca
          </button>
        </div>
      </form>
    </div>
  );
}
