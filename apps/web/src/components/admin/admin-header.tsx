"use client";

import { useEffect, useState } from "react";

import { LogOut, Menu, UserRound } from "lucide-react";

import { useRouter } from "next/navigation";

import NotificationBell from "@/components/user/notification-bell";
import { logout } from "@/services/auth.service";

type CurrentUser = {
  id: number;
  email: string;
  fullName: string;
  role: string;
};

type Props = {
  onOpenSidebar: () => void;
};

export default function AdminHeader({ onOpenSidebar }: Props) {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const storedUser = sessionStorage.getItem("user");

      if (!storedUser) {
        return;
      }

      try {
        const parsedUser: CurrentUser = JSON.parse(storedUser);

        setUser(parsedUser);
      } catch {
        // Xóa phiên nếu localStorage không hợp lệ
        sessionStorage.removeItem("user");

        sessionStorage.removeItem("accessToken");

        router.replace("/login");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    const accessToken = sessionStorage.getItem("accessToken");

    try {
      if (accessToken) await logout(accessToken);
    } catch {
      // Mất mạng vẫn phải cho người dùng kết thúc phiên trên thiết bị này.
    } finally {
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("user");
      router.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E9E1D8] bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9E1D8] text-[#5E5650] transition hover:bg-[#FAF8F5] lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1 className="text-base font-semibold text-[#1F1B18] sm:text-lg">
            Admin Dashboard
          </h1>

          <p className="hidden text-sm text-[#78866B] sm:block">
            Quản lý hệ thống Kippora
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3E9DE] text-[#4A2C20]">
          <UserRound size={19} />
        </div>

        <div className="hidden text-right sm:block">
          <p className="max-w-[180px] truncate text-sm font-semibold text-[#1F1B18]">
            {user?.fullName ?? "Admin"}
          </p>

          <p className="text-xs uppercase text-[#78866B]">
            {user?.role ?? "ADMIN"}
          </p>
        </div>

        <div className="mx-1 hidden h-7 w-px bg-[#E9E1D8] sm:block" />

        <button
          type="button"
          onClick={handleLogout}
          title="Đăng xuất"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#4A2C20] transition hover:bg-[#EADBCB]"
        >
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}
