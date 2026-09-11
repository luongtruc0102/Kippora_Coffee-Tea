"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  UnlockKeyhole,
  X,
  ChevronDown,
} from "lucide-react";

import {
  createCategory,
  getAdminCategories,
  updateCategory,
  updateCategoryStatus,
} from "@/services/category.service";

import type { Category } from "@/types/product";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import ToastMessage from "@/components/ui/toast-message";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const loadCategories = useCallback(
    async (query = "", signal?: AbortSignal) => {
      await Promise.resolve();

      try {
        setLoading(true);
        setError("");

        const accessToken = sessionStorage.getItem("accessToken");

        if (!accessToken) {
          throw new Error("Không tìm thấy phiên đăng nhập.");
        }

        const data = await getAdminCategories(accessToken, query, signal);

        setCategories(data);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setError(
          error instanceof Error ? error.message : "Không thể tải danh mục",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      void loadCategories(debouncedSearch, controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [debouncedSearch, loadCategories]);

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "ACTIVE" && category.isActive) ||
        (selectedStatus === "INACTIVE" && !category.isActive);

      return matchesStatus;
    });
  }, [categories, selectedStatus]);

  function openCreate() {
    setEditingCategory(null);
    setName("");
    setDescription("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setName(category.name);

    setDescription(category.description ?? "");

    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingCategory(null);
    setName("");
    setDescription("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      if (name.trim().length < 2) {
        throw new Error("Tên danh mục phải có ít nhất 2 ký tự.");
      }

      if (editingCategory) {
        await updateCategory(accessToken, editingCategory.id, {
          name: name.trim(),

          description: description.trim() || undefined,
        });
      } else {
        await createCategory(accessToken, {
          name: name.trim(),

          description: description.trim() || undefined,
        });
      }

      await loadCategories(debouncedSearch);
      closeForm();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể lưu danh mục",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(category: Category) {
    try {
      setError("");
      setUpdatingId(category.id);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const updated = await updateCategoryStatus(
        accessToken,
        category.id,
        !category.isActive,
      );

      setCategories((current) =>
        current.map((item) =>
          item.id === category.id
            ? {
                ...item,
                isActive: updated.isActive,
              }
            : item,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái danh mục",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#1F1B18]">
            Quản lý danh mục
          </h2>

          <p className="mt-1 text-[#78866B]">
            Quản lý nhóm sản phẩm trong menu Kippora.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex w-fit items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
        >
          <Plus size={18} />
          Thêm danh mục
        </button>
      </div>

      <ToastMessage message={error} />

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm danh mục..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none transition focus:border-[#C9894B]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm text-[#1F1B18] outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả trạng thái</option>

              <option value="ACTIVE">Đang hoạt động</option>

              <option value="INACTIVE">Đã khóa</option>
            </select>

            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#5E5650]"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[#78866B]">Đang tải danh mục...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[35%]" />
                <col className="w-[15%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-6 py-4">Danh mục</th>

                  <th className="px-6 py-4">Mô tả</th>

                  <th className="px-6 py-4">Sản phẩm</th>

                  <th className="px-6 py-4">Trạng thái</th>

                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy danh mục.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((category) => (
                    <tr
                      key={category.id}
                      className="border-b border-[#F0E8E0] last:border-b-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-6 py-4 font-semibold text-[#1F1B18]">
                        {category.name}
                      </td>

                      <td className="max-w-[400px] px-6 py-4 text-sm text-[#78866B]">
                        {category.description ?? "Chưa có mô tả"}
                      </td>

                      <td className="px-6 py-4 text-sm text-[#5E5650]">
                        {category._count?.products ?? 0} sản phẩm
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex min-w-[110px] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            category.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {category.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            title="Chỉnh sửa"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF6EC] text-[#C9894B] transition hover:bg-[#FBE8D4]"
                          >
                            <Pencil size={17} strokeWidth={2.2} />
                          </button>

                          <button
                            type="button"
                            disabled={updatingId === category.id}
                            onClick={() => handleToggleStatus(category)}
                            title={
                              category.isActive
                                ? "Khóa danh mục"
                                : "Mở lại danh mục"
                            }
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-50 ${
                              category.isActive
                                ? "bg-[#FFF1F1] text-[#C85C5C] hover:bg-[#FFE4E4]"
                                : "bg-[#EAF6EE] text-[#4F8A63] hover:bg-[#DDF0E3]"
                            }`}
                          >
                            {category.isActive ? (
                              <LockKeyhole size={17} />
                            ) : (
                              <UnlockKeyhole size={17} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-sm text-[#78866B]">
          Hiển thị{" "}
          <span className="font-semibold text-[#1F1B18]">
            {filteredCategories.length}
          </span>{" "}
          / {categories.length} danh mục
        </p>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E9E1D8] px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-[#1F1B18]">
                  {editingCategory ? "Chỉnh sửa danh mục" : "Thêm danh mục"}
                </h3>

                <p className="mt-1 text-sm text-[#78866B]">
                  {editingCategory
                    ? "Cập nhật thông tin danh mục."
                    : "Tạo danh mục mới cho menu."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] hover:bg-[#FAF8F5]"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Tên danh mục
                </label>

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Cà phê"
                  className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Mô tả
                </label>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Mô tả danh mục..."
                  className="w-full resize-none rounded-xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#F0E8E0] pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] hover:bg-[#FAF8F5]"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
                >
                  {saving
                    ? "Đang lưu..."
                    : editingCategory
                      ? "Lưu thay đổi"
                      : "Thêm danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
