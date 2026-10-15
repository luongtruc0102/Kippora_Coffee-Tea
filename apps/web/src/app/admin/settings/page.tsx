"use client";

import {
  BadgePercent,
  Clock3,
  MapPinned,
  PackageCheck,
  Power,
  Save,
  Store,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  announceStoreStatusUpdated,
  getStoreSettings,
  updateStoreSettings,
} from "@/services/store-settings.service";
import type { StoreSettings } from "@/types/store-settings";
import { useAppToast } from "@/components/ui/app-toast-provider";

type SettingsForm = {
  isAcceptingOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  openingTime: string;
  closingTime: string;
  preparationMinutes: string;
  maxDeliveryDistanceKm: string;
  deliveryBaseDistanceKm: string;
  deliveryBaseFee: string;
  deliveryFeePerKm: string;
  deliveryDiscountFirstThreshold: string;
  deliveryDiscountFirstAmount: string;
  deliveryDiscountSecondThreshold: string;
  deliveryDiscountSecondAmount: string;
  pauseReason: string;
};

function toForm(settings: StoreSettings): SettingsForm {
  return {
    isAcceptingOrders: settings.isAcceptingOrders,
    deliveryEnabled: settings.deliveryEnabled,
    pickupEnabled: settings.pickupEnabled,
    openingTime: settings.openingTime,
    closingTime: settings.closingTime,
    preparationMinutes: String(settings.preparationMinutes),
    maxDeliveryDistanceKm: String(settings.maxDeliveryDistanceKm),
    deliveryBaseDistanceKm: String(settings.deliveryBaseDistanceKm),
    deliveryBaseFee: String(settings.deliveryBaseFee),
    deliveryFeePerKm: String(settings.deliveryFeePerKm),
    deliveryDiscountFirstThreshold: String(
      settings.deliveryDiscountFirstThreshold,
    ),
    deliveryDiscountFirstAmount: String(settings.deliveryDiscountFirstAmount),
    deliveryDiscountSecondThreshold: String(
      settings.deliveryDiscountSecondThreshold,
    ),
    deliveryDiscountSecondAmount: String(settings.deliveryDiscountSecondAmount),
    pauseReason: settings.pauseReason ?? "",
  };
}

export default function AdminSettingsPage() {
  const { showToast } = useAppToast();

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    const accessToken = sessionStorage.getItem("accessToken");

    if (!accessToken) {
      throw new Error("Không tìm thấy phiên đăng nhập");
    }

    const settingsData = await getStoreSettings(accessToken, signal);

    setForm(toForm(settingsData));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      void loadSettings(controller.signal)
        .catch((error) => {
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }

          showToast(
            error instanceof Error
              ? error.message
              : "Không thể tải cài đặt cửa hàng",
            "error",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadSettings, showToast]);

  function updateField<Key extends keyof SettingsForm>(
    key: Key,
    value: SettingsForm[Key],
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || saving) {
      return;
    }

    if (!form.deliveryEnabled && !form.pickupEnabled) {
      showToast("Hãy bật ít nhất một phương thức nhận hàng", "error");
      return;
    }

    const maxDeliveryDistanceKm = Number(form.maxDeliveryDistanceKm);
    const deliveryBaseDistanceKm = Number(form.deliveryBaseDistanceKm);
    const firstThreshold = Number(form.deliveryDiscountFirstThreshold);
    const secondThreshold = Number(form.deliveryDiscountSecondThreshold);
    const firstAmount = Number(form.deliveryDiscountFirstAmount);
    const secondAmount = Number(form.deliveryDiscountSecondAmount);

    if (deliveryBaseDistanceKm > maxDeliveryDistanceKm) {
      showToast(
        "Quãng đường tính phí cơ bản không được lớn hơn bán kính tối đa",
        "error",
      );
      return;
    }

    if (secondThreshold <= firstThreshold) {
      showToast("Mốc ưu đãi thứ hai phải lớn hơn mốc thứ nhất", "error");
      return;
    }

    if (secondAmount < firstAmount) {
      showToast("Mức giảm thứ hai không được thấp hơn mức thứ nhất", "error");
      return;
    }

    const accessToken = sessionStorage.getItem("accessToken");

    if (!accessToken) {
      showToast("Phiên đăng nhập đã hết hạn", "error");
      return;
    }

    try {
      setSaving(true);

      const updated = await updateStoreSettings(accessToken, {
        isAcceptingOrders: form.isAcceptingOrders,
        deliveryEnabled: form.deliveryEnabled,
        pickupEnabled: form.pickupEnabled,
        openingTime: form.openingTime,
        closingTime: form.closingTime,
        preparationMinutes: Number(form.preparationMinutes),
        maxDeliveryDistanceKm: maxDeliveryDistanceKm,
        deliveryBaseDistanceKm,
        deliveryBaseFee: Number(form.deliveryBaseFee),
        deliveryFeePerKm: Number(form.deliveryFeePerKm),
        deliveryDiscountFirstThreshold: firstThreshold,
        deliveryDiscountFirstAmount: firstAmount,
        deliveryDiscountSecondThreshold: secondThreshold,
        deliveryDiscountSecondAmount: secondAmount,
        pauseReason: form.isAcceptingOrders ? null : form.pauseReason,
      });

      setForm(toForm(updated));
      announceStoreStatusUpdated();

      showToast("Đã lưu cài đặt cửa hàng", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể lưu cài đặt",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-[#E9E1D8] bg-white">
        <p className="text-sm text-[#8A817B]">Đang tải cài đặt cửa hàng...</p>
      </div>
    );
  }

  const previewSystemActive = form.isAcceptingOrders;

  const previewUnavailableReason = form.isAcceptingOrders
    ? null
    : form.pauseReason.trim() || "Hệ thống đang tạm ngưng hoạt động.";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
            Hệ thống
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#2A211D]">
            Cài đặt cửa hàng
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Điều khiển toàn hệ thống, giờ hoạt động, phương thức nhận hàng và
            phạm vi giao hàng.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
        >
          <Save size={18} />
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </header>

      <section
        className={
          previewSystemActive
            ? "rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6"
            : "rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={
                previewSystemActive
                  ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white"
                  : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white"
              }
            >
              <Store size={21} />
            </span>

            <div>
              <h2 className="font-bold text-[#2A211D]">
                {previewSystemActive
                  ? "Hệ thống đang hoạt động"
                  : "Hệ thống đang tạm ngưng"}
              </h2>
              <p className="mt-1 text-sm text-[#6B625C]">
                {previewSystemActive
                  ? "Thời gian chuẩn bị dự kiến " +
                    form.preparationMinutes +
                    " phút."
                  : previewUnavailableReason ||
                    "Bật lại hệ thống để phía User tiếp tục sử dụng."}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={form.isAcceptingOrders}
            onClick={() =>
              updateField("isAcceptingOrders", !form.isAcceptingOrders)
            }
            className={
              form.isAcceptingOrders
                ? "inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                : "inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
            }
          >
            <Power size={17} />
            {form.isAcceptingOrders
              ? "Hệ thống đang bật"
              : "Hệ thống tạm ngưng"}
          </button>
        </div>

        {!form.isAcceptingOrders && (
          <div className="mt-4">
            <label
              htmlFor="pauseReason"
              className="mb-2 block text-sm font-semibold text-[#4A423D]"
            >
              Lý do tạm ngưng
            </label>
            <input
              id="pauseReason"
              value={form.pauseReason}
              onChange={(event) =>
                updateField("pauseReason", event.target.value)
              }
              maxLength={200}
              placeholder="Ví dụ: Bảo trì hệ thống, vui lòng quay lại sau."
              className="h-11 w-full rounded-xl border border-amber-200 bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
            />
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-[#E9E1D8] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <Clock3 size={21} className="text-[#C9894B]" />
            <div>
              <h2 className="font-bold text-[#2A211D]">Giờ hoạt động</h2>
              <p className="mt-1 text-xs text-[#8A817B]">
                Áp dụng theo múi giờ Việt Nam.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
              <span>Giờ mở cửa</span>
              <input
                type="time"
                required
                value={form.openingTime}
                onChange={(event) =>
                  updateField("openingTime", event.target.value)
                }
                className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
              />
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
              <span>Giờ đóng cửa</span>
              <input
                type="time"
                required
                value={form.closingTime}
                onChange={(event) =>
                  updateField("closingTime", event.target.value)
                }
                className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
              />
            </label>
          </div>

          <label className="mt-4 block space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Thời gian chuẩn bị dự kiến (phút)</span>
            <input
              type="number"
              required
              min={5}
              max={240}
              value={form.preparationMinutes}
              onChange={(event) =>
                updateField("preparationMinutes", event.target.value)
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
            />
          </label>
        </section>

        <section className="rounded-3xl border border-[#E9E1D8] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <PackageCheck size={21} className="text-[#C9894B]" />
            <div>
              <h2 className="font-bold text-[#2A211D]">
                Phương thức nhận hàng
              </h2>
              <p className="mt-1 text-xs text-[#8A817B]">
                Phải bật ít nhất một phương thức.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              role="switch"
              aria-checked={form.deliveryEnabled}
              onClick={() =>
                updateField("deliveryEnabled", !form.deliveryEnabled)
              }
              className={
                form.deliveryEnabled
                  ? "rounded-2xl border border-[#C9894B] bg-[#FFF8F0] p-4 text-left transition"
                  : "rounded-2xl border border-[#E9E1D8] bg-white p-4 text-left transition"
              }
            >
              <Truck size={20} className="text-[#C9894B]" />
              <strong className="mt-3 block text-sm text-[#2A211D]">
                Giao hàng
              </strong>
              <span className="mt-1 block text-xs text-[#8A817B]">
                {form.deliveryEnabled ? "Đang cho phép" : "Đang tạm tắt"}
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={form.pickupEnabled}
              onClick={() => updateField("pickupEnabled", !form.pickupEnabled)}
              className={
                form.pickupEnabled
                  ? "rounded-2xl border border-[#C9894B] bg-[#FFF8F0] p-4 text-left transition"
                  : "rounded-2xl border border-[#E9E1D8] bg-white p-4 text-left transition"
              }
            >
              <Store size={20} className="text-[#C9894B]" />
              <strong className="mt-3 block text-sm text-[#2A211D]">
                Đến quán lấy
              </strong>
              <span className="mt-1 block text-xs text-[#8A817B]">
                {form.pickupEnabled ? "Đang cho phép" : "Đang tạm tắt"}
              </span>
            </button>
          </div>

          <label className="mt-4 block space-y-2 text-sm font-semibold text-[#4A423D]">
            <span className="flex items-center gap-2">
              <MapPinned size={17} />
              Bán kính giao hàng tối đa (km)
            </span>
            <input
              type="number"
              required
              min={1}
              max={100}
              step="0.5"
              disabled={!form.deliveryEnabled}
              value={form.maxDeliveryDistanceKm}
              onChange={(event) =>
                updateField("maxDeliveryDistanceKm", event.target.value)
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>
        </section>
      </div>

      <section className="rounded-3xl border border-[#E9E1D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <BadgePercent size={21} className="text-[#C9894B]" />
          <div>
            <h2 className="font-bold text-[#2A211D]">
              Phí giao hàng và ưu đãi
            </h2>
            <p className="mt-1 text-xs text-[#8A817B]">
              Áp dụng trực tiếp tại thanh toán và được máy chủ kiểm tra lại khi
              tạo đơn.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Quãng đường cơ bản (km)</span>
            <input
              type="number"
              required
              min={0.5}
              max={100}
              step="0.5"
              disabled={!form.deliveryEnabled}
              value={form.deliveryBaseDistanceKm}
              onChange={(event) =>
                updateField("deliveryBaseDistanceKm", event.target.value)
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Phí cơ bản (đ)</span>
            <input
              type="number"
              required
              min={0}
              step={1000}
              disabled={!form.deliveryEnabled}
              value={form.deliveryBaseFee}
              onChange={(event) =>
                updateField("deliveryBaseFee", event.target.value)
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Phụ phí mỗi km (đ)</span>
            <input
              type="number"
              required
              min={0}
              step={1000}
              disabled={!form.deliveryEnabled}
              value={form.deliveryFeePerKm}
              onChange={(event) =>
                updateField("deliveryFeePerKm", event.target.value)
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Mốc ưu đãi 1 (đ)</span>
            <input
              type="number"
              required
              min={0}
              step={10000}
              disabled={!form.deliveryEnabled}
              value={form.deliveryDiscountFirstThreshold}
              onChange={(event) =>
                updateField(
                  "deliveryDiscountFirstThreshold",
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Giảm ở mốc 1 (đ)</span>
            <input
              type="number"
              required
              min={0}
              step={1000}
              disabled={!form.deliveryEnabled}
              value={form.deliveryDiscountFirstAmount}
              onChange={(event) =>
                updateField("deliveryDiscountFirstAmount", event.target.value)
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Mốc ưu đãi 2 (đ)</span>
            <input
              type="number"
              required
              min={0}
              step={10000}
              disabled={!form.deliveryEnabled}
              value={form.deliveryDiscountSecondThreshold}
              onChange={(event) =>
                updateField(
                  "deliveryDiscountSecondThreshold",
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#4A423D]">
            <span>Giảm ở mốc 2 (đ)</span>
            <input
              type="number"
              required
              min={0}
              step={1000}
              disabled={!form.deliveryEnabled}
              value={form.deliveryDiscountSecondAmount}
              onChange={(event) =>
                updateField("deliveryDiscountSecondAmount", event.target.value)
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B] disabled:bg-[#FAF8F5] disabled:opacity-60"
            />
          </label>
        </div>

        <p className="mt-4 rounded-2xl bg-[#FAF4EC] px-4 py-3 text-sm leading-6 text-[#7A4B2B]">
          Ví dụ hiện tại: {Number(form.deliveryBaseFee).toLocaleString("vi-VN")}
          đ cho {form.deliveryBaseDistanceKm || "0"} km đầu, sau đó cộng{" "}
          {Number(form.deliveryFeePerKm).toLocaleString("vi-VN")}đ cho mỗi km
          tiếp theo.
        </p>
      </section>
    </form>
  );
}
