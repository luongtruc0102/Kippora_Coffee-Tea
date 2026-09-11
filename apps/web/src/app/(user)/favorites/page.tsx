'use client';

import {
  useEffect,
  useState,
} from 'react';

import Image from 'next/image';
import Link from 'next/link';

import {
  Coffee,
  Heart,
  ShoppingBag,
} from 'lucide-react';

import {
  useRouter,
} from 'next/navigation';

import {
  getFavorites,
  removeFavorite,
} from '@/services/favorite.service';

import type {
  Product,
} from '@/types/menu';

import {
  useAppToast,
} from '@/components/ui/app-toast-provider';

import ProductOrderModal from '@/components/user/product-order-modal';

export default function FavoritesPage() {
  const router = useRouter();

  const { showToast } =
    useAppToast();

  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState<Product | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    updatingProductId,
    setUpdatingProductId,
  ] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const accessToken =
      sessionStorage.getItem(
        'accessToken',
      );

    if (!accessToken) {
      router.replace(
        '/login?redirect=/favorites',
      );

      return;
    }

    const controller =
      new AbortController();

    async function loadFavorites() {
      try {
        const data =
          await getFavorites(
            accessToken!,
            controller.signal,
          );

        setProducts(data);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name ===
            'AbortError'
        ) {
          return;
        }

        showToast(
          error instanceof Error
            ? error.message
            : 'Không thể tải món yêu thích',
          'error',
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    void loadFavorites();

    return () =>
      controller.abort();
  }, [
    router,
    showToast,
  ]);

  function formatCurrency(
    value: number | string,
  ) {
    return new Intl.NumberFormat(
      'vi-VN',
      {
        style: 'currency',
        currency: 'VND',
      },
    ).format(Number(value));
  }

  function getProductImageUrl(
    imageUrl: string | null,
  ) {
    if (!imageUrl) {
      return null;
    }

    if (
      imageUrl.startsWith(
        'http://',
      ) ||
      imageUrl.startsWith(
        'https://',
      )
    ) {
      return imageUrl;
    }

    const apiUrl =
      process.env
        .NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      return null;
    }

    const normalizedPath =
      imageUrl.startsWith('/')
        ? imageUrl
        : `/${imageUrl}`;

    return `${apiUrl}${normalizedPath}`;
  }

  function getStartingPrice(
    product: Product,
  ) {
    const variants =
      product.variants.filter(
        (variant) =>
          variant.isActive,
      );

    if (variants.length === 0) {
      return null;
    }

    return Math.min(
      ...variants.map(
        (variant) =>
          Number(variant.price),
      ),
    );
  }

  async function handleRemoveFavorite(
    productId: number,
  ) {
    const accessToken =
      sessionStorage.getItem(
        'accessToken',
      );

    if (!accessToken) {
      router.replace(
        '/login?redirect=/favorites',
      );

      return;
    }

    try {
      setUpdatingProductId(
        productId,
      );

      await removeFavorite(
        accessToken,
        productId,
      );

      setProducts(
        (current) =>
          current.filter(
            (product) =>
              product.id !==
              productId,
          ),
      );

      if (
        selectedProduct?.id ===
        productId
      ) {
        setSelectedProduct(null);
      }

      showToast(
        'Đã bỏ khỏi danh sách yêu thích.',
        'success',
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Không thể bỏ món yêu thích',
        'error',
      );
    } finally {
      setUpdatingProductId(
        null,
      );
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
          Bộ sưu tập của bạn
        </p>

        <h1 className="mt-2 text-3xl font-bold text-[#2A211D] sm:text-4xl">
          Món yêu thích
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-[#78866B] sm:text-base">
          Lưu lại những món hợp gu để
          lần sau chọn nhanh hơn.
        </p>
      </div>

      {loading ? (
        <div className="mt-8 rounded-3xl border border-[#E9E1D8] bg-white p-10 text-center text-sm text-[#78866B]">
          Đang tải món yêu thích...
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#E9E1D8] bg-white px-6 py-14 text-center shadow-sm">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1E3] text-[#C9894B]">
            <Heart size={28} />
          </span>

          <h2 className="mt-5 text-xl font-bold text-[#2A211D]">
            Chưa có món yêu thích
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#78866B]">
            Bấm biểu tượng trái tim trên
            món bạn thích để lưu lại tại
            đây.
          </p>

          <Link
            href="/menu"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white"
          >
            <ShoppingBag size={18} />
            Khám phá Menu
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {products.map(
            (product) => {
              const imageUrl =
                getProductImageUrl(
                  product.imageUrl,
                );

              const startingPrice =
                getStartingPrice(
                  product,
                );

              return (
                <article
                  key={product.id}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#F3E9DE] sm:aspect-[4/3]">
                    <button
                      type="button"
                      disabled={
                        updatingProductId !==
                        null
                      }
                      title="Bỏ yêu thích"
                      aria-label={`Bỏ yêu thích ${product.name}`}
                      onClick={() =>
                        void handleRemoveFavorite(
                          product.id,
                        )
                      }
                      className="absolute right-3 top-3 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E7A35B] bg-[#FFF4E8] text-[#D9772B] shadow-sm transition disabled:cursor-wait disabled:opacity-60"
                    >
                      <Heart
                        size={20}
                        className="fill-current"
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
                        <Coffee
                          size={42}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col bg-[#FFFDFC] p-3 sm:p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C9894B] sm:text-xs">
                      {
                        product.category
                          .name
                      }
                    </p>

                    <h2 className="mt-1 line-clamp-1 text-base font-bold text-[#2A211D] sm:text-lg">
                      {product.name}
                    </h2>

                    <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#5E5650] sm:text-sm">
                      {product.description ||
                        'Một lựa chọn hấp dẫn từ Kippora.'}
                    </p>

                    <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                      <div>
                        <p className="text-xs font-medium text-[#6B625C]">
                          Giá từ
                        </p>

                        <p className="mt-0.5 whitespace-nowrap text-base font-bold text-[#3B2118] sm:text-xl">
                          {startingPrice !==
                          null
                            ? formatCurrency(
                                startingPrice,
                              )
                            : 'Tạm hết'}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          startingPrice ===
                          null
                        }
                        onClick={() =>
                          setSelectedProduct(
                            product,
                          )
                        }
                        className="shrink-0 cursor-pointer rounded-xl bg-[#4A2C20] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
                      >
                        Chọn món
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}

      <ProductOrderModal
        open={
          selectedProduct !== null
        }
        product={selectedProduct}
        isFavorite
        favoriteUpdating={
          selectedProduct
            ? updatingProductId ===
              selectedProduct.id
            : false
        }
        onToggleFavorite={() => {
          if (!selectedProduct) {
            return;
          }

          void handleRemoveFavorite(
            selectedProduct.id,
          );
        }}
        onClose={() =>
          setSelectedProduct(null)
        }
      />
    </main>
  );
}