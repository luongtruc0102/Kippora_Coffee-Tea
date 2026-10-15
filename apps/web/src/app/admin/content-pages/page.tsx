"use client";

import {
  Eye,
  EyeOff,
  FileText,
  LayoutPanelTop,
  LoaderCircle,
  PanelBottom,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  createContentPage,
  getAdminContentPages,
  updateContentPage,
  updateContentPageStatus,
} from "@/services/content-page.service";
import type {
  AdminContentPage,
  ContentPageCategory,
  ContentPageInput,
} from "@/types/content-page";

type ContentForm = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: ContentPageCategory;
  isPublished: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  sortOrder: string;
};

const emptyForm: ContentForm = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  category: "ABOUT",
  isPublished: false,
  showInHeader: false,
  showInFooter: true,
  sortOrder: "0",
};

const categoryView: Record<
  ContentPageCategory,
  { label: string; className: string }
> = {
  ABOUT: { label: "Về Kippora", className: "bg-orange-50 text-orange-700" },
  SUPPORT: { label: "Hỗ trợ", className: "bg-sky-50 text-sky-700" },
  POLICY: { label: "Chính sách", className: "bg-violet-50 text-violet-700" },
};

export default function AdminContentPagesPage() {
  const { showToast } = useAppToast();
  const [pages, setPages] = useState<AdminContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"ALL" | ContentPageCategory>("ALL");
  const [status, setStatus] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<AdminContentPage | null>(null);
  const [form, setForm] = useState<ContentForm>(emptyForm);

  const loadPages = useCallback(async (signal?: AbortSignal) => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập");
    const data = await getAdminContentPages(accessToken, {}, signal);
    setPages(data);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadPages(controller.signal)
        .catch((error) => {
          if (error instanceof Error && error.name === "AbortError") return;
          showToast(
            error instanceof Error ? error.message : "Không thể tải nội dung",
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
  }, [loadPages, showToast]);

  const filteredPages = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return pages.filter((page) => {
      const matchesKeyword =
        !keyword ||
        page.title.toLocaleLowerCase("vi").includes(keyword) ||
        page.slug.toLocaleLowerCase("vi").includes(keyword) ||
        page.summary?.toLocaleLowerCase("vi").includes(keyword);
      const matchesCategory = category === "ALL" || page.category === category;
      const matchesStatus =
        status === "ALL" ||
        (status === "PUBLISHED" && page.isPublished) ||
        (status === "DRAFT" && !page.isPublished);
      return matchesKeyword && matchesCategory && matchesStatus;
    });
  }, [category, pages, search, status]);

  const summary = useMemo(
    () => ({
      total: pages.length,
      published: pages.filter((page) => page.isPublished).length,
      header: pages.filter((page) => page.isPublished && page.showInHeader)
        .length,
      footer: pages.filter((page) => page.isPublished && page.showInFooter)
        .length,
    }),
    [pages],
  );

  function openCreate() {
    setEditingPage(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(page: AdminContentPage) {
    setEditingPage(page);
    setForm({
      title: page.title,
      slug: page.slug,
      summary: page.summary ?? "",
      content: page.content,
      category: page.category,
      isPublished: page.isPublished,
      showInHeader: page.showInHeader,
      showInFooter: page.showInFooter,
      sortOrder: String(page.sortOrder),
    });
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingPage(null);
  }

  function updateForm<Key extends keyof ContentForm>(
    key: Key,
    value: ContentForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (form.title.trim().length < 2) {
      showToast("Tên trang phải có ít nhất 2 ký tự", "error");
      return;
    }
    if (form.content.trim().length < 10) {
      showToast("Nội dung trang cần rõ ràng hơn", "error");
      return;
    }
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      showToast("Phiên đăng nhập đã hết hạn", "error");
      return;
    }

    const input: ContentPageInput = {
      title: form.title.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      summary: form.summary.trim() || undefined,
      content: form.content.trim(),
      category: form.category,
      isPublished: form.isPublished,
      showInHeader: form.showInHeader,
      showInFooter: form.showInFooter,
      sortOrder: Math.max(0, Number(form.sortOrder) || 0),
    };

    try {
      setSaving(true);
      if (editingPage) {
        await updateContentPage(accessToken, editingPage.id, input);
      } else {
        await createContentPage(accessToken, input);
      }
      await loadPages();
      setFormOpen(false);
      setEditingPage(null);
      showToast(
        editingPage ? "Đã cập nhật trang nội dung" : "Đã tạo trang nội dung",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể lưu nội dung",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(page: AdminContentPage) {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken || updatingId !== null) return;
    try {
      setUpdatingId(page.id);
      await updateContentPageStatus(accessToken, page.id, !page.isPublished);
      await loadPages();
      showToast(
        page.isPublished ? "Đã ẩn trang khỏi khách hàng" : "Đã công khai trang",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể đổi trạng thái",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C57935]">
            Nội dung website
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">
            Trang giới thiệu & chính sách
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            Chỉnh nội dung và chọn trang xuất hiện trên header hoặc footer của
            khách hàng.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#382118]"
        >
          <Plus size={18} /> Thêm trang
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          [
            "Tổng số trang",
            summary.total,
            FileText,
            "bg-orange-50 text-orange-700",
          ],
          [
            "Đã công khai",
            summary.published,
            Eye,
            "bg-emerald-50 text-emerald-700",
          ],
          [
            "Hiện trên header",
            summary.header,
            LayoutPanelTop,
            "bg-sky-50 text-sky-700",
          ],
          [
            "Hiện ở footer",
            summary.footer,
            PanelBottom,
            "bg-violet-50 text-violet-700",
          ],
        ].map(([label, value, Icon, color]) => {
          const StatIcon = Icon as typeof FileText;
          return (
            <div
              key={String(label)}
              className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
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
        <div className="grid gap-3 lg:grid-cols-[1fr_210px_190px]">
          <label className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên hoặc đường dẫn..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none transition focus:border-[#C9894B]"
            />
          </label>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as typeof category)
            }
            className="h-11 rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
          >
            <option value="ALL">Tất cả nhóm</option>
            <option value="ABOUT">Về Kippora</option>
            <option value="SUPPORT">Hỗ trợ</option>
            <option value="POLICY">Chính sách</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-11 rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="PUBLISHED">Đã công khai</option>
            <option value="DRAFT">Bản nháp</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-[#78866B]">
            <LoaderCircle size={20} className="mr-2 animate-spin" /> Đang tải
            nội dung...
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <FileText size={38} className="text-[#CBBFB5]" />
            <p className="mt-3 font-semibold text-[#4A2C20]">
              Chưa có trang phù hợp
            </p>
            <p className="mt-1 text-sm text-[#8A817B]">
              Thử đổi từ khóa hoặc bộ lọc.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EFE7DF]">
            {filteredPages.map((page) => {
              const categoryInfo = categoryView[page.category];
              const editor =
                page.updatedBy?.profile?.fullName || page.updatedBy?.email;
              return (
                <article
                  key={page.id}
                  className="grid gap-4 p-5 transition hover:bg-[#FFFDFC] xl:grid-cols-[minmax(280px,1.5fr)_150px_190px_190px_auto] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold text-[#2A211D]">
                        {page.title}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryInfo.className}`}
                      >
                        {categoryInfo.label}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[#78866B]">
                      {page.summary || "Chưa có mô tả ngắn"}
                    </p>
                    <p className="mt-1 text-xs text-[#A0968F]">
                      /thong-tin/{page.slug}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-[#A0968F]">Vị trí</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {page.showInHeader && (
                        <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-700">
                          Header
                        </span>
                      )}
                      {page.showInFooter && (
                        <span className="rounded-md bg-violet-50 px-2 py-1 text-violet-700">
                          Footer
                        </span>
                      )}
                      {!page.showInHeader && !page.showInFooter && (
                        <span className="text-[#A0968F]">Liên kết riêng</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-[#A0968F]">Cập nhật gần nhất</p>
                    <p className="mt-1 text-sm font-medium text-[#5E5650]">
                      {new Intl.DateTimeFormat("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(new Date(page.updatedAt))}
                    </p>
                    {editor && (
                      <p className="mt-0.5 truncate text-xs text-[#A0968F]">
                        Bởi {editor}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-[#A0968F]">Trạng thái</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${page.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {page.isPublished ? "Đã công khai" : "Bản nháp"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 xl:justify-end">
                    {page.isPublished && (
                      <Link
                        href={`/thong-tin/${page.slug}`}
                        target="_blank"
                        aria-label={`Xem ${page.title}`}
                        title="Xem trang"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9E1D8] text-[#5E5650] hover:bg-[#FAF8F5]"
                      >
                        <Eye size={18} />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(page)}
                      aria-label={`Sửa ${page.title}`}
                      title="Sửa nội dung"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9E1D8] text-[#A35D27] hover:bg-orange-50"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePublished(page)}
                      disabled={updatingId === page.id}
                      className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-60 ${page.isPublished ? "bg-[#F5F1ED] text-[#5E5650] hover:bg-[#ECE5DE]" : "bg-[#4A2C20] text-white hover:bg-[#382118]"}`}
                    >
                      {updatingId === page.id ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : page.isPublished ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                      {page.isPublished ? "Ẩn" : "Công khai"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="content-form-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[#E9E1D8] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#E9E1D8] px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C57935]">
                  Nội dung website
                </p>
                <h2
                  id="content-form-title"
                  className="mt-1 text-2xl font-bold text-[#2A211D]"
                >
                  {editingPage ? "Cập nhật trang" : "Thêm trang mới"}
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

            <div className="overflow-y-auto px-5 py-5 sm:px-7">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                  Tên trang *
                  <input
                    value={form.title}
                    onChange={(event) =>
                      updateForm("title", event.target.value)
                    }
                    maxLength={180}
                    className="h-12 w-full rounded-xl border border-[#E4D8CD] px-4 font-normal outline-none focus:border-[#C9894B]"
                    placeholder="VD: Câu chuyện Kippora"
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold text-[#4A403A]">
                  Nhóm nội dung *
                  <select
                    value={form.category}
                    onChange={(event) =>
                      updateForm(
                        "category",
                        event.target.value as ContentPageCategory,
                      )
                    }
                    className="h-12 w-full rounded-xl border border-[#E4D8CD] bg-white px-4 font-normal outline-none focus:border-[#C9894B]"
                  >
                    <option value="ABOUT">Về Kippora</option>
                    <option value="SUPPORT">Hỗ trợ</option>
                    <option value="POLICY">Chính sách</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-semibold text-[#4A403A] sm:col-span-2">
                  Đường dẫn
                  <input
                    value={form.slug}
                    onChange={(event) =>
                      updateForm("slug", event.target.value.toLowerCase())
                    }
                    maxLength={120}
                    className="h-12 w-full rounded-xl border border-[#E4D8CD] px-4 font-normal outline-none focus:border-[#C9894B]"
                    placeholder="Để trống để hệ thống tự tạo từ tên trang"
                  />
                  <span className="block text-xs font-normal text-[#A0968F]">
                    Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.
                  </span>
                </label>
                <label className="space-y-2 text-sm font-semibold text-[#4A403A] sm:col-span-2">
                  Mô tả ngắn
                  <textarea
                    value={form.summary}
                    onChange={(event) =>
                      updateForm("summary", event.target.value)
                    }
                    maxLength={500}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-[#E4D8CD] px-4 py-3 font-normal leading-6 outline-none focus:border-[#C9894B]"
                    placeholder="Một câu giúp khách hiểu nhanh nội dung trang"
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold text-[#4A403A] sm:col-span-2">
                  Nội dung *
                  <textarea
                    value={form.content}
                    onChange={(event) =>
                      updateForm("content", event.target.value)
                    }
                    maxLength={50000}
                    rows={14}
                    className="w-full rounded-xl border border-[#E4D8CD] px-4 py-3 font-normal leading-6 outline-none focus:border-[#C9894B]"
                    placeholder={
                      "## Tiêu đề phần\nNội dung mô tả...\n- Ý thứ nhất\n- Ý thứ hai"
                    }
                  />
                  <span className="block text-xs font-normal text-[#A0968F]">
                    Dùng <b>##</b> cho tiêu đề nhỏ và <b>-</b> cho danh sách.
                    Nội dung được hiển thị an toàn, không nhận mã HTML.
                  </span>
                </label>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_150px]">
                {[
                  [
                    "isPublished",
                    "Công khai cho khách",
                    "Khách có thể mở trang",
                  ],
                  ["showInHeader", "Hiện trên header", "Tối đa 3 mục đầu tiên"],
                  ["showInFooter", "Hiện ở footer", "Theo đúng nhóm nội dung"],
                ].map(([key, label, hint]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer gap-3 rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] p-3"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(form[key as keyof ContentForm])}
                      onChange={(event) =>
                        updateForm(
                          key as
                            "isPublished" | "showInHeader" | "showInFooter",
                          event.target.checked,
                        )
                      }
                      className="mt-0.5 h-4 w-4 accent-[#4A2C20]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[#4A403A]">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-[#A0968F]">
                        {hint}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="space-y-2 rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] p-3 text-sm font-semibold text-[#4A403A]">
                  Thứ tự
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={form.sortOrder}
                    onChange={(event) =>
                      updateForm("sortOrder", event.target.value)
                    }
                    className="h-9 w-full rounded-lg border border-[#E4D8CD] bg-white px-3 font-normal outline-none focus:border-[#C9894B]"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#E9E1D8] bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-[#E4D8CD] px-5 py-3 text-sm font-semibold text-[#5E5650] hover:bg-[#FAF8F5] disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white hover:bg-[#382118] disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Đang lưu..." : "Lưu nội dung"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
