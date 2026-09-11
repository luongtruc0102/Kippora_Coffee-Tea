"use client";

import Image from "next/image";

import { useEffect, useMemo, useState } from "react";

import { Coffee, LoaderCircle, Search, Star, Heart } from "lucide-react";

import {
  getPublicCategories,
  getPublicProducts,
} from "@/services/menu.service";

import type { Category, Product } from "@/types/menu";

import ToastMessage from "@/components/ui/toast-message";
import ProductOrderModal from "@/components/user/product-order-modal";
import { getProductReviewSummaries } from "@/services/review.service";
import type { ProductReviewSummary } from "@/types/review";
import { useFavorites } from "@/hooks/use-favorites";

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [searchError, setSearchError] = useState("");

  const [searching, setSearching] = useState(false);

  const [search, setSearch] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | "ALL">(
    "ALL",
  );

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [
    reviewSummaries,
    setReviewSummaries,
  ] = useState<
    Record<
      number,
      ProductReviewSummary
    >
  >({});

  const {
    loadingFavorites,
    updatingProductId,
    isFavorite,
    toggleFavorite,
  } = useFavorites();

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoading(true);
        setError("");

        const [
          categoryData,
          productData,
          reviewSummaryData,
        ] = await Promise.all([
          getPublicCategories(),
          getPublicProducts(),
          getProductReviewSummaries(),
        ]);

        setCategories(categoryData);
        setProducts(productData);
        setAllProducts(productData);

        setReviewSummaries(
          Object.fromEntries(
            reviewSummaryData.map(
              (summary) => [
                summary.productId,
                summary,
              ],
            ),
          ),
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : "Không thể tải menu");
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, []);

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

        const productData = await getPublicProducts(
          debouncedSearch,
          controller.signal,
        );

        setProducts(productData);
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

  const filteredProducts = useMemo(
    () =>
      visibleProducts.filter(
        (product) =>
          selectedCategory === "ALL" || product.categoryId === selectedCategory,
      ),
    [visibleProducts, selectedCategory],
  );

  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value));
  }

  function getProductImageUrl(imageUrl: string | null) {
    if (!imageUrl) {
      return null;
    }

    // Nếu database đã lưu URL đầy đủ thì dùng trực tiếp
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      return null;
    }

    const normalizedPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;

    return `${apiUrl}${normalizedPath}`;
  }

  function getStartingPrice(product: Product) {
    const activeVariants = product.variants.filter(
      (variant) => variant.isActive,
    );

    if (activeVariants.length === 0) {
      return null;
    }

    return Math.min(...activeVariants.map((variant) => Number(variant.price)));
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#4A2C20]">
          <Coffee size={23} />
        </div>

        <h1 className="mt-4 text-3xl font-bold text-[#1F1B18] sm:text-4xl">
          Menu Kippora
        </h1>

        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#78866B] sm:text-base">
          Chọn món bạn yêu thích và thưởng thức theo cách riêng của mình.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
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
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm cà phê, trà, thức uống..."
            aria-busy={isSearching}
            className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-10 text-sm outline-none transition focus:border-[#C9894B]"
          />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              selectedCategory === "ALL"
                ? "bg-[#4A2C20] text-white"
                : "bg-[#FAF8F5] text-[#5E5650] hover:bg-[#F3E9DE]"
            }`}
          >
            Tất cả
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedCategory === category.id
                  ? "bg-[#4A2C20] text-white"
                  : "bg-[#FAF8F5] text-[#5E5650] hover:bg-[#F3E9DE]"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <ToastMessage message={displayedError} />

      {loading ? (
        <div className="py-16 text-center text-sm text-[#78866B]">
          Đang tải menu...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center">
          <Coffee size={34} className="mx-auto text-[#C9BBB0]" />

          <p className="mt-3 text-sm text-[#78866B]">
            Không tìm thấy sản phẩm phù hợp.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const startingPrice = getStartingPrice(product);

            const imageUrl = getProductImageUrl(product.imageUrl);

            const reviewSummary = reviewSummaries[ product.id ];

            return (
              <article
                key={product.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="relative aspect-square overflow-hidden bg-[#F3E9DE] sm:aspect-[4/3]">
                  <button
                    type="button"
                    disabled={
                      loadingFavorites ||
                      updatingProductId !== null
                    }
                    aria-label={
                      isFavorite(product.id)
                        ? `Bỏ yêu thích ${product.name}`
                        : `Yêu thích ${product.name}`
                    }
                    title={
                      isFavorite(product.id)
                        ? "Bỏ yêu thích"
                        : "Thêm vào yêu thích"
                    }
                    onClick={() =>
                      void toggleFavorite(
                        product.id,
                      )
                    }
                    className={`absolute right-3 top-3 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border shadow-sm backdrop-blur transition disabled:cursor-wait disabled:opacity-60 ${
                      isFavorite(product.id)
                        ? "border-[#E7A35B] bg-[#FFF4E8] text-[#D9772B]"
                        : "border-white/80 bg-white/90 text-[#6B625C] hover:text-[#D9772B]"
                    }`}
                  >
                    <Heart
                      size={20}
                      className={
                        isFavorite(product.id)
                          ? "fill-current"
                          : ""
                      }
                    />
                  </button>
                  {imageUrl ? (
                    <Image
                      unoptimized
                      src={imageUrl}
                      alt={product.name}
                      width={640}
                      height={480}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#C9894B]">
                      <Coffee size={42} />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col bg-[#FFFDFC] p-3 sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C9894B] sm:text-xs">
                    {product.category.name}
                  </p>

                  <h2 className="mt-1 line-clamp-1 text-base font-bold text-[#2A211D] sm:text-lg">
                    {product.name}
                  </h2>

                  <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                    <Star
                      size={15}
                      className={
                        reviewSummary
                          ? "fill-[#E6A23C] text-[#E6A23C]"
                          : "text-[#C9BBB0]"
                      }
                    />

                    {reviewSummary ? (
                      <>
                        <span className="font-bold text-[#4A2C20]">
                          {
                            reviewSummary.averageRating
                          }
                        </span>

                        <span className="text-[#8A817B]">
                          ({
                            reviewSummary.reviewCount
                          } đánh giá)
                        </span>
                      </>
                    ) : (
                      <span className="text-[#8A817B]">
                        Chưa có đánh giá
                      </span>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#5E5650] sm:text-sm">
                    {product.description || "Một lựa chọn hấp dẫn từ Kippora."}
                  </p>

                  <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#6B625C]">
                        Giá từ
                      </p>

                      <p className="mt-0.5 whitespace-nowrap text-base font-bold text-[#3B2118] sm:text-xl">
                        {startingPrice !== null
                          ? formatCurrency(startingPrice)
                          : "Tạm hết"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={startingPrice === null}
                      onClick={() => setSelectedProduct(product)}
                      className="shrink-0 whitespace-nowrap rounded-xl bg-[#4A2C20] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#382118] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
                    >
                      Chọn món
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ProductOrderModal
        open={selectedProduct !== null}
        product={selectedProduct}
        isFavorite={
          selectedProduct
            ? isFavorite(
                selectedProduct.id,
              )
            : false
        }
        favoriteUpdating={
          loadingFavorites ||
          (selectedProduct
            ? updatingProductId ===
              selectedProduct.id
            : false)
        }
        onToggleFavorite={() => {
          if (!selectedProduct) {
            return;
          }

          void toggleFavorite(
            selectedProduct.id,
          );
        }}
        onClose={() =>
          setSelectedProduct(null)
        }
      />
    </div>
  );
}
