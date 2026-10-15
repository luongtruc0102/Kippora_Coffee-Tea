"use client";

import { Power, Store } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  getStoreStatus,
  STORE_STATUS_UPDATED_EVENT,
} from "@/services/store-settings.service";
import type { StoreStatus } from "@/types/store-settings";

export default function SystemAvailabilityBoundary({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const nextStatus = await getStoreStatus(signal);
      setStatus(nextStatus);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // Nếu API trạng thái tạm lỗi, vẫn cho user dùng trang thay vì khóa nhầm hệ thống.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const initialLoadId = window.setTimeout(
      () => void loadStatus(controller.signal),
      0,
    );

    const intervalId = window.setInterval(() => void loadStatus(), 30000);
    const handleUpdated = () => void loadStatus();

    window.addEventListener(STORE_STATUS_UPDATED_EVENT, handleUpdated);

    return () => {
      controller.abort();
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      window.removeEventListener(STORE_STATUS_UPDATED_EVENT, handleUpdated);
    };
  }, [loadStatus]);

  if (!loaded) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <p className="text-sm text-[#78866B]">
          Đang kiểm tra trạng thái hệ thống...
        </p>
      </div>
    );
  }

  // Chỉ Admin đóng cấp hệ thống mới thay toàn bộ nội dung phía User.
  // Kênh CSKH phải luôn truy cập được, kể cả khi Admin tạm dừng nhận đơn.
  if (status && !status.isSystemActive && !pathname.startsWith("/ho-tro")) {
    return (
      <section className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-[#E9E1D8] bg-white p-8 text-center shadow-sm sm:p-12">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F3E9DE] text-[#4A2C20]">
            <Power size={34} />
          </span>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#C9823D]">
            Kippora Coffee & Tea
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[#231A16]">
            Hệ thống đang tạm ngưng
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#78866B]">
            {status.unavailableReason ||
              "Cửa hàng đang tạm ngưng hoạt động. Vui lòng quay lại sau."}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FAF8F5] px-4 py-2 text-sm text-[#6B625C]">
            <Store size={16} />
            Giờ phục vụ {status.openingTime}–{status.closingTime}
          </div>
        </div>
      </section>
    );
  }

  return children;
}
