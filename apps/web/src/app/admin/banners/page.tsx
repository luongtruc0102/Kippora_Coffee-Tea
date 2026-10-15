"use client";

import Image from "next/image";
import {
  CalendarClock,
  Eye,
  EyeOff,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  createBanner,
  getAdminBanners,
  updateBanner,
  updateBannerStatus,
} from "@/services/banner.service";
import { getAdminContentPages } from "@/services/content-page.service";
import { getAdminProducts } from "@/services/product.service";
import { getBranches } from "@/services/store-settings.service";
import { uploadBannerImage } from "@/services/upload.service";
import { getAdminVouchers } from "@/services/voucher.service";
import type {
  AdminBanner,
  BannerInput,
  BannerTargetType,
  BannerTheme,
} from "@/types/banner";
import type { AdminContentPage } from "@/types/content-page";
import type { Product } from "@/types/product";
import type { BranchStatus } from "@/types/store-settings";
import type { Voucher } from "@/types/voucher";

type BannerForm = {
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  imageUrl: string;
  theme: BannerTheme;
  targetType: BannerTargetType;
  targetId: string;
  customUrl: string;
  branchId: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: string;
};

const emptyForm: BannerForm = {
  eyebrow: "",
  title: "",
  subtitle: "",
  buttonLabel: "Xem ngay",
  imageUrl: "",
  theme: "AMBER",
  targetType: "MENU",
  targetId: "",
  customUrl: "",
  branchId: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  sortOrder: "0",
};

const themeView: Record<BannerTheme, { label: string; className: string }> = {
  AMBER: {
    label: "Cam sữa",
    className: "from-[#FFF0D9] to-[#D99A58] text-[#3D261B]",
  },
  COCOA: {
    label: "Nâu cà phê",
    className: "from-[#382118] to-[#8B5A3C] text-white",
  },
  GREEN: {
    label: "Xanh trà",
    className: "from-[#E6F1E4] to-[#78906D] text-[#20351E]",
  },
};

const targetLabels: Record<BannerTargetType, string> = {
  NONE: "Không gắn liên kết",
  MENU: "Trang Menu",
  PRODUCT: "Một sản phẩm",
  VOUCHER: "Một voucher",
  CONTENT_PAGE: "Trang nội dung",
  CUSTOM_URL: "Đường dẫn nội bộ",
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function bannerState(banner: AdminBanner) {
  const now = Date.now();
  if (!banner.isActive)
    return { label: "Đã tắt", className: "bg-slate-100 text-slate-600" };
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now) {
    return { label: "Đã lên lịch", className: "bg-blue-50 text-blue-700" };
  }
  if (banner.endsAt && new Date(banner.endsAt).getTime() < now) {
    return { label: "Đã hết hạn", className: "bg-amber-50 text-amber-700" };
  }
  return {
    label: "Đang hiển thị",
    className: "bg-emerald-50 text-emerald-700",
  };
}

export default function AdminBannersPage() {
  const { showToast } = useAppToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [branches, setBranches] = useState<BranchStatus[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [contentPages, setContentPages] = useState<AdminContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập");
    const [bannerData, branchData, productData, voucherData, pageData] =
      await Promise.all([
        getAdminBanners(accessToken, signal),
        getBranches(accessToken, signal),
        getAdminProducts(accessToken, "", signal),
        getAdminVouchers(accessToken, "", signal),
        getAdminContentPages(accessToken, {}, signal),
      ]);
    setBanners(bannerData);
    setBranches(branchData);
    setProducts(productData);
    setVouchers(voucherData);
    setContentPages(pageData);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadData(controller.signal)
        .catch((error) => {
          if (error instanceof Error && error.name === "AbortError") return;
          showToast(
            error instanceof Error ? error.message : "Không thể tải banner",
            "error",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadData, showToast]);

  const filteredBanners = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return banners.filter((banner) => {
      const state = bannerState(banner).label;
      const matchesSearch =
        !keyword ||
        banner.title.toLocaleLowerCase("vi").includes(keyword) ||
        banner.subtitle?.toLocaleLowerCase("vi").includes(keyword);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "VISIBLE" && state === "Đang hiển thị") ||
        (statusFilter === "SCHEDULED" && state === "Đã lên lịch") ||
        (statusFilter === "EXPIRED" && state === "Đã hết hạn") ||
        (statusFilter === "OFF" && state === "Đã tắt");
      const matchesScope =
        scopeFilter === "ALL" ||
        (scopeFilter === "GLOBAL" && banner.branchId === null) ||
        banner.branchId === Number(scopeFilter);
      return matchesSearch && matchesStatus && matchesScope;
    });
  }, [banners, scopeFilter, search, statusFilter]);

  const summary = useMemo(
    () => ({
      total: banners.length,
      visible: banners.filter(
        (item) => bannerState(item).label === "Đang hiển thị",
      ).length,
      scheduled: banners.filter(
        (item) => bannerState(item).label === "Đã lên lịch",
      ).length,
      expired: banners.filter(
        (item) => bannerState(item).label === "Đã hết hạn",
      ).length,
    }),
    [banners],
  );

  function updateForm<Key extends keyof BannerForm>(
    key: Key,
    value: BannerForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingBanner(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(banner: AdminBanner) {
    setEditingBanner(banner);
    const targetId =
      banner.targetType === "PRODUCT"
        ? banner.productId
        : banner.targetType === "VOUCHER"
          ? banner.voucherId
          : banner.targetType === "CONTENT_PAGE"
            ? banner.contentPageId
            : null;
    setForm({
      eyebrow: banner.eyebrow ?? "",
      title: banner.title,
      subtitle: banner.subtitle ?? "",
      buttonLabel: banner.buttonLabel ?? "",
      imageUrl: banner.imageUrl ?? "",
      theme: banner.theme,
      targetType: banner.targetType,
      targetId: targetId ? String(targetId) : "",
      customUrl: banner.customUrl ?? "",
      branchId: banner.branchId ? String(banner.branchId) : "",
      startsAt: toLocalDateTime(banner.startsAt),
      endsAt: toLocalDateTime(banner.endsAt),
      isActive: banner.isActive,
      sortOrder: String(banner.sortOrder),
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (saving || uploading) return;
    setFormOpen(false);
    setEditingBanner(null);
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return showToast("Phiên đăng nhập đã hết hạn", "error");
    try {
      setUploading(true);
      const result = await uploadBannerImage(accessToken, file);
      updateForm("imageUrl", result.imageUrl);
      showToast("Đã tải ảnh banner", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể tải ảnh",
        "error",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function buildInput(): BannerInput {
    const targetId = Number(form.targetId) || null;
    return {
      eyebrow: form.eyebrow.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      buttonLabel: form.buttonLabel.trim(),
      imageUrl: form.imageUrl.trim(),
      theme: form.theme,
      targetType: form.targetType,
      productId: form.targetType === "PRODUCT" ? targetId : null,
      voucherId: form.targetType === "VOUCHER" ? targetId : null,
      contentPageId: form.targetType === "CONTENT_PAGE" ? targetId : null,
      customUrl:
        form.targetType === "CUSTOM_URL" ? form.customUrl.trim() : null,
      branchId: Number(form.branchId) || null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      isActive: form.isActive,
      sortOrder: Math.max(0, Number(form.sortOrder) || 0),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    if (form.title.trim().length < 2)
      return showToast("Hãy nhập tiêu đề banner", "error");
    if (
      ["PRODUCT", "VOUCHER", "CONTENT_PAGE"].includes(form.targetType) &&
      !form.targetId
    ) {
      return showToast("Hãy chọn nội dung muốn liên kết", "error");
    }
    if (form.targetType === "CUSTOM_URL" && !form.customUrl.startsWith("/")) {
      return showToast("Đường dẫn nội bộ phải bắt đầu bằng /", "error");
    }
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return showToast("Phiên đăng nhập đã hết hạn", "error");
    try {
      setSaving(true);
      const input = buildInput();
      if (editingBanner)
        await updateBanner(accessToken, editingBanner.id, input);
      else await createBanner(accessToken, input);
      await loadData();
      setFormOpen(false);
      setEditingBanner(null);
      showToast(
        editingBanner ? "Đã cập nhật banner" : "Đã tạo banner",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể lưu banner",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(banner: AdminBanner) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken || updatingId !== null) return;
    try {
      setUpdatingId(banner.id);
      await updateBannerStatus(accessToken, banner.id, !banner.isActive);
      await loadData();
      showToast(banner.isActive ? "Đã tắt banner" : "Đã bật banner", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể đổi trạng thái",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function targetDescription(banner: AdminBanner) {
    if (banner.targetType === "PRODUCT")
      return banner.product?.name ?? "Sản phẩm đã gỡ";
    if (banner.targetType === "VOUCHER")
      return banner.voucher?.code ?? "Voucher đã gỡ";
    if (banner.targetType === "CONTENT_PAGE")
      return banner.contentPage?.title ?? "Trang đã gỡ";
    if (banner.targetType === "CUSTOM_URL") return banner.customUrl ?? "—";
    return targetLabels[banner.targetType];
  }

  const previewTheme = themeView[form.theme];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C57935]">
            Nội dung trang chủ
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">
            Quản lý Banner
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Lên lịch ưu đãi và dẫn khách đến đúng sản phẩm, voucher hoặc nội
            dung.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-3 text-sm font-semibold text-white hover:bg-[#382118]"
        >
          <Plus size={18} /> Thêm banner
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          [
            "Tổng banner",
            summary.total,
            ImageIcon,
            "bg-orange-50 text-orange-700",
          ],
          [
            "Đang hiển thị",
            summary.visible,
            Eye,
            "bg-emerald-50 text-emerald-700",
          ],
          [
            "Đã lên lịch",
            summary.scheduled,
            CalendarClock,
            "bg-blue-50 text-blue-700",
          ],
          ["Đã hết hạn", summary.expired, EyeOff, "bg-amber-50 text-amber-700"],
        ].map(([label, value, Icon, color]) => {
          const StatIcon = Icon as typeof ImageIcon;
          return (
            <div
              key={String(label)}
              className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#78866B]">{String(label)}</p>
                  <p className="mt-1 text-2xl font-bold text-[#1F1B18]">
                    {String(value)}
                  </p>
                </div>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${String(color)}`}
                >
                  <StatIcon size={19} />
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_210px_230px]">
          <label className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm banner..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none focus:border-[#C9894B]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="VISIBLE">Đang hiển thị</option>
            <option value="SCHEDULED">Đã lên lịch</option>
            <option value="EXPIRED">Đã hết hạn</option>
            <option value="OFF">Đã tắt</option>
          </select>
          <select
            value={scopeFilter}
            onChange={(event) => setScopeFilter(event.target.value)}
            className="h-11 rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
          >
            <option value="ALL">Mọi phạm vi</option>
            <option value="GLOBAL">Toàn hệ thống</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-[#78866B]">
          <LoaderCircle className="mr-2 animate-spin" size={20} /> Đang tải
          banner...
        </div>
      ) : filteredBanners.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#DCCDBF] bg-white text-center">
          <ImageIcon size={38} className="text-[#CBBFB5]" />
          <p className="mt-3 font-semibold text-[#4A2C20]">
            Chưa có banner phù hợp
          </p>
        </div>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {filteredBanners.map((banner) => {
            const state = bannerState(banner);
            const theme = themeView[banner.theme];
            return (
              <article
                key={banner.id}
                className="overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm"
              >
                <div
                  className={`relative min-h-52 overflow-hidden bg-gradient-to-br ${theme.className}`}
                >
                  {banner.imageUrl ? (
                    <Image
                      unoptimized
                      src={banner.imageUrl}
                      alt={banner.title}
                      fill
                      sizes="(max-width:1280px) 100vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <Sparkles
                      className="absolute right-10 top-9 opacity-30"
                      size={72}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
                  <div className="relative flex min-h-52 max-w-[72%] flex-col justify-end p-6 text-white">
                    {banner.eyebrow && (
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                        {banner.eyebrow}
                      </p>
                    )}
                    <h2 className="mt-1 text-2xl font-bold leading-tight">
                      {banner.title}
                    </h2>
                    {banner.subtitle && (
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/85">
                        {banner.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.className}`}
                    >
                      {state.label}
                    </span>
                    <span className="rounded-full bg-[#F5F1ED] px-2.5 py-1 text-xs text-[#6A5E57]">
                      {banner.branch
                        ? `${banner.branch.code} · ${banner.branch.name}`
                        : "Toàn hệ thống"}
                    </span>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">
                      Thứ tự {banner.sortOrder}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-[#A0968F]">Liên kết</p>
                      <p className="mt-1 truncate font-medium text-[#4A403A]">
                        {targetDescription(banner)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#A0968F]">Thời gian</p>
                      <p className="mt-1 font-medium text-[#4A403A]">
                        {banner.startsAt
                          ? new Intl.DateTimeFormat("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(banner.startsAt))
                          : "Hiện ngay"}
                        {banner.endsAt ? " → có hạn" : " · không giới hạn"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(banner)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4D8CD] px-3 text-sm font-semibold text-[#A35D27] hover:bg-orange-50"
                    >
                      <Pencil size={17} /> Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleStatus(banner)}
                      disabled={updatingId === banner.id}
                      className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-60 ${banner.isActive ? "bg-[#F3F0ED] text-[#5E5650]" : "bg-[#4A2C20] text-white"}`}
                    >
                      {updatingId === banner.id ? (
                        <LoaderCircle size={17} className="animate-spin" />
                      ) : banner.isActive ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                      {banner.isActive ? "Tắt" : "Bật"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="banner-form-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[#E9E1D8] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C57935]">
                  Banner trang chủ
                </p>
                <h2
                  id="banner-form-title"
                  className="mt-1 text-2xl font-bold text-[#2A211D]"
                >
                  {editingBanner ? "Cập nhật banner" : "Thêm banner mới"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#FAF8F5]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-5 px-5 py-5 sm:px-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A] sm:col-span-2">
                    Tiêu đề *
                    <input
                      value={form.title}
                      onChange={(event) =>
                        updateForm("title", event.target.value)
                      }
                      maxLength={180}
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] px-4 font-normal outline-none focus:border-[#C9894B]"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Nhãn nhỏ
                    <input
                      value={form.eyebrow}
                      onChange={(event) =>
                        updateForm("eyebrow", event.target.value)
                      }
                      maxLength={80}
                      placeholder="VD: KIPPORA REWARDS"
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] px-4 font-normal outline-none focus:border-[#C9894B]"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Tên nút
                    <input
                      value={form.buttonLabel}
                      onChange={(event) =>
                        updateForm("buttonLabel", event.target.value)
                      }
                      maxLength={60}
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] px-4 font-normal outline-none focus:border-[#C9894B]"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A] sm:col-span-2">
                    Mô tả
                    <textarea
                      value={form.subtitle}
                      onChange={(event) =>
                        updateForm("subtitle", event.target.value)
                      }
                      maxLength={500}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[#E4D8CD] px-4 py-3 font-normal leading-6 outline-none focus:border-[#C9894B]"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Màu nền
                    <select
                      value={form.theme}
                      onChange={(event) =>
                        updateForm("theme", event.target.value as BannerTheme)
                      }
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] bg-white px-4 font-normal outline-none"
                    >
                      <option value="AMBER">Cam sữa</option>
                      <option value="COCOA">Nâu cà phê</option>
                      <option value="GREEN">Xanh trà</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Phạm vi
                    <select
                      value={form.branchId}
                      onChange={(event) =>
                        updateForm("branchId", event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] bg-white px-4 font-normal outline-none"
                    >
                      <option value="">Toàn hệ thống</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.code} · {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Liên kết đến
                    <select
                      value={form.targetType}
                      onChange={(event) => {
                        updateForm(
                          "targetType",
                          event.target.value as BannerTargetType,
                        );
                        updateForm("targetId", "");
                      }}
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] bg-white px-4 font-normal outline-none"
                    >
                      {Object.entries(targetLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.targetType === "PRODUCT" && (
                    <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                      Sản phẩm
                      <select
                        value={form.targetId}
                        onChange={(event) =>
                          updateForm("targetId", event.target.value)
                        }
                        className="h-12 w-full rounded-xl border border-[#E4D8CD] bg-white px-4 font-normal outline-none"
                      >
                        <option value="">Chọn sản phẩm</option>
                        {products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                            {item.isActive ? "" : " (đã khóa)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {form.targetType === "VOUCHER" && (
                    <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                      Voucher
                      <select
                        value={form.targetId}
                        onChange={(event) =>
                          updateForm("targetId", event.target.value)
                        }
                        className="h-12 w-full rounded-xl border border-[#E4D8CD] bg-white px-4 font-normal outline-none"
                      >
                        <option value="">Chọn voucher</option>
                        {vouchers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.code}
                            {item.isActive ? "" : " (đã tắt)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {form.targetType === "CONTENT_PAGE" && (
                    <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                      Trang nội dung
                      <select
                        value={form.targetId}
                        onChange={(event) =>
                          updateForm("targetId", event.target.value)
                        }
                        className="h-12 w-full rounded-xl border border-[#E4D8CD] bg-white px-4 font-normal outline-none"
                      >
                        <option value="">Chọn trang</option>
                        {contentPages.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                            {item.isPublished ? "" : " (bản nháp)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {form.targetType === "CUSTOM_URL" && (
                    <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                      Đường dẫn nội bộ
                      <input
                        value={form.customUrl}
                        onChange={(event) =>
                          updateForm("customUrl", event.target.value)
                        }
                        placeholder="/gioi-thieu"
                        className="h-12 w-full rounded-xl border border-[#E4D8CD] px-4 font-normal outline-none focus:border-[#C9894B]"
                      />
                    </label>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Bắt đầu
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(event) =>
                        updateForm("startsAt", event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] px-3 font-normal outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Kết thúc
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(event) =>
                        updateForm("endsAt", event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] px-3 font-normal outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                    Thứ tự
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={form.sortOrder}
                      onChange={(event) =>
                        updateForm("sortOrder", event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-[#E4D8CD] px-4 font-normal outline-none"
                    />
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] p-4">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      updateForm("isActive", event.target.checked)
                    }
                    className="h-4 w-4 accent-[#4A2C20]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#4A403A]">
                      Bật banner
                    </span>
                    <span className="text-xs text-[#A0968F]">
                      Banner vẫn chỉ hiện trong khoảng thời gian đã chọn.
                    </span>
                  </span>
                </label>
              </div>

              <div className="border-t border-[#E9E1D8] bg-[#FAF8F5] px-5 py-5 sm:px-7 lg:border-l lg:border-t-0">
                <p className="text-sm font-semibold text-[#4A403A]">
                  Ảnh & xem trước
                </p>
                <div
                  className={`relative mt-3 min-h-64 overflow-hidden rounded-2xl bg-gradient-to-br ${previewTheme.className}`}
                >
                  {form.imageUrl ? (
                    <Image
                      unoptimized
                      src={form.imageUrl}
                      alt="Xem trước banner"
                      fill
                      sizes="480px"
                      className="object-cover"
                    />
                  ) : (
                    <Sparkles
                      className="absolute right-8 top-8 opacity-30"
                      size={58}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent" />
                  <div className="relative flex min-h-64 max-w-[82%] flex-col justify-end p-6 text-white">
                    {form.eyebrow && (
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                        {form.eyebrow}
                      </p>
                    )}
                    <h3 className="mt-1 text-2xl font-bold leading-tight">
                      {form.title || "Tiêu đề banner"}
                    </h3>
                    {form.subtitle && (
                      <p className="mt-2 line-clamp-3 text-sm leading-5 text-white/85">
                        {form.subtitle}
                      </p>
                    )}
                    {form.buttonLabel && form.targetType !== "NONE" && (
                      <span className="mt-4 w-fit rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#4A2C20]">
                        {form.buttonLabel}
                      </span>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) =>
                    void handleImage(event.target.files?.[0])
                  }
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#DCCDBF] bg-white px-4 py-3 text-sm font-semibold text-[#4A2C20] disabled:opacity-60"
                  >
                    {uploading ? (
                      <LoaderCircle size={17} className="animate-spin" />
                    ) : (
                      <Upload size={17} />
                    )}
                    {uploading ? "Đang tải..." : "Chọn ảnh"}
                  </button>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={() => updateForm("imageUrl", "")}
                      className="rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-semibold text-red-600"
                    >
                      Gỡ ảnh
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-[#A0968F]">
                  Khuyên dùng ảnh ngang 1600 × 560 px, JPG/PNG/WEBP, tối đa 8MB.
                  Không có ảnh thì hệ thống dùng màu nền đã chọn.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#E9E1D8] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving || uploading}
                className="rounded-xl border border-[#E4D8CD] px-5 py-3 text-sm font-semibold text-[#5E5650] disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Đang lưu..." : "Lưu banner"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
