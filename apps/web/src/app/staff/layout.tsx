"use client";

import {
  Banknote,
  Bell,
  BookCheck,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  HandCoins,
  Landmark,
  LogOut,
  PackageCheck,
  Boxes,
  Power,
  ScrollText,
  ShoppingCart,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import BrandLogo from "@/components/brand/brand-logo";
import NotificationBell from "@/components/user/notification-bell";
import {
  getBranchStatus,
  getStoreStatus,
  updateBranchStatus,
} from "@/services/store-settings.service";
import type { BranchStatus, StoreStatus } from "@/types/store-settings";
import { useAppToast } from "@/components/ui/app-toast-provider";
import { getMe } from "@/services/auth.service";

type StoredUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
};

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const { showToast } = useAppToast();

  const [authorized, setAuthorized] = useState(false);

  const [user, setUser] = useState<StoredUser | null>(null);

  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);

  const [branchStatus, setBranchStatus] = useState<BranchStatus | null>(null);

  const [updatingStore, setUpdatingStore] = useState(false);

  const [managementMenuOpen, setManagementMenuOpen] = useState(false);

  const managementMenuRef = useRef<HTMLDivElement>(null);

  const managementMenuActive = [
    "/staff/schedules",
    "/staff/payroll",
    "/staff/employees",
    "/staff/expenses",
    "/staff/inventory-counts",
    "/staff/inventory-lots",
    "/staff/purchase-orders",
    "/staff/cash-reconciliation",
    "/staff/activity-logs",
    "/staff/month-close",
    "/staff/notifications",
  ].some((route) => pathname.startsWith(route));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        managementMenuRef.current &&
        !managementMenuRef.current.contains(event.target as Node)
      ) {
        setManagementMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;

      const accessToken = sessionStorage.getItem("accessToken");
      const storedUser = sessionStorage.getItem("user");

      if (!accessToken || !storedUser) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser) as StoredUser;
        // Lấy role mới nhất từ backend để tài khoản vừa được thăng/hạ quyền
        // có hiệu lực ngay khi tải lại trang, không phụ thuộc dữ liệu cũ localStorage.
        const profile = await getMe(accessToken);
        const currentUser: StoredUser = {
          ...parsedUser,
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          role: profile.role,
        };

        sessionStorage.setItem(
          "user",
          JSON.stringify({ ...parsedUser, ...currentUser }),
        );

        // Khu vực Staff là bàn điều hành dành riêng cho trưởng chi nhánh.
        // Nhân viên thường tiếp tục dùng giao diện khách và tự điểm danh tại đó.
        if (currentUser.role !== "BRANCH_MANAGER") {
          router.replace(currentUser.role === "ADMIN" ? "/admin" : "/");
          return;
        }

        if (cancelled) return;
        setUser(currentUser);
        setAuthorized(true);
      } catch {
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("user");
        router.replace("/login");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // Tải đồng thời trạng thái toàn hệ thống và chi nhánh Staff đang vận hành.
  useEffect(() => {
    if (!authorized) {
      return;
    }

    const accessToken = sessionStorage.getItem("accessToken");

    if (!accessToken) {
      return;
    }

    const controller = new AbortController();

    const loadStatus = async () => {
      try {
        const [globalStatus, currentBranchStatus] = await Promise.all([
          getStoreStatus(controller.signal),
          getBranchStatus(accessToken, controller.signal),
        ]);

        setStoreStatus(globalStatus);
        setBranchStatus(currentBranchStatus);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
      }
    };

    void loadStatus();

    const intervalId = window.setInterval(() => void loadStatus(), 60000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [authorized]);

  async function toggleBranchStatus() {
    if (!branchStatus || updatingStore) {
      return;
    }

    const accessToken = sessionStorage.getItem("accessToken");

    if (!accessToken) {
      return;
    }

    const nextValue = !branchStatus.isAcceptingOrders;

    try {
      setUpdatingStore(true);

      const nextStatus = await updateBranchStatus(
        accessToken,
        nextValue,
        nextValue ? undefined : "Chi nhánh đang tạm ngưng nhận đơn.",
      );

      setBranchStatus(nextStatus);

      showToast(
        nextValue
          ? "Chi nhánh đã mở nhận đơn"
          : "Chi nhánh đã tạm ngưng nhận đơn",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể đổi trạng thái chi nhánh",
        "error",
      );
    } finally {
      setUpdatingStore(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("user");

    router.replace("/login");
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
        <p className="text-sm text-[#78866B]">
          Đang kiểm tra tài khoản nhân viên...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <header className="sticky top-0 z-40 border-b border-[#E9E1D8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/staff/orders" className="shrink-0">
              <BrandLogo
                variant="wordmark"
                priority
                sizes="140px"
                className="h-auto w-[135px]"
              />
            </Link>

            {user?.role === "BRANCH_MANAGER" && (
              <>
                <Link
                  href="/staff/pos"
                  className={`hidden items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition lg:flex ${
                    pathname.startsWith("/staff/pos")
                      ? "bg-[#F3E9DE] text-[#4A2C20]"
                      : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                  }`}
                >
                  <ShoppingCart size={17} />
                  Bán tại quầy
                </Link>

                <Link
                  href="/staff/orders"
                  className={`hidden items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition lg:flex ${
                    pathname.startsWith("/staff/orders")
                      ? "bg-[#F3E9DE] text-[#4A2C20]"
                      : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                  }`}
                >
                  <PackageCheck size={17} />
                  Xử lý đơn hàng
                </Link>
              </>
            )}

            {user?.role === "BRANCH_MANAGER" && (
              <div
                ref={managementMenuRef}
                className="relative hidden shrink-0 sm:block"
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={managementMenuOpen}
                  onClick={() => setManagementMenuOpen((current) => !current)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    managementMenuActive
                      ? "bg-[#F3E9DE] text-[#4A2C20]"
                      : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                  }`}
                >
                  <Users size={17} />
                  Quản lý
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${managementMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {managementMenuOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-[calc(100vh-5rem)] w-56 overflow-y-auto rounded-2xl border border-[#E9E1D8] bg-white p-2 shadow-xl"
                  >
                    <Link
                      href="/staff/notifications"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/notifications")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <Bell size={17} />
                      Cảnh báo vận hành
                    </Link>
                    <Link
                      href="/staff/schedules"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/schedules")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <CalendarDays size={17} />
                      Lịch làm
                    </Link>
                    <Link
                      href="/staff/payroll"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/payroll")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <Banknote size={17} />
                      Bảng lương
                    </Link>
                    <Link
                      href="/staff/employees"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/employees")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <Users size={17} />
                      Nhân viên
                    </Link>
                    <Link
                      href="/staff/purchase-orders"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/purchase-orders")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <ClipboardList size={17} />
                      Đặt hàng NCC
                    </Link>
                    <Link
                      href="/staff/inventory-counts"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/inventory-counts")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <ClipboardCheck size={17} />
                      Kiểm kê kho
                    </Link>
                    <Link
                      href="/staff/inventory-lots"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/inventory-lots")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <Boxes size={17} />
                      Lô & hạn dùng
                    </Link>
                    <Link
                      href="/staff/expenses"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/expenses")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <HandCoins size={17} />
                      Chi phí
                    </Link>
                    <Link
                      href="/staff/cash-reconciliation"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/cash-reconciliation")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <Landmark size={17} />
                      Chốt quỹ
                    </Link>
                    <Link
                      href="/staff/activity-logs"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/activity-logs")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <ScrollText size={17} />
                      Nhật ký
                    </Link>
                    <Link
                      href="/staff/month-close"
                      role="menuitem"
                      onClick={() => setManagementMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        pathname.startsWith("/staff/month-close")
                          ? "bg-[#F3E9DE] text-[#4A2C20]"
                          : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#4A2C20]"
                      }`}
                    >
                      <BookCheck size={17} />
                      Chốt sổ tháng
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {storeStatus && !storeStatus.isSystemActive && (
              <span
                title={storeStatus.unavailableReason || undefined}
                className="hidden rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 lg:inline-flex"
              >
                Hệ thống đã tạm ngưng
              </span>
            )}

            {branchStatus && user?.role === "BRANCH_MANAGER" && (
              <button
                type="button"
                disabled={updatingStore || !branchStatus.isActive}
                onClick={() => void toggleBranchStatus()}
                title={
                  !branchStatus.isActive
                    ? "Chi nhánh đã bị Admin khóa"
                    : branchStatus.isAcceptingOrders
                      ? "Tạm ngưng nhận đơn"
                      : "Mở nhận đơn"
                }
                className={
                  !branchStatus.isActive
                    ? "inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-500 opacity-70"
                    : branchStatus.isAcceptingOrders
                      ? "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                      : "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-amber-50 px-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                }
              >
                <Power size={17} />
                <span className="hidden md:inline">
                  {!branchStatus.isActive
                    ? "Chi nhánh bị khóa"
                    : branchStatus.isAcceptingOrders
                      ? "Đang nhận đơn"
                      : "Đang tạm nghỉ"}
                </span>
              </button>
            )}
            <NotificationBell />
            <div className="hidden items-center gap-2 rounded-xl bg-[#FAF8F5] px-3 py-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3E9DE] text-[#4A2C20]">
                <UserRound size={17} />
              </span>

              <div className="max-w-40">
                <p className="truncate text-sm font-semibold text-[#2A211D]">
                  {user?.fullName || user?.email}
                </p>

                <p className="text-[11px] text-[#8A817B]">
                  {user?.role === "BRANCH_MANAGER"
                    ? "Nhân viên trưởng"
                    : "Nhân viên"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Đăng xuất"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#6B625C] transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        {storeStatus && !storeStatus.isSystemActive ? (
          <section className="flex min-h-[65vh] items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl border border-[#E9E1D8] bg-white p-8 text-center shadow-sm sm:p-10">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-700">
                <Power size={28} />
              </span>

              <h1 className="mt-5 text-2xl font-bold text-[#2A211D]">
                Hệ thống đang tạm ngưng
              </h1>

              <p className="mt-2 text-sm leading-6 text-[#78866B]">
                {storeStatus.unavailableReason ||
                  "Admin đã tạm ngưng toàn hệ thống. Vui lòng chờ hệ thống được mở lại."}
              </p>
            </div>
          </section>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
