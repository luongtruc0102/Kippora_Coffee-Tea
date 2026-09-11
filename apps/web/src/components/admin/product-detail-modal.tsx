"use client";

import { useEffect, useState } from "react";

import { LockKeyhole, Pencil, Plus, UnlockKeyhole, X } from "lucide-react";

import {
  createProductVariant,
  getAdminProductVariants,
  updateProductVariant,
  updateProductVariantStatus,
} from "@/services/variant.service";

import {
  addProductTopping,
  getAdminToppings,
  removeProductTopping,
} from "@/services/topping.service";

import type { Product, ProductVariant, Topping } from "@/types/product";
import ToastMessage from "@/components/ui/toast-message";

type Props = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};
export default function ProductDetailModal({
  open,
  product,
  onClose,
  onSaved,
}: Props) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [size, setSize] = useState("");

  const [price, setPrice] = useState("");

  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null,
  );

  const [toppings, setToppings] = useState<Topping[]>([]);

  const [selectedToppingIds, setSelectedToppingIds] = useState<Set<number>>(
    new Set(),
  );

  const [updatingToppingId, setUpdatingToppingId] = useState<number | null>(
    null,
  );

  const [showToppingPicker, setShowToppingPicker] = useState(false);

  async function handleSaveAndClose() {
    await onSaved();
    onClose();
  }

  useEffect(() => {
    if (!open || !product) {
      return;
    }

    const productId = product.id;
    const productToppings = product.toppings;

    async function loadVariants() {
      try {
        setLoading(true);
        setError("");

        const accessToken = sessionStorage.getItem("accessToken");

        if (!accessToken) {
          throw new Error("Không tìm thấy phiên đăng nhập.");
        }

        const [variantData, toppingData] = await Promise.all([
          getAdminProductVariants(accessToken, productId),

          getAdminToppings(accessToken),
        ]);

        setVariants(variantData);
        setToppings(toppingData);

        setSelectedToppingIds(
          new Set(productToppings.map((item) => item.toppingId)),
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Không thể tải thông tin sản phẩm",
        );
      } finally {
        setLoading(false);
      }
    }

    loadVariants();
  }, [open, product]);

  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value));
  }

  function resetVariantForm() {
    setSize("");
    setPrice("");
    setEditingVariant(null);
  }

  function handleEdit(variant: ProductVariant) {
    setEditingVariant(variant);
    setSize(variant.size);
    setPrice(String(variant.price));
  }

  async function handleSaveVariant() {
    if (!product) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const numericPrice = Number(price);

      if (!size.trim()) {
        throw new Error("Vui lòng nhập size.");
      }

      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        throw new Error("Giá size không hợp lệ.");
      }

      if (editingVariant) {
        const updated = await updateProductVariant(
          accessToken,
          editingVariant.id,
          {
            size: size.trim(),
            price: numericPrice,
          },
        );

        setVariants((current) =>
          current.map((variant) =>
            variant.id === updated.id ? updated : variant,
          ),
        );
      } else {
        const created = await createProductVariant(accessToken, product.id, {
          size: size.trim(),
          price: numericPrice,
        });

        setVariants((current) => [...current, created]);
      }

      resetVariantForm();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể lưu size");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(variant: ProductVariant) {
    try {
      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        return;
      }

      const updated = await updateProductVariantStatus(
        accessToken,
        variant.id,
        !variant.isActive,
      );

      setVariants((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái size",
      );
    }
  }

  if (!open || !product) {
    return null;
  }

  async function handleToggleTopping(topping: Topping) {
    if (!product) {
      return;
    }

    try {
      setError("");

      setUpdatingToppingId(topping.id);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      const isSelected = selectedToppingIds.has(topping.id);

      if (isSelected) {
        await removeProductTopping(accessToken, product.id, topping.id);

        setSelectedToppingIds((current) => {
          const next = new Set(current);

          next.delete(topping.id);

          return next;
        });
      } else {
        await addProductTopping(accessToken, product.id, topping.id);

        setSelectedToppingIds((current) => {
          const next = new Set(current);

          next.add(topping.id);

          return next;
        });
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể cập nhật topping",
      );
    } finally {
      setUpdatingToppingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-4">
          <div>
            <h3 className="text-xl font-semibold text-[#1F1B18]">
              {product.name}
            </h3>

            <p className="mt-1 text-sm text-[#78866B]">
              Quản lý size và topping của sản phẩm.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] transition hover:bg-[#FAF8F5]"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <ToastMessage message={error} />
          <div>
            <h4 className="text-lg font-semibold text-[#1F1B18]">
              Size / Variant
            </h4>

            <p className="mt-1 text-sm text-[#78866B]">
              Quản lý size và giá bán theo từng size.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={size}
              onChange={(event) => setSize(event.target.value)}
              placeholder="Size: S, M, L..."
              className="h-11 rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
            />

            <input
              type="number"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Giá"
              className="h-11 rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
            />

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveVariant}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:opacity-60"
            >
              <Plus size={17} />

              {editingVariant ? "Lưu" : "Thêm size"}
            </button>
          </div>

          {editingVariant && (
            <button
              type="button"
              onClick={resetVariantForm}
              className="text-sm font-medium text-[#78866B] hover:text-[#4A2C20]"
            >
              Hủy chỉnh sửa
            </button>
          )}

          <div className="overflow-hidden rounded-xl border border-[#E9E1D8]">
            {loading ? (
              <div className="p-5 text-sm text-[#78866B]">Đang tải size...</div>
            ) : variants.length === 0 ? (
              <div className="p-5 text-sm text-[#78866B]">
                Sản phẩm chưa có size.
              </div>
            ) : (
              <div className="divide-y divide-[#F0E8E0]">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                          variant.isActive
                            ? "bg-[#F3E9DE] text-[#4A2C20]"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {variant.size}
                      </div>

                      <div>
                        <p className="font-semibold text-[#1F1B18]">
                          {formatCurrency(variant.price)}
                        </p>

                        <p
                          className={`mt-1 text-xs ${
                            variant.isActive
                              ? "text-emerald-600"
                              : "text-red-500"
                          }`}
                        >
                          {variant.isActive ? "Đang hoạt động" : "Đã khóa"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(variant)}
                        title="Sửa size"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] transition hover:bg-[#FAF8F5] hover:text-[#C9894B]"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(variant)}
                        title={variant.isActive ? "Khóa size" : "Mở lại size"}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] transition hover:bg-[#FAF8F5]"
                      >
                        {variant.isActive ? (
                          <LockKeyhole size={17} />
                        ) : (
                          <UnlockKeyhole size={17} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#F0E8E0] pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-[#1F1B18]">
                    Topping áp dụng
                  </h4>

                  <p className="mt-1 text-sm text-[#78866B]">
                    Quản lý topping được phép sử dụng với sản phẩm này.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowToppingPicker((current) => !current)}
                  className="flex items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
                >
                  <Plus size={17} />
                  Thêm topping
                </button>
              </div>

              {showToppingPicker && (
                <div className="rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] p-4">
                  <p className="mb-3 text-sm font-medium text-[#1F1B18]">
                    Chọn topping muốn thêm
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {toppings
                      .filter(
                        (topping) =>
                          topping.isActive &&
                          !selectedToppingIds.has(topping.id),
                      )
                      .map((topping) => (
                        <button
                          key={topping.id}
                          type="button"
                          disabled={updatingToppingId === topping.id}
                          onClick={() => handleToggleTopping(topping)}
                          className="flex items-center justify-between rounded-xl border border-[#E9E1D8] bg-white px-4 py-3 text-left transition hover:border-[#C9894B] hover:bg-[#FFF8F0]"
                        >
                          <div>
                            <p className="font-semibold text-[#1F1B18]">
                              {topping.name}
                            </p>

                            <p className="mt-1 text-xs text-[#78866B]">
                              {formatCurrency(topping.price)}
                            </p>
                          </div>

                          <Plus size={17} className="text-[#4A2C20]" />
                        </button>
                      ))}

                    {toppings.filter(
                      (topping) =>
                        topping.isActive && !selectedToppingIds.has(topping.id),
                    ).length === 0 && (
                      <p className="text-sm text-[#78866B]">
                        Không còn topping nào để thêm.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-[#E9E1D8]">
                {selectedToppingIds.size === 0 ? (
                  <div className="p-5 text-sm text-[#78866B]">
                    Sản phẩm chưa có topping.
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0E8E0]">
                    {toppings
                      .filter((topping) => selectedToppingIds.has(topping.id))
                      .map((topping) => (
                        <div
                          key={topping.id}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-[#1F1B18]">
                              {topping.name}
                            </p>

                            <p className="mt-1 text-xs text-[#78866B]">
                              {formatCurrency(topping.price)}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={updatingToppingId === topping.id}
                            onClick={() => handleToggleTopping(topping)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
                          >
                            Gỡ
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#E9E1D8] bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] transition hover:bg-[#FAF8F5]"
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndClose}
                  className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
