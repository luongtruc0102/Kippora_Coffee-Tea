"use client";

import {
  AlertTriangle,
  BellRing,
  Boxes,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Landmark,
  LoaderCircle,
  Search,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getOperationalAlerts,
  markAllOperationalAlertsRead,
  markNotificationRead,
  type OperationalAlertCategory,
  type OperationalAlertsResponse,
  type OperationalAlertSeverity,
} from "@/services/notification.service";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

const categories: Array<{
  value: OperationalAlertCategory | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "Tất cả nhóm" },
  { value: "INVENTORY", label: "Kho & hạn dùng" },
  { value: "PROCUREMENT", label: "Nhập hàng" },
  { value: "FINANCE", label: "Chi phí & quỹ" },
  { value: "STAFFING", label: "Nhân sự & ca làm" },
  { value: "PAYMENT", label: "Đơn & thanh toán" },
  { value: "ACCOUNTING", label: "Lương & kế toán" },
  { value: "SYSTEM", label: "Hệ thống" },
];

const categoryView: Record<
  OperationalAlertCategory,
  { label: string; className: string; icon: typeof Boxes }
> = {
  INVENTORY: {
    label: "Kho & hạn dùng",
    className: "bg-emerald-50 text-emerald-700",
    icon: Boxes,
  },
  PROCUREMENT: {
    label: "Nhập hàng",
    className: "bg-cyan-50 text-cyan-700",
    icon: Landmark,
  },
  FINANCE: {
    label: "Chi phí & quỹ",
    className: "bg-amber-50 text-amber-700",
    icon: CircleDollarSign,
  },
  STAFFING: {
    label: "Nhân sự & ca làm",
    className: "bg-blue-50 text-blue-700",
    icon: UsersRound,
  },
  PAYMENT: {
    label: "Đơn & thanh toán",
    className: "bg-orange-50 text-orange-700",
    icon: Landmark,
  },
  ACCOUNTING: {
    label: "Lương & kế toán",
    className: "bg-violet-50 text-violet-700",
    icon: CircleDollarSign,
  },
  SYSTEM: {
    label: "Hệ thống",
    className: "bg-slate-100 text-slate-700",
    icon: ShieldAlert,
  },
};

const severityView: Record<
  OperationalAlertSeverity,
  { label: string; className: string }
> = {
  CRITICAL: {
    label: "Khẩn cấp",
    className: "bg-red-50 text-red-700 ring-red-100",
  },
  WARNING: {
    label: "Cần chú ý",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  INFO: {
    label: "Thông tin",
    className: "bg-blue-50 text-blue-700 ring-blue-100",
  },
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function OperationalAlertCenter({ mode }: Props) {
  const router = useRouter();
  const [data, setData] = useState<OperationalAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<
    OperationalAlertCategory | "ALL"
  >("ALL");
  const [severity, setSeverity] = useState<OperationalAlertSeverity | "ALL">(
    "ALL",
  );
  const [readStatus, setReadStatus] = useState<"ALL" | "UNREAD" | "READ">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setKeyword(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        const result = await getOperationalAlerts(
          accessToken,
          { q: keyword, category, severity, readStatus, page, limit: 20 },
          signal,
        );
        setData(result);
        setError("");
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải cảnh báo vận hành.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [category, keyword, page, readStatus, severity],
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

  const summaryCards = useMemo(
    () => [
      {
        label: "Tổng cảnh báo",
        value: data?.summary.total ?? 0,
        icon: BellRing,
        className: "bg-[#F3E9DE] text-[#9F642F]",
      },
      {
        label: "Chưa đọc",
        value: data?.summary.unread ?? 0,
        icon: Clock3,
        className: "bg-blue-50 text-blue-700",
      },
      {
        label: "Cần xử lý",
        value: data?.summary.requiresAction ?? 0,
        icon: AlertTriangle,
        className: "bg-amber-50 text-amber-700",
      },
      {
        label: "Khẩn cấp",
        value: data?.summary.critical ?? 0,
        icon: ShieldAlert,
        className: "bg-red-50 text-red-700",
      },
    ],
    [data],
  );

  async function markRead(id: number) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    try {
      await markNotificationRead(accessToken, id);
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === id
                  ? { ...item, isRead: true, readAt: new Date().toISOString() }
                  : item,
              ),
              summary: {
                ...current.summary,
                unread: Math.max(0, current.summary.unread - 1),
                requiresAction: Math.max(
                  0,
                  current.summary.requiresAction -
                    (current.items.find((item) => item.id === id)
                      ?.requiresAction
                      ? 1
                      : 0),
                ),
                critical: Math.max(
                  0,
                  current.summary.critical -
                    (current.items.find((item) => item.id === id)?.severity ===
                    "CRITICAL"
                      ? 1
                      : 0),
                ),
              },
            }
          : current,
      );
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Không thể đánh dấu cảnh báo.",
      );
    }
  }

  async function openAlert(item: OperationalAlertsResponse["items"][number]) {
    if (!item.isRead) await markRead(item.id);
    router.push(item.actionUrl);
  }

  async function markAllRead() {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken || !data?.summary.unread) return;
    try {
      setMarkingAll(true);
      await markAllOperationalAlertsRead(accessToken);
      await loadData();
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Không thể đánh dấu tất cả cảnh báo.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#E9E1D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97832]">
              Kiểm soát vận hành
            </p>
            <h1 className="mt-2 text-2xl font-bold text-[#2A211D] sm:text-3xl">
              Trung tâm cảnh báo
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#78866B]">
              Tổng hợp dữ liệu thật từ kho, nhân sự, tài chính và thanh toán.
              Chọn một cảnh báo để mở đúng màn hình cần xử lý.
            </p>
          </div>
          <button
            type="button"
            disabled={markingAll || !data?.summary.unread}
            onClick={() => void markAllRead()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#DFCDBD] px-4 text-sm font-semibold text-[#5A3828] transition hover:bg-[#FFF8F0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <CheckCheck size={17} />
            )}
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article
              key={card.label}
              className="flex min-h-24 items-center justify-between rounded-2xl border border-[#EEE5DC] p-4"
            >
              <div>
                <p className="text-sm text-[#78866B]">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#2A211D]">
                  {card.value}
                </p>
              </div>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.className}`}
              >
                <card.icon size={20} />
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#EEE5DC] p-4 lg:grid-cols-[minmax(240px,1fr)_210px_180px_170px]">
          <label className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A9089]"
              size={18}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm nội dung cảnh báo..."
              className="h-11 w-full rounded-xl border border-[#E5D8CC] bg-[#FCFAF7] pl-11 pr-4 text-sm outline-none transition focus:border-[#C97832]"
            />
          </label>
          <select
            value={category}
            onChange={(event) => {
              setCategory(
                event.target.value as OperationalAlertCategory | "ALL",
              );
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[#E5D8CC] bg-white px-3 text-sm outline-none focus:border-[#C97832]"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(event) => {
              setSeverity(
                event.target.value as OperationalAlertSeverity | "ALL",
              );
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[#E5D8CC] bg-white px-3 text-sm outline-none focus:border-[#C97832]"
          >
            <option value="ALL">Mọi mức độ</option>
            <option value="CRITICAL">Khẩn cấp</option>
            <option value="WARNING">Cần chú ý</option>
            <option value="INFO">Thông tin</option>
          </select>
          <select
            value={readStatus}
            onChange={(event) => {
              setReadStatus(event.target.value as typeof readStatus);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[#E5D8CC] bg-white px-3 text-sm outline-none focus:border-[#C97832]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="UNREAD">Chưa đọc</option>
            <option value="READ">Đã đọc</option>
          </select>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-[#78866B]">
            <LoaderCircle className="animate-spin" size={20} />
            Đang tổng hợp cảnh báo...
          </div>
        ) : !data?.items.length ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCheck size={25} />
            </span>
            <p className="mt-4 font-semibold text-[#2A211D]">
              Không có cảnh báo phù hợp
            </p>
            <p className="mt-1 text-sm text-[#8A817B]">
              Hệ thống đang vận hành ổn hoặc bộ lọc chưa có dữ liệu.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0E8E0]">
            {data.items.map((item) => {
              const categoryStyle = categoryView[item.category];
              const severityStyle = severityView[item.severity];
              const Icon = categoryStyle.icon;
              return (
                <article
                  key={item.id}
                  className={`flex flex-col gap-4 p-4 transition sm:flex-row sm:items-center sm:p-5 ${
                    item.isRead ? "bg-white" : "bg-[#FFFCF8]"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${categoryStyle.className}`}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-[#2A211D]">{item.title}</h2>
                      {!item.isRead && (
                        <span className="h-2 w-2 rounded-full bg-[#C97832]" />
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${severityStyle.className}`}
                      >
                        {severityStyle.label}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryStyle.className}`}
                      >
                        {categoryStyle.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#6F665F]">
                      {item.message}
                    </p>
                    <p className="mt-1 text-xs text-[#9A9089]">
                      {formatTime(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={() => void markRead(item.id)}
                        className="h-10 rounded-xl border border-[#E5D8CC] px-3 text-sm font-semibold text-[#6B625C] transition hover:bg-[#FAF8F5]"
                      >
                        Đã đọc
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void openAlert(item)}
                      className="h-10 rounded-xl bg-[#542D1E] px-4 text-sm font-semibold text-white transition hover:bg-[#6A3A28]"
                    >
                      {item.requiresAction ? "Xử lý" : "Xem"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#EEE5DC] px-4 py-3">
            <p className="text-sm text-[#8A817B]">
              Trang {data.pagination.page}/{data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5D8CC] disabled:opacity-40"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5D8CC] disabled:opacity-40"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="px-2 text-xs leading-5 text-[#9A9089]">
        {mode === "ADMIN"
          ? "Admin xem cảnh báo của toàn hệ thống. Các thao tác xử lý vẫn được ghi vào nhật ký hoạt động."
          : "Nhân viên trưởng chỉ nhận cảnh báo thuộc chi nhánh mình phụ trách."}
      </p>
    </div>
  );
}
