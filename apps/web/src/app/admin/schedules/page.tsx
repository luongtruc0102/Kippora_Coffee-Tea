"use client";

import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, RotateCcw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import WeeklyScheduleBoard from "@/components/staff/weekly-schedule-board";
import AttendanceReportPanel from "@/components/staff/attendance-report-panel";
import ShiftTemplateSettingsModal from "@/components/admin/shift-template-settings-modal";
import { useAppToast } from "@/components/ui/app-toast-provider";
import { getStaffScheduleWeek, updateStaffShiftTemplates } from "@/services/staff-schedule.service";
import { getBranches } from "@/services/store-settings.service";
import type { StaffScheduleWeek } from "@/types/staff-schedule";
import type { UpdateStaffShiftTemplatesInput } from "@/types/staff-schedule";
import type { BranchStatus } from "@/types/store-settings";
import { getCurrentWeekStart, getWeekDates, shiftWeek } from "@/utils/staff-schedule.util";

function formatWeekRange(weekStart: string) {
  const dates = getWeekDates(weekStart);
  const format = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
  return `${format(dates[0])} – ${format(dates[6])}`;
}

export default function AdminSchedulesPage() {
  const { showToast } = useAppToast();
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState(() => getCurrentWeekStart());
  const [data, setData] = useState<StaffScheduleWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    void getBranches(accessToken, controller.signal)
      .then((items) => {
        setBranches(items);
        setBranchId((current) => current ?? items[0]?.id ?? null);
        if (items.length === 0) setLoading(false);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") showToast(error.message, "error");
      });
    return () => controller.abort();
  }, [showToast]);

  const loadWeek = useCallback(async (selectedBranchId: number, week: string, signal?: AbortSignal) => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setLoading(true);
      setData(await getStaffScheduleWeek(accessToken, week, selectedBranchId, signal));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      showToast(error instanceof Error ? error.message : "Không thể tải lịch làm", "error");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!branchId) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadWeek(branchId, weekStart, controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [branchId, loadWeek, weekStart]);

  async function saveTemplates(templates: UpdateStaffShiftTemplatesInput) {
    if (!data) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSavingTemplates(true);
      const updated = await updateStaffShiftTemplates(
        accessToken,
        data.branch.id,
        templates,
      );
      setData((current) => current ? { ...current, templates: updated } : current);
      setSettingsOpen(false);
      showToast("Đã cập nhật giờ hoạt động của ca", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể cập nhật giờ ca", "error");
    } finally {
      setSavingTemplates(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9894B]">Quản lý nhân sự</p>
        <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">Lịch làm toàn hệ thống</h1>
        <p className="mt-1 text-sm text-[#78866B]">Admin xem lịch từng chi nhánh; trưởng chi nhánh là người trực tiếp sắp xếp.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-3 shadow-sm">
        <label className="flex min-w-64 items-center gap-3 rounded-xl border border-[#DED5CC] px-3">
          <CalendarDays size={18} className="text-[#C9894B]" />
          <select value={branchId ?? ""} onChange={(event) => setBranchId(Number(event.target.value))} className="h-11 flex-1 bg-transparent text-sm font-semibold outline-none">
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#F3E9DE]" title="Tuần trước"><ChevronLeft size={19} /></button>
          <p className="min-w-44 text-center text-sm font-bold text-[#4A2C20]">{formatWeekRange(weekStart)}</p>
          <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#F3E9DE]" title="Tuần sau"><ChevronRight size={19} /></button>
          <button type="button" onClick={() => setWeekStart(getCurrentWeekStart())} className="ml-1 flex h-10 items-center gap-2 rounded-xl bg-[#F3E9DE] px-3 text-sm font-semibold text-[#4A2C20]"><RotateCcw size={16} /> Tuần này</button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-[#E9E1D8] bg-white"><LoaderCircle className="animate-spin text-[#C9894B]" /></div>
      ) : data ? (
        <div className={loading ? "opacity-60" : ""}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[#2A211D]">{data.branch.code} · {data.branch.name}</p>
            <div className="flex items-center gap-3">
              <p className="text-sm text-[#78866B]">{data.employees.filter((item) => item.isActive).length} nhân viên · {data.shifts.length} ca</p>
              <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white transition hover:bg-[#382118]"><Settings2 size={17} /> Chỉnh giờ ca</button>
            </div>
          </div>
          <WeeklyScheduleBoard data={data} readOnly />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#DED5CC] bg-white p-12 text-center text-sm text-[#8A817B]">Chưa có chi nhánh để xem lịch.</div>
      )}

      {branchId && <AttendanceReportPanel branchId={branchId} />}

      {settingsOpen && data && (
        <ShiftTemplateSettingsModal
          key={`${data.branch.id}-${data.templates.map((item) => `${item.period}-${item.startTime}-${item.endTime}`).join("-")}`}
          branchName={`${data.branch.code} · ${data.branch.name}`}
          initialTemplates={data.templates}
          saving={savingTemplates}
          onClose={() => setSettingsOpen(false)}
          onSave={(templates) => void saveTemplates(templates)}
        />
      )}
    </div>
  );
}
