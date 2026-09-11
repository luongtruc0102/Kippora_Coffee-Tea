"use client";

import {
  CalendarOff,
  Check,
  Clock3,
  ExternalLink,
  FileQuestion,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  assignShiftCoverage,
  getBranchLeaveRequests,
  getShiftCoverageCandidates,
  reviewStaffLeave,
} from "@/services/staff-leave.service";
import type {
  BranchLeaveRequests,
  ReviewStaffLeaveInput,
  StaffLeaveRequest,
  StaffLeaveStatus,
  ShiftCoverageCandidate,
} from "@/types/staff-leave";

type Filter = "ALL" | StaffLeaveStatus;
type ReviewAction = ReviewStaffLeaveInput["action"];

const filters: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "NEEDS_INFO", label: "Chờ bổ sung" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const statuses: Record<StaffLeaveStatus, { label: string; className: string }> =
  {
    PENDING: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700" },
    NEEDS_INFO: {
      label: "Chờ bổ sung",
      className: "bg-fuchsia-50 text-fuchsia-700",
    },
    APPROVED: {
      label: "Đã duyệt",
      className: "bg-emerald-50 text-emerald-700",
    },
    REJECTED: { label: "Đã từ chối", className: "bg-red-50 text-red-600" },
    CANCELLED: { label: "Đã hủy", className: "bg-slate-100 text-slate-600" },
  };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ReviewModal({
  request,
  onClose,
  onReviewed,
}: {
  request: StaffLeaveRequest;
  onClose: () => void;
  onReviewed: (request: StaffLeaveRequest) => void;
}) {
  const reassigning =
    request.status === "APPROVED" && request.scope === "LATE_ARRIVAL";
  const [action, setAction] = useState<ReviewAction>("APPROVED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<ShiftCoverageCandidate[]>([]);
  const [coveringEmployeeId, setCoveringEmployeeId] = useState("");
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    if (request.scope !== "LATE_ARRIVAL") return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setLoadingCandidates(true);
      void getShiftCoverageCandidates(
        accessToken,
        request.id,
        controller.signal,
      )
        .then(setCandidates)
        .catch((loadError) => {
          if (loadError instanceof Error && loadError.name === "AbortError")
            return;
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải nhân viên ca trước.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingCandidates(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [request.id, request.scope]);

  async function submit() {
    const normalizedNote = note.trim();
    if (action !== "APPROVED" && normalizedNote.length < 3) {
      setError("Cần nhập lý do khi từ chối hoặc yêu cầu bổ sung.");
      return;
    }
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      setSaving(true);
      setError("");
      if (reassigning && !coveringEmployeeId) {
        setError("Hãy chọn một nhân viên của ca trước.");
        return;
      }
      const saved = reassigning
        ? await assignShiftCoverage(
            accessToken,
            request.id,
            Number(coveringEmployeeId),
          )
        : await reviewStaffLeave(accessToken, request.id, {
            action,
            note: normalizedNote || undefined,
            coveringEmployeeId:
              action === "APPROVED" && coveringEmployeeId
                ? Number(coveringEmployeeId)
                : undefined,
          });
      onReviewed(saved);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể xử lý yêu cầu nghỉ.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#EEE5DD] px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-[#2A211D]">
              {reassigning
                ? "Phân công lại người làm thay"
                : request.scope === "LATE_ARRIVAL"
                  ? "Duyệt yêu cầu đến trễ"
                  : request.scope === "EARLY_LEAVE"
                    ? "Duyệt yêu cầu về sớm"
                    : "Duyệt yêu cầu nghỉ"}
            </h2>
            <p className="mt-1 text-sm text-[#8A817B]">
              {request.employee.fullName || request.employee.email} ·{" "}
              {formatDateTime(request.staffShift.startAt)}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#F7F2EC]"
          >
            <X size={19} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4 text-sm leading-6 text-[#5E5650]">
            <p>
              <strong>Phạm vi:</strong>{" "}
              {request.scope === "LATE_ARRIVAL"
                ? "Xin đến trễ"
                : request.scope === "EARLY_LEAVE"
                  ? "Xin về sớm"
                  : "Nghỉ cả ca"}
            </p>
            {request.requestedStartAt && (
              <p>
                <strong>Giờ dự kiến đến:</strong>{" "}
                {formatDateTime(request.requestedStartAt)}
              </p>
            )}
            {request.requestedEndAt && (
              <p>
                <strong>Giờ xin về:</strong>{" "}
                {formatDateTime(request.requestedEndAt)}
              </p>
            )}
            <p>
              <strong>Hình thức:</strong>{" "}
              {request.type === "PLANNED" ? "Báo trước" : "Đột xuất"}
            </p>
            <p>
              <strong>Lý do:</strong> {request.reason}
            </p>
            {request.evidenceUrl && (
              <a
                href={request.evidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#C2763D] hover:underline"
              >
                Xem minh chứng <ExternalLink size={14} />
              </a>
            )}
          </div>

          {!reassigning && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-[#4A403A]">
                Quyết định
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    [
                      "APPROVED",
                      request.scope === "LATE_ARRIVAL"
                        ? "Duyệt đến trễ"
                        : request.scope === "EARLY_LEAVE"
                          ? "Duyệt về sớm"
                          : "Duyệt nghỉ",
                      "border-emerald-500 bg-emerald-50 text-emerald-700",
                    ],
                    [
                      "NEEDS_INFO",
                      "Yêu cầu bổ sung",
                      "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700",
                    ],
                    [
                      "REJECTED",
                      "Từ chối",
                      "border-red-400 bg-red-50 text-red-600",
                    ],
                  ] as const
                ).map(([value, label, activeClass]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAction(value)}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                      action === value
                        ? activeClass
                        : "border-[#E9E1D8] text-[#6B625C]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {request.scope === "LATE_ARRIVAL" && action === "APPROVED" && (
            <label className="block space-y-2 text-sm font-semibold text-[#4A403A]">
              <span>
                Nhân viên ca trước làm thay{" "}
                {reassigning ? "*" : "(không bắt buộc)"}
              </span>
              <select
                value={coveringEmployeeId}
                disabled={loadingCandidates}
                onChange={(event) => setCoveringEmployeeId(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#DED5CC] bg-white px-3 font-normal outline-none focus:border-[#C9894B] disabled:opacity-60"
              >
                <option value="">
                  {loadingCandidates
                    ? "Đang tải nhân viên ca trước..."
                    : reassigning
                      ? "Chọn nhân viên ca trước"
                      : "Không phân công người làm thay"}
                </option>
                {candidates.map((candidate) => (
                  <option
                    key={candidate.employee.id}
                    value={candidate.employee.id}
                  >
                    {candidate.employee.fullName || candidate.employee.email} ·
                    ca trước kết thúc{" "}
                    {formatDateTime(candidate.previousShiftEndAt)}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-normal leading-5 text-[#8A817B]">
                Người được chọn phải tự xác nhận trước ca. Thời gian ở lại thực
                tế được tính tăng ca và tự kết thúc khi người xin phép đến.
              </span>
            </label>
          )}

          {!reassigning && (
            <label className="block space-y-2 text-sm font-semibold text-[#4A403A]">
              <span>
                Phản hồi {action === "APPROVED" ? "(không bắt buộc)" : "*"}
              </span>
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  action === "NEEDS_INFO"
                    ? "Nêu rõ thông tin hoặc minh chứng cần bổ sung..."
                    : action === "REJECTED"
                      ? "Nêu lý do từ chối..."
                      : "Ghi chú cho nhân viên..."
                }
                className="w-full resize-none rounded-xl border border-[#DED5CC] px-3 py-3 font-normal outline-none focus:border-[#C9894B]"
              />
            </label>
          )}
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
            className="rounded-xl border border-[#D9CABE] bg-white px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {saving
              ? "Đang lưu..."
              : reassigning
                ? "Gửi lời mời mới"
                : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveRequestManager() {
  const { showToast } = useAppToast();
  const [data, setData] = useState<BranchLeaveRequests | null>(null);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffLeaveRequest | null>(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        const result = await getBranchLeaveRequests(
          accessToken,
          undefined,
          signal,
        );
        setData(result);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error ? error.message : "Không thể tải đơn xin nghỉ",
          "error",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [showToast],
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

  const items = useMemo(
    () =>
      data?.items.filter(
        (item) => filter === "ALL" || item.status === filter,
      ) ?? [],
    [data, filter],
  );

  function reviewed(saved: StaffLeaveRequest) {
    setData((current) =>
      current
        ? {
            ...current,
            pendingCount:
              current.items.find((item) => item.id === saved.id)?.status ===
              "PENDING"
                ? Math.max(0, current.pendingCount - 1)
                : current.pendingCount,
            items: current.items.map((item) =>
              item.id === saved.id ? saved : item,
            ),
          }
        : current,
    );
    setSelected(null);
    showToast("Đã cập nhật yêu cầu và thông báo cho nhân viên.", "success");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#EEE5DD] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#C9894B]">
            <CalendarOff size={21} />
          </span>
          <div>
            <h2 className="font-bold text-[#2A211D]">
              Đơn xin nghỉ / đi trễ / về sớm
            </h2>
            <p className="mt-0.5 text-sm text-[#8A817B]">
              {data?.pendingCount ?? 0} yêu cầu đang chờ trưởng chi nhánh xử lý
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filter === item.value
                  ? "bg-[#4A2C20] text-white"
                  : "bg-[#F7F2EC] text-[#6B625C] hover:bg-[#EEE3D8]"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            title="Làm mới"
            onClick={() => void loadData()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F2EC] text-[#6B625C]"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[#8A817B]">
          <LoaderCircle size={17} className="animate-spin" /> Đang tải yêu
          cầu...
        </p>
      ) : items.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#8A817B]">
          <FileQuestion className="mx-auto mb-3 text-[#C9BEB4]" size={36} />
          Không có yêu cầu xin phép ở trạng thái này.
        </div>
      ) : (
        <div className="divide-y divide-[#F0E8E0]">
          {items.map((request) => (
            <article
              key={request.id}
              className="grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr_1.4fr_auto] lg:items-center"
            >
              <div>
                <p className="font-bold text-[#2A211D]">
                  {request.employee.fullName || "Chưa cập nhật tên"}
                </p>
                <p className="mt-1 text-xs text-[#8A817B]">
                  {request.employee.email}
                </p>
              </div>
              <div className="text-sm text-[#5E5650]">
                <p className="inline-flex items-center gap-1.5 font-semibold text-[#9F642F]">
                  <Clock3 size={15} />{" "}
                  {formatDateTime(request.staffShift.startAt)}
                </p>
                <p className="mt-1 text-xs text-[#8A817B]">
                  đến {formatDateTime(request.staffShift.endAt)}
                </p>
              </div>
              <div className="min-w-0 text-sm text-[#5E5650]">
                <p className="font-semibold text-[#2A211D]">
                  {request.scope === "LATE_ARRIVAL"
                    ? `Đến trễ${request.requestedStartAt ? ` · ${formatDateTime(request.requestedStartAt)}` : ""}`
                    : request.scope === "EARLY_LEAVE"
                      ? `Về sớm${request.requestedEndAt ? ` · ${formatDateTime(request.requestedEndAt)}` : ""}`
                      : request.type === "PLANNED"
                        ? "Nghỉ báo trước"
                        : "Nghỉ đột xuất"}
                </p>
                <p className="mt-1 line-clamp-2">{request.reason}</p>
                {request.reviewNote && (
                  <p className="mt-1 text-xs text-[#8A817B]">
                    Phản hồi: {request.reviewNote}
                  </p>
                )}
                {request.coverage && (
                  <p className="mt-1 text-xs text-[#8A817B]">
                    Làm thay:{" "}
                    {request.coverage.coveringEmployee.fullName ||
                      request.coverage.coveringEmployee.email}{" "}
                    ·{" "}
                    {request.coverage.status === "PENDING"
                      ? "chờ xác nhận"
                      : request.coverage.status === "ACCEPTED"
                        ? "đã nhận"
                        : request.coverage.status === "DECLINED"
                          ? "đã từ chối"
                          : request.coverage.status === "COMPLETED"
                            ? "đã hoàn thành"
                            : "đã hủy"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statuses[request.status].className}`}
                >
                  {statuses[request.status].label}
                </span>
                {request.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => setSelected(request)}
                    className="rounded-xl bg-[#4A2C20] px-4 py-2 text-sm font-semibold text-white hover:bg-[#382118]"
                  >
                    Xử lý
                  </button>
                )}
                {request.status === "APPROVED" &&
                  request.scope === "LATE_ARRIVAL" &&
                  (!request.coverage ||
                    ["PENDING", "DECLINED", "CANCELLED"].includes(
                      request.coverage.status,
                    )) && (
                    <button
                      type="button"
                      onClick={() => setSelected(request)}
                      className="rounded-xl border border-[#C9894B] px-4 py-2 text-sm font-semibold text-[#9F642F] hover:bg-[#FFF8F0]"
                    >
                      {request.coverage?.status === "PENDING"
                        ? "Đổi người"
                        : request.coverage
                          ? "Phân công lại"
                          : "Phân công"}
                    </button>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <ReviewModal
          request={selected}
          onClose={() => setSelected(null)}
          onReviewed={reviewed}
        />
      )}
    </section>
  );
}
