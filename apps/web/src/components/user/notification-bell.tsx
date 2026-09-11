"use client";

import { Bell, CheckCheck, PackageCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "@/services/notification.service";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const knownIdsRef = useRef(new Set<number>());
  const toastTimersRef = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToasts = useCallback(
    (notifications: UserNotification[]) => {
      for (const notification of notifications.slice(-3)) {
        setToasts((current) => [
          ...current.filter((toast) => toast.id !== notification.id),
          notification,
        ]);
        const timer = window.setTimeout(
          () => dismissToast(notification.id),
          6000,
        );
        toastTimersRef.current.set(notification.id, timer);
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const toastTimers = toastTimersRef.current;

    async function loadNotifications() {
      if (requestInFlight || document.visibilityState !== "visible") {
        return;
      }

      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) {
        return;
      }

      requestInFlight = true;
      try {
        const data = await getMyNotifications(accessToken);
        if (!active) return;

        if (initializedRef.current) {
          const newest = data.items
            .filter((item) => !knownIdsRef.current.has(item.id))
            .reverse();
          if (newest.length > 0) showToasts(newest);
        }

        knownIdsRef.current = new Set(data.items.map((item) => item.id));
        initializedRef.current = true;
        setItems(data.items);
        setUnreadCount(data.unreadCount);
      } catch {
        // Polling lỗi tạm thời không làm biến mất dữ liệu chuông đang hiển thị.
      } finally {
        requestInFlight = false;
        if (active) setLoading(false);
      }
    }

    void loadNotifications();
    const intervalId = window.setInterval(
      () => void loadNotifications(),
      12000,
    );
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      for (const timer of toastTimers.values()) {
        window.clearTimeout(timer);
      }
      toastTimers.clear();
    };
  }, [showToasts]);

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  async function openNotification(notification: UserNotification) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (accessToken && !notification.isRead) {
      try {
        await markNotificationRead(accessToken, notification.id);
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item,
          ),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {}
    }
    dismissToast(notification.id);
    setOpen(false);
    if (["PAYROLL_FINALIZED", "PAYROLL_PAID"].includes(notification.type)) {
      const storedUser = sessionStorage.getItem("user");
      let role = "STAFF";
      try {
        role = storedUser ? JSON.parse(storedUser).role : "STAFF";
      } catch {}
      router.push(
        role === "BRANCH_MANAGER"
          ? "/staff/payroll"
          : role === "ADMIN"
            ? "/admin/payroll"
            : "/work-schedule#payroll",
      );
    } else if (notification.type === "LEAVE_REQUEST_UPDATED") {
      router.push("/work-schedule");
    } else if (
      [
        "INVENTORY_COUNT_SUBMITTED",
        "INVENTORY_COUNT_APPROVED",
        "INVENTORY_COUNT_REJECTED",
      ].includes(notification.type)
    ) {
      const storedUser = sessionStorage.getItem("user");
      let role = "STAFF";
      try {
        role = storedUser ? JSON.parse(storedUser).role : "STAFF";
      } catch {}
      router.push(
        role === "ADMIN"
          ? "/admin/inventory-counts"
          : "/staff/inventory-counts",
      );
    } else if (notification.type.startsWith("PURCHASE_ORDER_")) {
      const storedUser = sessionStorage.getItem("user");
      let role = "STAFF";
      try {
        role = storedUser ? JSON.parse(storedUser).role : "STAFF";
      } catch {}
      router.push(
        role === "ADMIN" ? "/admin/purchase-orders" : "/staff/purchase-orders",
      );
    } else if (notification.type.startsWith("INVENTORY_LOT_")) {
      const storedUser = sessionStorage.getItem("user");
      let role = "BRANCH_MANAGER";
      try {
        role = storedUser ? JSON.parse(storedUser).role : "BRANCH_MANAGER";
      } catch {}
      router.push(role === "ADMIN" ? "/admin/inventory-lots" : "/staff/inventory-lots");
    } else if (
      [
        "ATTENDANCE_PERIOD_APPROVED",
        "ATTENDANCE_PERIOD_RETURNED",
        "ATTENDANCE_PERIOD_REOPENED",
      ].includes(notification.type)
    ) {
      router.push("/staff/schedules");
    } else if (
      [
        "LEAVE_REQUEST_CREATED",
        "LEAVE_REQUEST_SUPPLEMENTED",
        "LEAVE_REQUEST_CANCELLED",
      ].includes(notification.type)
    ) {
      router.push("/staff/employees");
    } else if (notification.orderId) {
      const storedUser = sessionStorage.getItem("user");
      let role = "USER";
      try {
        role = storedUser ? JSON.parse(storedUser).role : "USER";
      } catch {}
      if (role === "ADMIN") router.push("/admin/orders");
      else if (role === "BRANCH_MANAGER") router.push("/staff/orders");
      else router.push(`/orders/${notification.orderId}`);
    } else if (notification.type === "LOW_STOCK") {
      const storedUser = sessionStorage.getItem("user");
      try {
        if (storedUser && JSON.parse(storedUser).role === "ADMIN") {
          router.push("/admin/inventory");
        }
      } catch {}
    }
  }

  async function markAllRead() {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken || unreadCount === 0) return;
    try {
      await markAllNotificationsRead(accessToken);
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          title="Thông báo"
          aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
            open
              ? "bg-[#F3E9DE] text-[#C9894B]"
              : "text-[#4A2C20] hover:bg-[#F3E9DE]"
          }`}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-[1100] w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F0E8E0] px-4 py-3">
              <div>
                <h2 className="font-bold text-[#2A211D]">Thông báo</h2>
                <p className="text-xs text-[#8A817B]">{unreadCount} chưa đọc</p>
              </div>
              <button
                type="button"
                disabled={unreadCount === 0}
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#C2763D] disabled:opacity-40"
              >
                <CheckCheck size={15} /> Đọc tất cả
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-10 text-center text-sm text-[#8A817B]">
                  Đang tải...
                </p>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[#8A817B]">
                  Chưa có thông báo.
                </p>
              ) : (
                items.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={`flex w-full gap-3 border-b border-[#F5EFE9] px-4 py-3 text-left transition hover:bg-[#FFF8F0] ${notification.isRead ? "bg-white" : "bg-[#FFF8F0]/70"}`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] text-[#C2763D]">
                      <PackageCheck size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#2A211D]">
                        {notification.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#6B625C]">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-[#A0968F]">
                        {formatTime(notification.createdAt)}
                      </span>
                    </span>
                    {!notification.isRead && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#C9894B]" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed right-4 top-20 z-[9000] flex w-[min(92vw,380px)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="notification-toast-enter pointer-events-auto rounded-2xl border border-[#E9D4BF] bg-white p-4 shadow-2xl"
          >
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void openNotification(toast)}
                className="flex min-w-0 flex-1 gap-3 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] text-[#C2763D]">
                  <PackageCheck size={19} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm text-[#2A211D]">
                    {toast.title}
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-[#6B625C]">
                    {toast.message}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => dismissToast(toast.id)}
                className="h-7 w-7 shrink-0 text-[#8A817B]"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
