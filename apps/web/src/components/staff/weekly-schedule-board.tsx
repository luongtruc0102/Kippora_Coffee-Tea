"use client";

import { Clock3, GripVertical, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";

import type {
  ScheduleEmployee,
  StaffScheduleWeek,
  StaffShift,
  StaffShiftPeriod,
  StaffShiftTemplate,
} from "@/types/staff-schedule";
import {
  formatScheduleTime,
  getVietnamDateKey,
  getWeekDates,
} from "@/utils/staff-schedule.util";

type Slot = {
  id: StaffShiftPeriod;
  label: string;
  description: string;
  startTime: string;
  endTime: string;
};

const fallbackTemplates: StaffShiftTemplate[] = [
  {
    id: null,
    branchId: 0,
    period: "MORNING",
    startTime: "06:00",
    endTime: "12:00",
  },
  {
    id: null,
    branchId: 0,
    period: "AFTERNOON",
    startTime: "12:00",
    endTime: "18:00",
  },
  {
    id: null,
    branchId: 0,
    period: "EVENING",
    startTime: "18:00",
    endTime: "22:00",
  },
];

const slotLabels: Record<StaffShiftPeriod, string> = {
  MORNING: "Ca sáng",
  AFTERNOON: "Ca chiều",
  EVENING: "Ca tối",
};

type Props = {
  data: StaffScheduleWeek;
  readOnly?: boolean;
  onCreate?: (
    employee: ScheduleEmployee,
    date: string,
    defaultStart: string,
    defaultEnd: string,
  ) => void;
  onEdit?: (shift: StaffShift) => void;
  onDelete?: (shift: StaffShift) => void;
};

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getShiftSlot(shift: StaffShift, slots: Slot[]): Slot["id"] {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(shift.startAt));
  const read = (type: "hour" | "minute") =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const shiftMinutes = read("hour") * 60 + read("minute");
  const afternoonStart = timeToMinutes(
    slots.find((slot) => slot.id === "AFTERNOON")?.startTime ?? "12:00",
  );
  const eveningStart = timeToMinutes(
    slots.find((slot) => slot.id === "EVENING")?.startTime ?? "18:00",
  );
  if (shiftMinutes < afternoonStart) return "MORNING";
  if (shiftMinutes < eveningStart) return "AFTERNOON";
  return "EVENING";
}

function formatDay(dateKey: string, includeWeekday = true) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    ...(includeWeekday ? { weekday: "short" } : {}),
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

export default function WeeklyScheduleBoard({
  data,
  readOnly = false,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const dates = useMemo(() => getWeekDates(data.weekStart), [data.weekStart]);
  const slots = useMemo<Slot[]>(() => {
    const templates = data.templates?.length === 3
      ? data.templates
      : fallbackTemplates;
    return templates.map((template) => ({
      id: template.period,
      label: slotLabels[template.period],
      description: `${template.startTime} – ${template.endTime}`,
      startTime: template.startTime,
      endTime: template.endTime,
    }));
  }, [data.templates]);
  const activeEmployees = data.employees.filter((employee) => employee.isActive);
  const today = getVietnamDateKey(new Date());

  function beginDrag(event: DragEvent, employeeId: number) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/staff-id", String(employeeId));
  }

  function assign(employeeId: number, date: string, slot: Slot) {
    const employee = activeEmployees.find((item) => item.id === employeeId);
    if (!employee || !onCreate) return;
    onCreate(employee, date, slot.startTime, slot.endTime);
    setSelectedEmployeeId(null);
  }

  function dropEmployee(event: DragEvent, date: string, slot: Slot) {
    event.preventDefault();
    const employeeId = Number(event.dataTransfer.getData("text/staff-id"));
    if (Number.isInteger(employeeId)) assign(employeeId, date, slot);
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-[#2A211D]">Danh sách nhân viên</h2>
              <p className="mt-1 text-xs text-[#8A817B]">
                Kéo tên vào ô lịch, hoặc chọn tên rồi bấm vào ô trên điện thoại.
              </p>
            </div>
            {selectedEmployeeId && (
              <button
                type="button"
                onClick={() => setSelectedEmployeeId(null)}
                className="text-xs font-semibold text-[#A45F2F]"
              >
                Bỏ chọn
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {activeEmployees.map((employee) => {
              const selected = selectedEmployeeId === employee.id;
              return (
                <button
                  key={employee.id}
                  type="button"
                  draggable
                  onDragStart={(event) => beginDrag(event, employee.id)}
                  onClick={() =>
                    setSelectedEmployeeId(selected ? null : employee.id)
                  }
                  className={`inline-flex cursor-grab items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition active:cursor-grabbing ${
                    selected
                      ? "border-[#4A2C20] bg-[#4A2C20] text-white"
                      : "border-[#E9E1D8] bg-[#FCFAF8] text-[#4A2C20] hover:border-[#C9894B]"
                  }`}
                >
                  <GripVertical size={15} />
                  {employee.fullName || employee.email}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#DED5CC] bg-white shadow-sm">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[180px_repeat(7,minmax(140px,1fr))] border-b border-[#DED5CC] bg-[#F7F2EC]">
            <div className="sticky left-0 z-20 border-r border-[#DED5CC] bg-[#F7F2EC] p-4 text-xs font-bold uppercase tracking-wide text-[#78866B]">
              Khung ca
            </div>
            {dates.map((date) => (
              <div
                key={date}
                className={`border-r border-[#DED5CC] p-3 text-center last:border-r-0 ${
                  date === today ? "bg-[#FFF5E9]" : ""
                }`}
              >
                <p className="text-sm font-bold capitalize text-[#2A211D]">
                  {formatDay(date)}
                </p>
                {date === today && (
                  <span className="mt-1 inline-block rounded-full bg-[#C9894B] px-2 py-0.5 text-[10px] font-bold text-white">
                    Hôm nay
                  </span>
                )}
              </div>
            ))}
          </div>

          {slots.map((slot) => (
            <div
              key={slot.id}
              className="grid grid-cols-[180px_repeat(7,minmax(140px,1fr))] border-b border-[#DED5CC] last:border-b-0"
            >
              <div className="sticky left-0 z-10 border-r border-[#DED5CC] bg-[#FCFAF8] p-4">
                <p className="font-bold text-[#4A2C20]">{slot.label}</p>
                <p className="mt-1 text-xs text-[#8A817B]">{slot.description}</p>
              </div>

              {dates.map((date) => {
                const cellShifts = data.shifts.filter(
                  (shift) =>
                    getVietnamDateKey(shift.startAt) === date &&
                    getShiftSlot(shift, slots) === slot.id,
                );

                return (
                  <div
                    key={`${date}-${slot.id}`}
                    onDragOver={(event) => {
                      if (!readOnly) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!readOnly) dropEmployee(event, date, slot);
                    }}
                    onClick={() => {
                      if (!readOnly && selectedEmployeeId) {
                        assign(selectedEmployeeId, date, slot);
                      }
                    }}
                    className={`min-h-36 space-y-1.5 border-r border-[#DED5CC] p-1.5 last:border-r-0 ${
                      readOnly
                        ? "bg-white"
                        : "bg-white transition hover:bg-[#FFFDF9]"
                    } ${selectedEmployeeId ? "cursor-copy" : ""}`}
                  >
                    {cellShifts.map((shift) => (
                      <div
                        key={shift.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit?.(shift);
                        }}
                        className={`group rounded-lg border border-[#E8D8CA] bg-[#FFF8F0] p-1.5 ${
                          readOnly ? "" : "cursor-pointer hover:border-[#C9894B]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] text-[#4A2C20]">
                            <UserRound size={12} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-bold leading-4 text-[#2A211D]">
                              {shift.employee.fullName || shift.employee.email}
                            </p>
                            <p className="flex items-center gap-0.5 whitespace-nowrap text-[9px] font-semibold leading-3.5 text-[#A45F2F]">
                              <Clock3 size={9} />
                              {formatScheduleTime(shift.startAt)}–{formatScheduleTime(shift.endAt)}
                            </p>
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              title="Xóa ca"
                              aria-label={`Xóa ca của ${shift.employee.fullName || shift.employee.email}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDelete?.(shift);
                              }}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-500 opacity-75 transition hover:bg-red-50 hover:opacity-100 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        {shift.note && (
                          <p className="mt-0.5 truncate pl-7 text-[9px] leading-3 text-[#8A817B]">
                            {shift.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
