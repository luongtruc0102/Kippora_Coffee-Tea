"use client";

import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessageCircleMore,
  Search,
  Send,
  ReceiptText,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppToast } from "@/components/ui/app-toast-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getSupportConversation,
  getSupportConversations,
  getSupportMetrics,
  sendSupportReply,
  transferSupportConversation,
  updateSupportStatus,
} from "@/services/support.service";
import { getPublicStoreLocations } from "@/services/store-settings.service";
import type {
  SupportConversation,
  SupportConversationList,
  SupportConversationStatus,
  SupportMetrics,
} from "@/types/support";
import type { PublicStoreLocation } from "@/types/store-settings";

const emptyList: SupportConversationList = {
  summary: { open: 0, waiting: 0, resolved: 0, unread: 0 },
  items: [],
};

const statusMeta: Record<
  SupportConversationStatus,
  { label: string; className: string }
> = {
  OPEN: {
    label: "Cần phản hồi",
    className: "bg-amber-50 text-amber-700",
  },
  WAITING_CUSTOMER: {
    label: "Chờ khách",
    className: "bg-sky-50 text-sky-700",
  },
  RESOLVED: {
    label: "Đã giải quyết",
    className: "bg-emerald-50 text-emerald-700",
  },
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDuration(value: number | null) {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} phút`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

function isResponseOverdue(
  status: SupportConversationStatus,
  lastMessageAt: string,
  senderType?: string,
) {
  return (
    status === "OPEN" &&
    senderType === "CUSTOMER" &&
    Date.now() - new Date(lastMessageAt).getTime() >= 10 * 60_000
  );
}

export default function SupportManagementPage({
  mode,
}: {
  mode: "ADMIN" | "BRANCH_MANAGER";
}) {
  const { showToast } = useAppToast();
  const canManage = mode === "BRANCH_MANAGER";
  const [data, setData] = useState(emptyList);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<SupportConversationStatus | "ALL">(
    "ALL",
  );
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState<PublicStoreLocation[]>([]);
  const [metricsDays, setMetricsDays] = useState<7 | 30 | 90>(30);
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(
    async (signal?: AbortSignal, quiet = false) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        if (!quiet) setLoading(true);
        const result = await getSupportConversations(
          accessToken,
          {
            q: debouncedSearch,
            status: status === "ALL" ? undefined : status,
            branchId:
              mode === "ADMIN" && branchFilter
                ? Number(branchFilter)
                : undefined,
          },
          signal,
        );
        setData(result);
        setSelectedId((current) => {
          if (current && result.items.some((item) => item.id === current)) {
            return current;
          }
          return result.items[0]?.id ?? null;
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!quiet) {
          showToast(
            error instanceof Error ? error.message : "Không thể tải hộp thư",
            "error",
          );
        }
      } finally {
        if (!signal?.aborted && !quiet) setLoading(false);
      }
    },
    [branchFilter, debouncedSearch, mode, showToast, status],
  );

  const loadMetrics = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        const result = await getSupportMetrics(
          accessToken,
          {
            days: metricsDays,
            branchId:
              mode === "ADMIN" && branchFilter
                ? Number(branchFilter)
                : undefined,
          },
          signal,
        );
        setMetrics(result);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error
            ? error.message
            : "Không thể tải hiệu quả CSKH",
          "error",
        );
      }
    },
    [branchFilter, metricsDays, mode, showToast],
  );

  useEffect(() => {
    const controller = new AbortController();
    void getPublicStoreLocations(controller.signal)
      .then(setBranches)
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        showToast(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách chi nhánh",
          "error",
        );
      });
    return () => controller.abort();
  }, [showToast]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadMetrics(controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadMetrics]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadList(controller.signal),
      0,
    );
    const intervalId = window.setInterval(
      () => void loadList(undefined, true),
      12_000,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;
    let active = true;
    const controller = new AbortController();
    const load = async (quiet = false) => {
      try {
        if (!quiet) setConversationLoading(true);
        const result = await getSupportConversation(
          accessToken,
          selectedId,
          controller.signal,
        );
        if (active) {
          setConversation(result);
          void loadList(undefined, true);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (active && !quiet) {
          showToast(
            error instanceof Error ? error.message : "Không thể tải hội thoại",
            "error",
          );
        }
      } finally {
        if (active && !quiet) setConversationLoading(false);
      }
    };
    const timeoutId = window.setTimeout(() => void load(), 0);
    const intervalId = window.setInterval(() => void load(true), 8_000);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadList, selectedId, showToast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  async function sendReply() {
    const content = reply.trim();
    const accessToken = sessionStorage.getItem("accessToken");
    if (!canManage || !content || !accessToken || !selectedId || sending)
      return;
    try {
      setSending(true);
      const updated = await sendSupportReply(accessToken, selectedId, content);
      setConversation(updated);
      setReply("");
      await Promise.all([loadList(undefined, true), loadMetrics()]);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể gửi phản hồi",
        "error",
      );
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(nextStatus: SupportConversationStatus) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!canManage || !accessToken || !selectedId || updatingStatus) return;
    try {
      setUpdatingStatus(true);
      const updated = await updateSupportStatus(
        accessToken,
        selectedId,
        nextStatus,
      );
      setConversation(updated);
      await Promise.all([loadList(undefined, true), loadMetrics()]);
      showToast("Đã cập nhật trạng thái hội thoại", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể đổi trạng thái",
        "error",
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  function openTransfer() {
    if (!conversation) return;
    const firstTarget = branches.find(
      (branch) => branch.id !== conversation.branch.id,
    );
    setTargetBranchId(firstTarget ? String(firstTarget.id) : "");
    setTransferOpen(true);
  }

  async function confirmTransfer() {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken || !selectedId || !targetBranchId || transferring) return;
    try {
      setTransferring(true);
      const updated = await transferSupportConversation(
        accessToken,
        selectedId,
        Number(targetBranchId),
      );
      setConversation(updated);
      setTransferOpen(false);
      await Promise.all([loadList(undefined, true), loadMetrics()]);
      showToast(
        `Đã chuyển hội thoại sang ${updated.branch.code} · ${updated.branch.name}`,
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể chuyển chi nhánh",
        "error",
      );
    } finally {
      setTransferring(false);
    }
  }

  const summaryCards = [
    { label: "Cần phản hồi", value: data.summary.open, tone: "amber" },
    { label: "Chờ khách", value: data.summary.waiting, tone: "sky" },
    { label: "Đã giải quyết", value: data.summary.resolved, tone: "emerald" },
    { label: "Tin chưa đọc", value: data.summary.unread, tone: "rose" },
  ];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C1783D]">
          {canManage ? "Chăm sóc khách hàng" : "Giám sát chăm sóc khách hàng"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#241C18] sm:text-3xl">
          {canManage ? "Chat / CSKH" : "Giám sát CSKH"}
        </h1>
        <p className="mt-2 text-sm text-[#78866B]">
          {canManage
            ? "Trực tiếp tiếp nhận và phản hồi yêu cầu của khách hàng."
            : "Theo dõi toàn bộ trao đổi giữa nhân viên và khách hàng."}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-[#78866B]">{card.label}</p>
            <p
              className={`mt-2 text-2xl font-bold ${
                card.tone === "amber"
                  ? "text-amber-700"
                  : card.tone === "sky"
                    ? "text-sky-700"
                    : card.tone === "emerald"
                      ? "text-emerald-700"
                      : "text-rose-700"
              }`}
            >
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-[24px] border border-[#E9E1D8] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-[#2A211D]">
              <BarChart3 size={19} className="text-[#C1783D]" /> Hiệu quả CSKH
            </h2>
            <p className="mt-1 text-xs text-[#78866B]">
              SLA phản hồi đầu tiên trong {metrics?.period.slaMinutes ?? 10}{" "}
              phút.
            </p>
          </div>
          <select
            value={metricsDays}
            onChange={(event) =>
              setMetricsDays(Number(event.target.value) as 7 | 30 | 90)
            }
            className="h-10 rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm font-medium outline-none focus:border-[#C9894B]"
          >
            <option value={7}>7 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={90}>90 ngày</option>
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Phản hồi trung bình",
              value: formatDuration(
                metrics?.summary.averageFirstResponseMinutes ?? null,
              ),
            },
            {
              label: "Đúng SLA",
              value:
                metrics?.summary.slaMetRate === null || !metrics
                  ? "—"
                  : `${metrics.summary.slaMetRate}%`,
            },
            {
              label: "Đang quá hạn",
              value: metrics ? String(metrics.summary.overdue) : "—",
              alert: Boolean(metrics?.summary.overdue),
            },
            {
              label: "Giải quyết trung bình",
              value: formatDuration(
                metrics?.summary.averageResolutionMinutes ?? null,
              ),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[#EFE7DF] bg-[#FCFAF7] px-4 py-3"
            >
              <p className="text-xs text-[#78866B]">{item.label}</p>
              <p
                className={`mt-1.5 font-bold ${item.alert ? "text-rose-700" : "text-[#2A211D]"}`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {mode === "ADMIN" && metrics && metrics.branches.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-[#EFE7DF]">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-[#F8F3ED] text-xs uppercase tracking-wide text-[#78866B]">
                <tr>
                  <th className="px-4 py-3">Chi nhánh</th>
                  <th className="px-4 py-3 text-center">Hội thoại</th>
                  <th className="px-4 py-3 text-center">Quá hạn</th>
                  <th className="px-4 py-3 text-center">Đúng SLA</th>
                  <th className="px-4 py-3 text-right">Phản hồi TB</th>
                </tr>
              </thead>
              <tbody>
                {metrics.branches.map((item) => (
                  <tr
                    key={item.branch.id}
                    className="border-t border-[#EFE7DF]"
                  >
                    <td className="px-4 py-3 font-semibold text-[#2A211D]">
                      {item.branch.code} · {item.branch.name}
                    </td>
                    <td className="px-4 py-3 text-center">{item.total}</td>
                    <td
                      className={`px-4 py-3 text-center font-semibold ${item.overdue ? "text-rose-700" : "text-[#78866B]"}`}
                    >
                      {item.overdue}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.slaMetRate === null ? "—" : `${item.slaMetRate}%`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatDuration(item.averageFirstResponseMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid min-h-[680px] overflow-hidden rounded-[24px] border border-[#E9E1D8] bg-white shadow-sm xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-[#E9E1D8] xl:border-b-0 xl:border-r">
          <div className="space-y-3 border-b border-[#E9E1D8] p-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0968F]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tên, email hoặc số điện thoại"
                className="h-11 w-full rounded-xl border border-[#E9E1D8] pl-10 pr-3 text-sm outline-none focus:border-[#C9894B]"
              />
            </div>
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as SupportConversationStatus | "ALL",
                )
              }
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="OPEN">Cần phản hồi</option>
              <option value="WAITING_CUSTOMER">Chờ khách</option>
              <option value="RESOLVED">Đã giải quyết</option>
            </select>
            {mode === "ADMIN" && (
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
              >
                <option value="">Tất cả chi nhánh</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="max-h-[300px] flex-1 overflow-y-auto xl:max-h-none">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-sm text-[#78866B]">
                <LoaderCircle className="mr-2 animate-spin" size={18} />
                Đang tải...
              </div>
            ) : data.items.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-[#8A817B]">
                Chưa có hội thoại phù hợp.
              </div>
            ) : (
              data.items.map((item) => {
                const active = item.id === selectedId;
                const meta = statusMeta[item.status];
                const overdue = isResponseOverdue(
                  item.status,
                  item.lastMessageAt,
                  item.lastMessage?.senderType,
                );
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full border-b border-[#F0E8E0] p-4 text-left transition ${
                      active ? "bg-[#FFF7EE]" : "hover:bg-[#FCFAF7]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {item.customer.avatarUrl ? (
                        <Image
                          unoptimized
                          src={item.customer.avatarUrl}
                          alt={item.customer.fullName || "Ảnh khách hàng"}
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] text-[#8A5A35]">
                          <UserRound size={19} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-[#2A211D]">
                            {item.customer.fullName || item.customer.email}
                          </p>
                          {item.unreadCount > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                              {item.unreadCount > 99 ? "99+" : item.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#8A817B]">
                          {item.customer.email}
                        </p>
                        <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-medium text-[#A86632]">
                          <Building2 size={12} /> {item.branch.code} ·{" "}
                          {item.branch.name}
                          {item.relatedOrder
                            ? ` · Đơn #${item.relatedOrder.id}`
                            : ""}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#5E5650]">
                          {item.lastMessage?.content || "Chưa có tin nhắn"}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${meta.className}`}
                            >
                              {meta.label}
                            </span>
                            {overdue && (
                              <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">
                                Quá 10 phút
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#A0968F]">
                            {formatTime(item.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex min-h-[620px] min-w-0 flex-col">
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessageCircleMore size={46} className="text-[#C9894B]" />
              <h2 className="mt-4 text-lg font-bold text-[#2A211D]">
                Chọn một hội thoại
              </h2>
              <p className="mt-2 text-sm text-[#78866B]">
                Tin nhắn của khách sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : conversationLoading || !conversation ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#78866B]">
              <LoaderCircle className="mr-2 animate-spin" size={20} />
              Đang tải hội thoại...
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-3 border-b border-[#E9E1D8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {conversation.customer.avatarUrl ? (
                    <Image
                      unoptimized
                      src={conversation.customer.avatarUrl}
                      alt={conversation.customer.fullName || "Ảnh khách hàng"}
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#F3E9DE]"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] text-[#8A5A35]">
                      <UserRound size={20} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-[#2A211D]">
                      {conversation.customer.fullName ||
                        conversation.customer.email}
                    </h2>
                    <p className="mt-1 truncate text-xs text-[#78866B]">
                      {conversation.customer.email}
                      {conversation.customer.phone
                        ? ` · ${conversation.customer.phone}`
                        : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8A5A35]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4E8] px-2 py-1">
                        <Building2 size={12} /> {conversation.branch.code} ·{" "}
                        {conversation.branch.name}
                      </span>
                      {conversation.relatedOrder && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                          <ReceiptText size={12} /> Đơn #
                          {conversation.relatedOrder.id}
                        </span>
                      )}
                      {isResponseOverdue(
                        conversation.status,
                        conversation.lastMessageAt,
                        conversation.messages.at(-1)?.senderType,
                      ) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-700">
                          <Clock3 size={12} /> Khách chờ quá 10 phút
                        </span>
                      )}
                      {conversation.firstResponseAt && (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                          Phản hồi đầu:{" "}
                          {formatTime(conversation.firstResponseAt)}
                        </span>
                      )}
                      {conversation.resolvedAt && (
                        <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">
                          Hoàn tất: {formatTime(conversation.resolvedAt)}
                        </span>
                      )}
                      {conversation.reopenedCount > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                          Đã mở lại {conversation.reopenedCount} lần
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openTransfer}
                    disabled={
                      branches.filter(
                        (branch) => branch.id !== conversation.branch.id,
                      ).length === 0
                    }
                    className="flex h-10 items-center gap-2 rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm font-semibold text-[#6B4332] transition hover:bg-[#FFF7EE] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRightLeft size={16} /> Chuyển chi nhánh
                  </button>
                  {canManage ? (
                    <select
                      value={conversation.status}
                      disabled={updatingStatus}
                      onChange={(event) =>
                        void changeStatus(
                          event.target.value as SupportConversationStatus,
                        )
                      }
                      className="h-10 rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm font-medium outline-none focus:border-[#C9894B] disabled:opacity-50"
                    >
                      <option value="OPEN">Cần phản hồi</option>
                      <option value="WAITING_CUSTOMER">Chờ khách</option>
                      <option value="RESOLVED">Đã giải quyết</option>
                    </select>
                  ) : (
                    <span
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${statusMeta[conversation.status].className}`}
                    >
                      {statusMeta[conversation.status].label}
                    </span>
                  )}
                  {canManage && conversation.status !== "RESOLVED" && (
                    <button
                      type="button"
                      onClick={() => void changeStatus("RESOLVED")}
                      disabled={updatingStatus}
                      className="flex h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 size={17} /> Hoàn tất
                    </button>
                  )}
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#FCFAF7] px-4 py-5 sm:px-6">
                {conversation.messages.map((message) => {
                  const serviceReply = message.senderType !== "CUSTOMER";
                  return (
                    <div
                      key={message.id}
                      className={`flex ${serviceReply ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[68%] ${
                          serviceReply
                            ? "rounded-br-md bg-[#4A2C20] text-white"
                            : "rounded-bl-md border border-[#E9E1D8] bg-white text-[#2A211D]"
                        }`}
                      >
                        <p
                          className={`mb-1 text-xs font-bold ${serviceReply ? "text-[#F3C999]" : "text-[#C1783D]"}`}
                        >
                          {serviceReply
                            ? message.sender.fullName || "Kippora CSKH"
                            : conversation.customer.fullName || "Khách hàng"}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-6">
                          {message.content}
                        </p>
                        <p
                          className={`mt-1.5 text-[11px] ${serviceReply ? "text-white/60" : "text-[#A0968F]"}`}
                        >
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-[#E9E1D8] bg-white p-4 sm:p-5">
                {canManage && conversation.status === "RESOLVED" && (
                  <p className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={15} /> Hội thoại đã hoàn tất. Phản hồi
                    mới sẽ tự chuyển sang trạng thái chờ khách.
                  </p>
                )}
                {canManage ? (
                  <div className="flex items-end gap-3">
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendReply();
                        }
                      }}
                      rows={2}
                      maxLength={2000}
                      placeholder="Nhập phản hồi cho khách..."
                      className="min-h-[52px] flex-1 resize-none rounded-2xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
                    />
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={!reply.trim() || sending}
                      className="flex h-12 items-center gap-2 rounded-2xl bg-[#4A2C20] px-4 text-sm font-bold text-white transition hover:bg-[#5D382A] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? (
                        <LoaderCircle className="animate-spin" size={18} />
                      ) : (
                        <Send size={18} />
                      )}
                      <span className="hidden sm:inline">Gửi</span>
                    </button>
                  </div>
                ) : (
                  <p className="rounded-xl bg-[#FAF8F5] px-4 py-3 text-sm text-[#6B625C]">
                    Admin giám sát và điều phối chi nhánh. Việc phản hồi và cập
                    nhật trạng thái do Nhân viên trưởng phụ trách.
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1 text-xs text-[#A0968F]">
                  <Clock3 size={13} /> Tự động cập nhật tin nhắn mới mỗi 8 giây.
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {transferOpen && conversation && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-transfer-title"
        >
          <div className="w-full max-w-md rounded-[24px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C1783D]">
                  Điều phối CSKH
                </p>
                <h2
                  id="support-transfer-title"
                  className="mt-1 text-xl font-bold text-[#2A211D]"
                >
                  Chuyển hội thoại sang chi nhánh khác
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                className="rounded-full p-2 text-[#8A817B] hover:bg-[#F7F1EB]"
                aria-label="Đóng"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-2xl bg-[#FCF7F1] p-4 text-sm text-[#5E5650]">
                <p>
                  Hiện tại: <strong>{conversation.branch.code}</strong> ·{" "}
                  {conversation.branch.name}
                </p>
                <p className="mt-1 text-xs text-[#8A817B]">
                  Lịch sử tin nhắn được giữ nguyên và thao tác này sẽ được ghi
                  vào nhật ký hệ thống.
                </p>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#3A302A]">
                  Chi nhánh tiếp nhận
                </span>
                <select
                  value={targetBranchId}
                  onChange={(event) => setTargetBranchId(event.target.value)}
                  className="h-12 w-full rounded-xl border border-[#E1D5CA] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
                >
                  {branches
                    .filter((branch) => branch.id !== conversation.branch.id)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} · {branch.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E9E1D8] px-5 py-4">
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                disabled={transferring}
                className="h-11 rounded-xl border border-[#E1D5CA] px-5 text-sm font-semibold text-[#5E5650]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void confirmTransfer()}
                disabled={!targetBranchId || transferring}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                {transferring ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <ArrowRightLeft size={17} />
                )}
                Xác nhận chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
