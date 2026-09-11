"use client";

import Image from "next/image";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { ImagePlus, Upload, X, ChevronDown } from "lucide-react";

import { createProduct, updateProduct } from "@/services/product.service";

import { getCategories } from "@/services/category.service";
import { uploadProductImage } from "@/services/upload.service";

import type { Category, Product } from "@/types/product";
import ToastMessage from "@/components/ui/toast-message";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  product?: Product | null;

  onClose: () => void;

  onSaved: (product: Product) => void;
};

export default function ProductFormModal({
  open,
  mode,
  product,
  onClose,
  onSaved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [price, setPrice] = useState("");

  const [categoryId, setCategoryId] = useState("");

  const [imageUrl, setImageUrl] = useState("");

  const [previewUrl, setPreviewUrl] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [dragging, setDragging] = useState(false);

  const [loading, setLoading] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    async function loadCategories() {
      try {
        const data = await getCategories();

        setCategories(data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Không thể tải danh mục",
        );
      }
    }

    loadCategories();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      if (mode === "edit" && product) {
        setName(product.name);
        setDescription(product.description ?? "");
        setPrice(String(product.price));
        setCategoryId(String(product.categoryId));
        setImageUrl(product.imageUrl ?? "");
        setPreviewUrl(product.imageUrl ?? "");
        setSelectedFile(null);
        return;
      }

      if (mode === "create") {
        resetForm();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, mode, product]);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setCategoryId("");
    setImageUrl("");
    setPreviewUrl("");
    setSelectedFile(null);
    setDragging(false);
    setError("");
  }

  function handleClose() {
    if (loading || uploading) {
      return;
    }

    resetForm();

    onClose();
  }

  function validateImage(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Chỉ được chọn file hình ảnh.");
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new Error("Ảnh không được lớn hơn 5MB.");
    }
  }

  function selectImage(file: File) {
    try {
      setError("");

      validateImage(file);

      setSelectedFile(file);

      const localUrl = URL.createObjectURL(file);

      setPreviewUrl(localUrl);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "File ảnh không hợp lệ",
      );
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    selectImage(file);

    // Cho phép chọn lại cùng một file
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    setDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    selectImage(file);
  }

  function removeImage() {
    setSelectedFile(null);
    setImageUrl("");
    setPreviewUrl("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        throw new Error("Không tìm thấy phiên đăng nhập.");
      }

      if (name.trim().length < 2) {
        throw new Error("Tên sản phẩm phải có ít nhất 2 ký tự.");
      }

      if (!categoryId) {
        throw new Error("Vui lòng chọn danh mục.");
      }

      const numericPrice = Number(price);

      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        throw new Error("Giá sản phẩm không hợp lệ.");
      }

      let finalImageUrl = imageUrl || undefined;

      // Chỉ upload khi người dùng chọn ảnh mới
      if (selectedFile) {
        setUploading(true);

        const uploadResult = await uploadProductImage(
          accessToken,
          selectedFile,
        );

        finalImageUrl = uploadResult.imageUrl;

        setUploading(false);
      }

      const input = {
        name: name.trim(),

        description: description.trim() || undefined,

        price: numericPrice,

        imageUrl: finalImageUrl,

        categoryId: Number(categoryId),
      };

      let savedProduct: Product;

      if (mode === "edit" && product) {
        savedProduct = await updateProduct(accessToken, product.id, input);
      } else {
        savedProduct = await createProduct(accessToken, input);
      }

      onSaved({
        ...savedProduct,

        variants: savedProduct.variants ?? product?.variants ?? [],

        toppings: savedProduct.toppings ?? product?.toppings ?? [],
      });

      resetForm();

      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể lưu sản phẩm",
      );
    } finally {
      setUploading(false);
      setLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  const isEdit = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E9E1D8] bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-4">
          <div>
            <h3 className="text-xl font-semibold text-[#1F1B18]">
              {isEdit ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
            </h3>

            <p className="mt-1 text-sm text-[#78866B]">
              {isEdit
                ? "Cập nhật thông tin sản phẩm."
                : "Tạo sản phẩm mới trong menu."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading || uploading}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] transition hover:bg-[#FAF8F5]"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <ToastMessage message={error} />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Tên sản phẩm
              </label>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nhập tên sản phẩm"
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Giá cơ bản
              </label>

              <input
                type="number"
                min="0"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Nhập giá"
                className="h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Danh mục
              </label>

              <div className="relative">
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-[#E9E1D8] bg-white pl-4 pr-10 text-sm outline-none transition focus:border-[#C9894B]"
                >
                  <option value="">Chọn danh mục</option>

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
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Hình ảnh
              </label>

              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-[#E9E1D8] bg-[#FAF8F5]">
                  <Image
                    unoptimized
                    src={previewUrl}
                    alt="Preview sản phẩm"
                    width={800}
                    height={256}
                    className="h-64 w-full object-contain"
                  />

                  <div className="absolute right-3 top-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#4A2C20] shadow-sm transition hover:bg-[#FAF8F5]"
                    >
                      Đổi ảnh
                    </button>

                    <button
                      type="button"
                      onClick={removeImage}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-500 shadow-sm transition hover:bg-red-50"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
                    dragging
                      ? "border-[#C9894B] bg-[#FFF8F0]"
                      : "border-[#DCCFC3] bg-[#FAF8F5] hover:border-[#C9894B]"
                  }`}
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E9DE] text-[#4A2C20]">
                    <ImagePlus size={22} />
                  </div>

                  <p className="text-sm font-semibold text-[#1F1B18]">
                    Kéo ảnh vào đây
                  </p>

                  <p className="mt-1 text-xs text-[#8A817B]">
                    hoặc bấm để chọn ảnh từ máy
                  </p>

                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#E9E1D8] bg-white px-3 py-2 text-xs font-medium text-[#4A2C20]">
                    <Upload size={15} />
                    Chọn ảnh
                  </div>

                  <p className="mt-3 text-xs text-[#A0968F]">
                    JPG, PNG, WEBP · tối đa 5MB
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
                Mô tả
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Mô tả sản phẩm..."
                className="w-full resize-none rounded-xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none transition focus:border-[#C9894B]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#F0E8E0] pt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || uploading}
              className="rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-medium text-[#5E5650] transition hover:bg-[#FAF8F5]"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={loading || uploading}
              className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
            >
              {uploading
                ? "Đang tải ảnh..."
                : loading
                  ? "Đang lưu..."
                  : isEdit
                    ? "Lưu thay đổi"
                    : "Thêm sản phẩm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
