"use client";

import {
  CalendarClock,
  CalendarOff,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  UserRoundCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import StaffLeaveRequestModal from "@/components/user/staff-leave-request-modal";
import StaffPersonalRecordsPanel from "@/components/user/staff-personal-records-panel";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  cancelStaffLeave,
  getMyLeaveSchedule,
  respondShiftCoverage,
} from "@/services/staff-leave.service";
import type {
  MyLeaveSchedule,
  StaffLeaveRequest,
  StaffLeaveStatus,
} from "@/types/staff-leave";

type Shift = MyLeaveSchedule["shifts"][number];

const statusView: Record<
  StaffLeaveStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700" },
  NEEDS_INFO: {
    label: "Cần bổ sung",
    className: "bg-fuchsia-50 text-fuchsia-700",
  },
  APPROVED: {
    label: "Đã duyệt",
    className: "bg-emerald-50 text-emerald-700",
  },
  REJECTED: { label: "Đã từ chối", className: "bg-red-50 text-red-600" },
  CANCELLED: { label: "Đã hủy", className: "bg-slate-100 text-slate-600" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WorkSchedulePage() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [data, setData] = useState<MyLeaveSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [cancelRequest, setCancelRequest] = useState<StaffLeaveRequest | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);
  const [respondingCoverageId, setRespondingCoverageId] = useState<
    number | null
  >(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      const storedUser = sessionStorage.getItem("user");
      if (!accessToken || !storedUser) {
        router.replace("/login?redirect=/work-schedule");
        return;
      }
      try {
        const user = JSON.parse(storedUser) as { role?: string };
        if (user.role !== "STAFF") {
          router.replace("/");
          return;
        }
        setLoading(true);
        const result = await getMyLeaveSchedule(accessToken, signal);
        setData(result);
        setError("");
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải lịch làm.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadData(controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadData]);

  const sortedShifts = useMemo(
    () =>
      data?.shifts
        .slice()
        .sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ) ?? [],
    [data],
  );
  const pendingCount = sortedShifts.filter(
    (shift) =>
      shift.leaveRequest &&
      ["PENDING", "NEEDS_INFO"].includes(shift.leaveRequest.status),
  ).length;
  const approvedCount = sortedShifts.filter(
    (shift) => shift.leaveRequest?.status === "APPROVED",
  ).length;

  function updateRequest(saved: StaffLeaveRequest) {
    setData((current) =>
      current
        ? {
            ...current,
            shifts: current.shifts.map((shift) =>
              shift.id === saved.staffShiftId
                ? { ...shift, leaveRequest: saved }
                : shift,
            ),
          }
        : current,
    );
    setEditingShift(null);
  }

  function saveRequest(saved: StaffLeaveRequest) {
    updateRequest(saved);
    showToast("Đã gửi yêu cầu nghỉ đến trưởng chi nhánh.", "success");
  }

  async function confirmCancel() {
    if (!cancelRequest) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setCancelling(true);
      const saved = await cancelStaffLeave(accessToken, cancelRequest.id);
      updateRequest(saved);
      setCancelRequest(null);
      showToast("Đã hủy yêu cầu nghỉ.", "success");
    } catch (cancelError) {
      showToast(
        cancelError instanceof Error
          ? cancelError.message
          : "Không thể hủy yêu cầu.",
        "error",
      );
    } finally {
      setCancelling(false);
    }
  }

  async function respondCoverage(
    coverageId: number,
    action: "ACCEPTED" | "DECLINED",
  ) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setRespondingCoverageId(coverageId);
      await respondShiftCoverage(accessToken, coverageId, action);
      showToast(
        action === "ACCEPTED"
          ? "Đã nhận làm thay. Hệ thống sẽ tính tăng ca theo thời gian thực tế."
          : "Đã từ chối và thông báo cho trưởng chi nhánh.",
        "success",
      );
      await loadData();
    } catch (responseError) {
      showToast(
        responseError instanceof Error
          ? responseError.message
          : "Không thể phản hồi phân công.",
        "error",
      );
    } finally {
      setRespondingCoverageId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
          Khu vực nhân viên
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#2A211D]">
          Ca làm của tôi
        </h1>
        <p className="mt-2 text-sm text-[#78866B]">
          Xem lịch được xếp, gửi yêu cầu xin phép và phản hồi phân công làm
          thay.
        </p>
      </div>

      {data && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#78866B]">Chi nhánh</p>
            <p className="mt-2 font-bold text-[#2A211D]">
              {data.branch.code} · {data.branch.name}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#78866B]">Đang chờ xử lý</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">
              {pendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#78866B]">Nghỉ đã duyệt</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">
              {approvedCount}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-[#E8D9C9] bg-[#FFF8F0] p-4 text-sm leading-6 text-[#6B4D38]">
        <strong>Quy định:</strong> việc riêng cần báo trước ít nhất 48 giờ. Nếu
        ốm, tai nạn hoặc có việc đột xuất trong ngày, chọn “Nghỉ đột xuất”;
        trưởng chi nhánh có thể yêu cầu bổ sung minh chứng trong vòng 24 giờ sau
        ca.
      </div>

      {data && (data.coverageAssignments?.length ?? 0) > 0 && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-[#D9EBDD] bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#E5F0E7] bg-emerald-50/60 px-5 py-4">
            <UserRoundCheck className="text-emerald-700" size={21} />
            <div>
              <h2 className="font-bold text-[#2A211D]">Phân công làm thay</h2>
              <p className="mt-0.5 text-xs text-[#6B756D]">
                Chỉ phân công đã xác nhận mới được nối giờ và tính tăng ca.
              </p>
            </div>
          </div>
          <div className="divide-y divide-[#EDF3EE]">
            {(data.coverageAssignments ?? []).map((coverage) => (
              <article
                key={coverage.id}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="text-sm text-[#5E5650]">
                  <p className="font-bold text-[#2A211D]">
                    Làm thay cho{" "}
                    {coverage.leaveRequest.employee.fullName ||
                      coverage.leaveRequest.employee.email}
                  </p>
                  <p className="mt-1">
                    {formatDate(coverage.startAt)} ·{" "}
                    {formatTime(coverage.startAt)} –{" "}
                    {formatTime(coverage.endAt)}
                  </p>
                  <p className="mt-1 text-xs text-[#8A817B]">
                    Lý do: {coverage.leaveRequest.reason}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#F7F2EC] px-3 py-1.5 text-xs font-semibold text-[#6B625C]">
                    {coverage.status === "PENDING"
                      ? "Chờ bạn xác nhận"
                      : coverage.status === "ACCEPTED"
                        ? "Đã nhận làm thay"
                        : coverage.status === "DECLINED"
                          ? "Đã từ chối"
                          : coverage.status === "COMPLETED"
                            ? "Đã hoàn thành"
                            : "Đã hủy"}
                  </span>
                  {coverage.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={respondingCoverageId === coverage.id}
                        onClick={() =>
                          void respondCoverage(coverage.id, "DECLINED")
                        }
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        disabled={respondingCoverageId === coverage.id}
                        onClick={() =>
                          void respondCoverage(coverage.id, "ACCEPTED")
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {respondingCoverageId === coverage.id && (
                          <LoaderCircle size={15} className="animate-spin" />
                        )}
                        Nhận làm thay
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-[#E9E1D8] bg-white py-16 text-[#78866B] shadow-sm">
          <LoaderCircle size={20} className="animate-spin" /> Đang tải lịch
          làm...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
          <TriangleAlert className="mx-auto" />
          <p className="mt-2">{error}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-4 rounded-xl bg-[#4A2C20] px-4 py-2 text-sm font-semibold text-white"
          >
            Thử lại
          </button>
        </div>
      ) : sortedShifts.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[#DCCFC3] bg-white px-6 py-16 text-center shadow-sm">
          <CalendarClock className="mx-auto text-[#C9894B]" size={44} />
          <h2 className="mt-4 text-lg font-bold text-[#2A211D]">
            Chưa có ca làm
          </h2>
          <p className="mt-2 text-sm text-[#78866B]">
            Lịch mới sẽ xuất hiện tại đây sau khi trưởng chi nhánh sắp ca.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {sortedShifts.map((shift) => {
            const request = shift.leaveRequest;
            const canCreate = !request;
            const canCancel =
              request &&
              ["PENDING", "NEEDS_INFO"].includes(request.status) &&
              new Date(data?.serverTime ?? 0).getTime() <
                new Date(shift.endAt).getTime();
            return (
              <article
                key={shift.id}
                className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#C9894B]">
                      <Clock3 size={22} />
                    </span>
                    <div>
                      <h2 className="font-bold capitalize text-[#2A211D]">
                        {formatDate(shift.startAt)}
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-[#9F642F]">
                        {formatTime(shift.startAt)} – {formatTime(shift.endAt)}
                      </p>
                      {shift.note && (
                        <p className="mt-1 text-sm text-[#8A817B]">
                          {shift.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {shift.hasAttendance && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        <CheckCircle2 size={14} /> Đã chấm công
                      </span>
                    )}
                    {request && (
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusView[request.status].className}`}
                      >
                        {statusView[request.status].label}
                      </span>
                    )}
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => setEditingShift(shift)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#382118]"
                      >
                        <CalendarOff size={16} /> Xin nghỉ / đi trễ / về sớm
                      </button>
                    )}
                    {request?.status === "NEEDS_INFO" && (
                      <button
                        type="button"
                        onClick={() => setEditingShift(shift)}
                        className="rounded-xl bg-fuchsia-50 px-4 py-2.5 text-sm font-semibold text-fuchsia-700 hover:bg-fuchsia-100"
                      >
                        Bổ sung ngay
                      </button>
                    )}
                    {request && canCancel && (
                      <button
                        type="button"
                        onClick={() => setCancelRequest(request)}
                        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                </div>

                {request && (
                  <div className="mt-4 border-t border-[#F0E8E0] pt-4 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <p className="text-[#6B625C]">
                        <span className="text-[#9A9089]">Hình thức:</span>{" "}
                        {request.scope === "LATE_ARRIVAL"
                          ? "Xin đến trễ" +
                            (request.requestedStartAt
                              ? " lúc " + formatTime(request.requestedStartAt)
                              : "")
                          : request.scope === "EARLY_LEAVE"
                            ? `Xin về sớm${
                                request.requestedEndAt
                                  ? ` lúc ${formatTime(request.requestedEndAt)}`
                                  : ""
                              }`
                            : request.type === "PLANNED"
                              ? "Nghỉ báo trước"
                              : "Nghỉ đột xuất"}
                      </p>
                      <p className="text-[#6B625C]">
                        <span className="text-[#9A9089]">Lý do:</span>{" "}
                        {request.reason}
                      </p>
                    </div>
                    {request.reviewNote && (
                      <p className="mt-3 rounded-xl bg-[#FAF8F5] px-4 py-3 text-[#5E5650]">
                        <strong>Phản hồi:</strong> {request.reviewNote}
                      </p>
                    )}
                    {request.evidenceUrl && (
                      <a
                        href={request.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[#C2763D] hover:underline"
                      >
                        Xem minh chứng <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <StaffPersonalRecordsPanel />

      {editingShift && (
        <StaffLeaveRequestModal
          shift={editingShift}
          request={editingShift.leaveRequest}
          onClose={() => setEditingShift(null)}
          onSaved={saveRequest}
        />
      )}

      {cancelRequest && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancelling)
              setCancelRequest(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-[#E9E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#2A211D]">
                  Hủy đơn xin nghỉ?
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6B625C]">
                  Trưởng chi nhánh sẽ nhận được thông báo rằng yêu cầu này đã bị
                  hủy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelRequest(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#F7F2EC]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelRequest(null)}
                className="rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#5E5650]"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void confirmCancel()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {cancelling && (
                  <LoaderCircle size={16} className="animate-spin" />
                )}
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
