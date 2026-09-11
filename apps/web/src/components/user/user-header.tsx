"use client";

import {
  Clock3,
  Heart,
  LogIn,
  LogOut,
  LoaderCircle,
  Menu,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";

import Link from "next/link";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import BrandLogo from "@/components/brand/brand-logo";
import NotificationBell from "@/components/user/notification-bell";
import StoreStatusBadge from "@/components/user/store-status-badge";
import { useAppToast } from "@/components/ui/app-toast-provider";

import { getCart } from "@/services/cart.service";
import {
  checkInMyAttendance,
  getMyCurrentAttendance,
} from "@/services/user.service";
import { getMyScheduleStatus } from "@/services/staff-schedule.service";
import type { MyScheduleStatus } from "@/types/staff-schedule";
import type { StaffAttendance } from "@/types/user";

import { CART_UPDATED_EVENT, getCartItemCount } from "@/utils/cart.util";

import {
  AUTH_USER_UPDATED_EVENT,
  type StoredAuthUser,
} from "@/utils/auth.util";

const navItems = [
  {
    label: "Trang chủ",
    href: "/",
  },
  {
    label: "Menu",
    href: "/menu",
  },
];

export default function UserHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useAppToast();

  const [mobileOpen, setMobileOpen] = useState(false);

  const [user, setUser] = useState<StoredAuthUser | null>(null);

  const [cartItemCount, setCartItemCount] = useState(0);

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const [currentAttendance, setCurrentAttendance] =
    useState<StaffAttendance | null>(null);

  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [scheduleStatus, setScheduleStatus] =
    useState<MyScheduleStatus | null>(null);

  // Khôi phục user, tải badge ban đầu và lắng nghe mọi thay đổi của giỏ.
  useEffect(() => {
    let active = true;

    // Nhận số dòng món từ event nội bộ do modal hoặc trang giỏ phát ra.
    function handleCartUpdated(event: Event) {
      const cartEvent = event as CustomEvent<number>;
      const nextCount = Number(cartEvent.detail);

      if (Number.isFinite(nextCount)) {
        setCartItemCount(Math.max(0, nextCount));
      }
    }

    // Nhận hồ sơ mới sau khi user cập nhật tên, phone hoặc avatar.
    function handleUserUpdated(event: Event) {
      const userEvent = event as CustomEvent<StoredAuthUser>;

      setUser(userEvent.detail);
    }

    // Cập nhật badge ngay khi giỏ đổi mà không cần tải lại trang.
    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdated);

    window.addEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated);

    // Chạy sau khi component mount để chỉ đọc sessionStorage ở phía browser.
    const timeoutId = window.setTimeout(() => {
      const storedUser = sessionStorage.getItem("user");

      if (!storedUser) {
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser) as StoredAuthUser;

        setUser(parsedUser);

        const accessToken = sessionStorage.getItem("accessToken");

        if (accessToken) {
          void getCart(accessToken)
            .then((cart) => {
              if (active) {
                setCartItemCount(getCartItemCount(cart));
              }
            })
            .catch(() => {
              if (active) {
                setCartItemCount(0);
              }
            });

        }
      } catch {
        sessionStorage.removeItem("user");

        sessionStorage.removeItem("accessToken");
      }
    }, 0);

    // Hủy timer/listener để không cập nhật state sau khi header unmount.
    return () => {
      active = false;
      window.clearTimeout(timeoutId);

      window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdated);

      window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated);
    };
  }, []);

  // Đồng bộ lịch để nút điểm danh chỉ mở từ 5 phút trước ca đã được xếp.
  useEffect(() => {
    if (user?.role !== "STAFF") return;

    let active = true;
    const controller = new AbortController();

    const loadAttendanceAndSchedule = async (showLoading = false) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;

      try {
        if (showLoading && active) setAttendanceLoading(true);
        const [attendance, status] = await Promise.all([
          getMyCurrentAttendance(accessToken, controller.signal),
          getMyScheduleStatus(accessToken, controller.signal),
        ]);
        if (active) {
          setCurrentAttendance(attendance);
          setScheduleStatus(status);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (active) setScheduleStatus(null);
      } finally {
        if (showLoading && active) setAttendanceLoading(false);
      }
    };

    const timeoutId = window.setTimeout(
      () => void loadAttendanceAndSchedule(true),
      0,
    );
    const intervalId = window.setInterval(
      () => void loadAttendanceAndSchedule(),
      30_000,
    );

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [user?.role]);

  // Xác định mục điều hướng đang active, xử lý riêng đường dẫn trang chủ.
  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  // Nhân viên dùng chung giao diện mua hàng với khách, đồng thời có thêm trang
  // ca làm riêng để gửi và theo dõi yêu cầu nghỉ.
  const visibleNavItems = user
    ? [
        ...navItems,
        { label: "Đơn hàng", href: "/orders" },
        ...(user.role === "STAFF"
          ? [{ label: "Ca làm", href: "/work-schedule" }]
          : []),
      ]
    : navItems;

  // Xóa toàn bộ phiên đăng nhập phía client rồi đưa user về màn hình đăng nhập.
  function handleLogout() {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("user");

    setUser(null);
    setCartItemCount(0);
    setCurrentAttendance(null);
    setScheduleStatus(null);
    setMobileOpen(false);
    setLogoutConfirmOpen(false);

    router.replace("/login");
    router.refresh();
  }

  // Nhân viên chỉ tự bắt đầu ca; nút kết thúc ca nằm ở trang quản lý của trưởng.
  async function handleSelfCheckIn() {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken || currentAttendance || attendanceLoading) {
      return;
    }

    try {
      setAttendanceLoading(true);
      const attendance = await checkInMyAttendance(accessToken);
      setCurrentAttendance(attendance);
      setScheduleStatus((current) =>
        current
          ? { ...current, hasOpenAttendance: true, canCheckIn: false }
          : current,
      );
      showToast("Điểm danh thành công. Ca làm đã bắt đầu.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể điểm danh",
        "error",
      );
    } finally {
      setAttendanceLoading(false);
    }
  }

  const canSelfCheckIn = Boolean(scheduleStatus?.canCheckIn);
  const checkInLabel = currentAttendance
    ? "Đang trong ca"
    : canSelfCheckIn
      ? "Điểm danh"
      : scheduleStatus?.nextShift || scheduleStatus?.eligibleShift
        ? "Chưa đến ca"
        : "Chưa có ca";
  const checkInTitle = currentAttendance
    ? "Ca làm đang diễn ra"
    : canSelfCheckIn
      ? "Đã đến giờ điểm danh"
      : scheduleStatus?.checkInOpensAt
        ? `Có thể điểm danh từ ${new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(scheduleStatus.checkInOpensAt))}`
        : "Bạn chưa được xếp ca làm sắp tới";

  return (
    <>
      {/* Cao hơn dropdown checkout/Leaflet nhưng vẫn thấp hơn overlay và modal. */}
      <header className="fixed inset-x-0 top-0 z-[1000] border-b border-[#E9E1D8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Kippora - Trang chủ"
              className="flex shrink-0 items-center"
            >
              <BrandLogo
                variant="wordmark"
                priority
                sizes="(max-width: 640px) 128px, 150px"
                className="h-auto w-32 sm:w-[150px]"
              />
            </Link>

            <StoreStatusBadge showHours className="hidden xl:inline-flex" />
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-[#F3E9DE] text-[#4A2C20]"
                    : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user?.role === "STAFF" && (
              <button
                type="button"
                onClick={() => void handleSelfCheckIn()}
                disabled={
                  attendanceLoading || Boolean(currentAttendance) || !canSelfCheckIn
                }
                title={checkInTitle}
                className={`hidden h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition lg:flex ${
                  currentAttendance
                    ? "cursor-default bg-emerald-50 text-emerald-700"
                    : canSelfCheckIn
                      ? "bg-[#F3E9DE] text-[#4A2C20] hover:bg-[#EADBCB]"
                      : "cursor-not-allowed bg-[#F3F0ED] text-[#8A817B]"
                } disabled:opacity-80`}
              >
                {attendanceLoading ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Clock3 size={18} />
                )}
                {checkInLabel}
              </button>
            )}

            {user && (
              <Link
                href="/favorites"
                aria-label="Món yêu thích"
                title="Món yêu thích"
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  isActive("/favorites")
                    ? "bg-[#F3E9DE] text-[#C9894B]"
                    : "text-[#4A2C20] hover:bg-[#F3E9DE]"
                }`}
              >
                <Heart size={20} />
              </Link>
            )}
            {user && <NotificationBell />}

            <Link
              href="/cart"
              aria-label="Giỏ hàng"
              title="Giỏ hàng"
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isActive("/cart")
                  ? "bg-[#F3E9DE] text-[#C9894B]"
                  : "text-[#4A2C20] hover:bg-[#F3E9DE]"
              }`}
            >
              <ShoppingCart size={20} />

              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C9894B] px-1 text-[10px] font-bold text-white shadow-sm">
                  {cartItemCount > 99 ? "99+" : cartItemCount}
                </span>
              )}
            </Link>

            {user ? (
              <>
                <Link
                  href="/profile"
                  className="hidden items-center gap-2 rounded-xl bg-[#FAF8F5] px-3 py-2 sm:flex"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3E9DE] bg-cover bg-center text-[#4A2C20]"
                    style={
                      user.avatarUrl
                        ? {
                            backgroundImage: `url("${user.avatarUrl}")`,
                          }
                        : undefined
                    }
                  >
                    {!user.avatarUrl && <UserRound size={17} />}
                  </div>

                  <span className="max-w-[130px] truncate text-sm font-semibold text-[#1F1B18]">
                    {user.fullName || user.email}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setLogoutConfirmOpen(true)}
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                  className="hidden h-10 w-10 items-center justify-center rounded-xl text-[#4A2C20] transition hover:bg-red-50 hover:text-red-600 sm:flex"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="hidden items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118] sm:flex"
              >
                <LogIn size={17} />
                Đăng nhập
              </Link>
            )}

            <button
              type="button"
              aria-label="Mở menu"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#4A2C20] transition hover:bg-[#F3E9DE] md:hidden"
            >
              <Menu size={21} />
            </button>
          </div>
        </div>
      </header>

      {/* Overlay mobile */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-[9998] h-dvh w-screen bg-black/50 transition-opacity duration-300 md:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Mobile drawer */}
      <aside
        className={`fixed right-0 top-0 z-[9999] flex h-dvh w-[84vw] max-w-[350px] flex-col border-l border-[#E9E1D8] bg-[#FFFDFC] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-[#E9E1D8] bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              aria-label="Kippora - Trang chủ"
              className="flex items-center"
            >
              <BrandLogo
                variant="wordmark"
                sizes="145px"
                className="h-auto w-[145px]"
              />
            </Link>

            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMobileOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#4A2C20] transition hover:bg-[#EADBCB]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-5 py-5">
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#4A2C20] text-white shadow-sm"
                    : "text-[#5E5650] hover:bg-[#F3E9DE] hover:text-[#4A2C20]"
                }`}
              >
                <span>{item.label}</span>

                <span
                  className={`text-xs transition ${
                    active
                      ? "text-white/70"
                      : "text-[#B2A69E] group-hover:text-[#4A2C20]"
                  }`}
                >
                  →
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#E9E1D8] bg-white p-5">
          {user ? (
            <div className="space-y-2">
              {user.role === "STAFF" && (
                <button
                  type="button"
                  onClick={() => void handleSelfCheckIn()}
                  disabled={
                    attendanceLoading || Boolean(currentAttendance) || !canSelfCheckIn
                  }
                  title={checkInTitle}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    currentAttendance
                      ? "cursor-default bg-emerald-50 text-emerald-700"
                      : canSelfCheckIn
                        ? "bg-[#F3E9DE] text-[#4A2C20] hover:bg-[#EADBCB]"
                        : "cursor-not-allowed bg-[#F3F0ED] text-[#8A817B]"
                  } disabled:opacity-80`}
                >
                  {attendanceLoading ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Clock3 size={17} />
                  )}
                  {checkInLabel}
                </button>
              )}

              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-[#F7F2EC] p-3 transition hover:bg-[#F3E9DE]"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EADBCB] bg-cover bg-center text-[#4A2C20]"
                  style={
                    user.avatarUrl
                      ? {
                          backgroundImage: `url("${user.avatarUrl}")`,
                        }
                      : undefined
                  }
                >
                  {!user.avatarUrl && <UserRound size={18} />}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2A211D]">
                    {user.fullName || user.email}
                  </p>

                  <p className="text-xs text-[#8A817B]">Tài khoản của tôi</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                <LogOut size={17} />
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#4A2C20] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#382118]"
            >
              <LogIn size={17} />
              Đăng nhập
            </Link>
          )}

          <p className="mt-4 text-center text-[11px] text-[#A0968F]">
            Kippora · 2026
          </p>
        </div>
      </aside>

      {logoutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setLogoutConfirmOpen(false);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#E9E1D8] bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <LogOut size={22} />
            </div>

            <h2
              id="logout-confirm-title"
              className="mt-4 text-xl font-bold text-[#1F1B18]"
            >
              Đăng xuất tài khoản?
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#78866B]">
              Anh sẽ cần đăng nhập lại để tiếp tục đặt món và theo dõi đơn hàng.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="rounded-xl border border-[#E9E1D8] px-4 py-3 text-sm font-semibold text-[#5E5650] transition hover:bg-[#FAF8F5]"
              >
                Ở lại
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl bg-[#4A2C20] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#382118]"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
