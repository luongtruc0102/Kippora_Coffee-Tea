"use client";

import {
  Clock3,
  Store,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getStoreStatus,
  STORE_STATUS_UPDATED_EVENT,
} from "@/services/store-settings.service";
import type {
  StoreStatus,
} from "@/types/store-settings";

type Props = {
  className?: string;
  showHours?: boolean;
};

export default function StoreStatusBadge({
  className = "",
  showHours = false,
}: Props) {
  const [status, setStatus] =
    useState<StoreStatus | null>(
      null,
    );

  const loadStatus =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        try {
          const data =
            await getStoreStatus(
              signal,
            );

          setStatus(data);
        } catch (error) {
          if (
            error instanceof Error &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          // Header không hiện lỗi mạng để tránh làm gián đoạn điều hướng.
        }
      },
      [],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    const initialLoadId =
      window.setTimeout(
        () =>
          void loadStatus(
            controller.signal,
          ),
        0,
      );

    const intervalId =
      window.setInterval(
        () =>
          void loadStatus(),
        60000,
      );

    const handleUpdated =
      () => {
        void loadStatus();
      };

    window.addEventListener(
      STORE_STATUS_UPDATED_EVENT,
      handleUpdated,
    );

    return () => {
      controller.abort();
      window.clearTimeout(
        initialLoadId,
      );
      window.clearInterval(
        intervalId,
      );
      window.removeEventListener(
        STORE_STATUS_UPDATED_EVENT,
        handleUpdated,
      );
    };
  }, [loadStatus]);

  if (!status) {
    return null;
  }

  return (
    <span
      title={
        status.isOpen
          ? `Đang nhận đơn · Dự kiến ${status.preparationMinutes} phút`
          : status.unavailableReason ||
            "Cửa hàng chưa nhận đơn"
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        status.isOpen
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      } ${className}`}
    >
      {status.isOpen ? (
        <Store size={13} />
      ) : (
        <Clock3 size={13} />
      )}

      <span>
        {status.isOpen
          ? "Đang mở cửa"
          : status.isWithinOpeningHours
            ? "Tạm ngưng nhận đơn"
            : "Đã đóng cửa"}
      </span>

      {showHours && (
        <span className="font-normal opacity-75">
          · {status.openingTime}–
          {status.closingTime}
        </span>
      )}
    </span>
  );
}