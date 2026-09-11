"use client";

import Image from "next/image";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  UnlockKeyhole,
  Coffee,
  ChevronDown,
  LoaderCircle,
} from "lucide-react";

import {
  getAdminProducts,
  updateProductStatus,
} from "@/services/product.service";

import type { Product } from "@/types/product";

import ProductFormModal from "@/components/admin/product-form-modal";
import ProductDetailModal from "@/components/admin/product-detail-modal";
import ToastMessage from "@/components/ui/toast-message";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [searching, setSearching] = useState(false);

  const [searchError, setSearchError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [formOpen, setFormOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async (query = "") => {
    try {
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const allData = await getAdminProducts(accessToken);
      const data = query ? await getAdminProducts(accessToken, query) : allData;

      setAllProducts(allData);
      setProducts(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể tải sản phẩm",
      );
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      try {
        setLoading(true);

        await loadProducts();
      } finally {
        setLoading(false);
      }
    }

    initialLoad();
  }, [loadProducts]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (loading || !debouncedSearch) {
      return;
    }

    const controller = new AbortController();

    async function searchProducts() {
      try {
        setSearching(true);
        setSearchError("");

        const accessToken = sessionStorage.getItem("accessToken");

        if (!accessToken) {
          throw new Error("Không tìm thấy phiên đăng nhập.");
        }

        const data = await getAdminProducts(
          accessToken,
          debouncedSearch,
          controller.signal,
        );

        setProducts(data);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSearchError(
          error instanceof Error ? error.message : "Không thể tìm sản phẩm",
        );
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }

    void searchProducts();

    return () => controller.abort();
  }, [debouncedSearch, loading]);

  const visibleProducts = debouncedSearch ? products : allProducts;
  const isSearching = Boolean(debouncedSearch) && searching;
  const displayedError = error || (debouncedSearch ? searchError : "");

  const categories = useMemo(() => {
    const categoryMap = new Map<number, string>();

    allProducts.forEach((product) => {
      categoryMap.set(product.category.id, product.category.name);
    });

    return Array.from(categoryMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    return visibleProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === "ALL" ||
        product.categoryId === Number(selectedCategory);

      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "ACTIVE" && product.isActive) ||
        (selectedStatus === "INACTIVE" && !product.isActive);

      return matchesCategory && matchesStatus;
    });
  }, [visibleProducts, selectedCategory, selectedStatus]);

  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value));
  }

  async function handleToggleStatus(product: Product) {
    try {
      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        return;
      }

      setUpdatingId(product.id);
      setError("");

      const updated = await updateProductStatus(
        accessToken,
        product.id,
        !product.isActive,
      );

      const updateStatusInList = (current: Product[]) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                isActive: updated.isActive,
              }
            : item,
        );

      // Cập nhật local state để không phải reload cả danh sách
      setProducts(updateStatusInList);
      setAllProducts(updateStatusInList);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái sản phẩm",
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
            Quản lý sản phẩm
          </h2>

          <p className="mt-1 text-[#78866B]">
            Quản lý menu, giá, danh mục, size và topping.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex w-fit items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
        >
          <Plus size={18} />
          Thêm sản phẩm
        </button>
      </div>

      <ToastMessage message={displayedError} />

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />

            {isSearching && (
              <LoaderCircle
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#C9894B]"
              />
            )}

            <input
              value={search}
              type="search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm sản phẩm..."
              aria-busy={isSearching}
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-10 text-sm text-[#1F1B18] outline-none transition focus:border-[#C9894B]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm text-[#1F1B18] outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả danh mục</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5E5650]"
            />
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-12 text-sm text-[#1F1B18] outline-none focus:border-[#C9894B]"
            >
              <option value="ALL">Tất cả trạng thái</option>

              <option value="ACTIVE">Đang bán</option>

              <option value="INACTIVE">Đã khóa</option>
            </select>

            <ChevronDown
              size={18}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5E5650]"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-[#78866B]">
            Đang tải danh sách sản phẩm...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[29%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-[#FAF8F5]">
                <tr className="border-b border-[#E9E1D8] text-left text-xs font-semibold uppercase tracking-wide text-[#78866B]">
                  <th className="px-5 py-4">Sản phẩm</th>

                  <th className="px-5 py-4">Danh mục</th>

                  <th className="px-5 py-4">Giá cơ bản</th>

                  <th className="px-5 py-4">Size</th>

                  <th className="px-5 py-4">Topping</th>

                  <th className="px-5 py-4">Trạng thái</th>

                  <th className="px-5 py-4 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-sm text-[#78866B]"
                    >
                      Không tìm thấy sản phẩm phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-[#F0E8E0] last:border-b-0 hover:bg-[#FCFAF7]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3E9DE]">
                            {product.imageUrl ? (
                              <Image
                                unoptimized
                                src={product.imageUrl}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Coffee size={20} className="text-[#4A2C20]" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#1F1B18]">
                              {product.name}
                            </p>

                            <p className="mt-1 truncate text-xs text-[#8A817B]">
                              {product.description ?? "Chưa có mô tả"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-[#5E5650]">
                        {product.category.name}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-[#4A2C20]">
                        {formatCurrency(product.price)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {product.variants.length > 0 ? (
                            product.variants.map((variant) => (
                              <span
                                key={variant.id}
                                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                                  variant.isActive
                                    ? "bg-[#F3E9DE] text-[#4A2C20]"
                                    : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                {variant.size}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#8A817B]">
                              Chưa có
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-[#5E5650]">
                        {product.toppings.length} topping
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            product.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {product.isActive ? "Đang bán" : "Đã khóa"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailProduct(product)}
                            title="Quản lý chi tiết"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7F2EC] text-[#5F7254] transition hover:bg-[#EAF3E7] hover:text-[#3F5D38]"
                          >
                            <Eye size={17} strokeWidth={2.2} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setFormOpen(true);
                            }}
                            title="Chỉnh sửa"
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF6EC] text-[#C9894B] transition hover:bg-[#FBE8D4] hover:text-[#A9682F]"
                          >
                            <Pencil size={17} strokeWidth={2.2} />
                          </button>

                          <button
                            type="button"
                            disabled={updatingId === product.id}
                            onClick={() => handleToggleStatus(product)}
                            title={
                              product.isActive
                                ? "Khóa sản phẩm"
                                : "Mở lại sản phẩm"
                            }
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:cursor-wait disabled:opacity-50 ${
                              product.isActive
                                ? "bg-[#FFF1F1] text-[#C85C5C] hover:bg-[#FFE4E4] hover:text-[#A84242]"
                                : "bg-[#EAF6EE] text-[#4F8A63] hover:bg-[#DDF0E3] hover:text-[#3A6F4D]"
                            }`}
                          >
                            {product.isActive ? (
                              <LockKeyhole size={17} strokeWidth={2.2} />
                            ) : (
                              <UnlockKeyhole size={17} strokeWidth={2.2} />
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
            {filteredProducts.length}
          </span>{" "}
          / {allProducts.length} sản phẩm
        </p>
      )}

      <ProductFormModal
        open={formOpen}
        mode={editingProduct ? "edit" : "create"}
        product={editingProduct}
        onClose={() => {
          setFormOpen(false);
          setEditingProduct(null);
        }}
        onSaved={() => {
          void loadProducts(debouncedSearch);
        }}
      />

      <ProductDetailModal
        open={detailProduct !== null}
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onSaved={async () => {
          await loadProducts(debouncedSearch);
        }}
      />
    </div>
  );
}
