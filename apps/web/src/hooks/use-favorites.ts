'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  addFavorite,
  getFavoriteIds,
  removeFavorite,
} from '@/services/favorite.service';

import {
  useAppToast,
} from '@/components/ui/app-toast-provider';

/**
 * Quản lý danh sách ID yêu thích và cập nhật lạc quan.
 * Nếu API lỗi, trạng thái trái tim được hoàn tác về như cũ.
 */
export function useFavorites() {
  const router = useRouter();
  const pathname = usePathname();

  const { showToast } =
    useAppToast();

  const [
    favoriteIds,
    setFavoriteIds,
  ] = useState<Set<number>>(
    () => new Set(),
  );

  const [
    loadingFavorites,
    setLoadingFavorites,
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
        let cancelled = false;
      
        queueMicrotask(() => {
          if (!cancelled) {
            setLoadingFavorites(
              false,
            );
          }
        });
      
        return () => {
          cancelled = true;
        };
      }

    const controller =
      new AbortController();

    async function loadFavorites() {
      try {
        setLoadingFavorites(true);

        const ids =
          await getFavoriteIds(
            accessToken!,
            controller.signal,
          );

        setFavoriteIds(
          new Set(ids),
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'AbortError'
        ) {
          return;
        }

        showToast(
          error instanceof Error
            ? error.message
            : 'Không thể tải danh sách yêu thích',
          'error',
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoadingFavorites(false);
        }
      }
    }

    void loadFavorites();

    return () =>
      controller.abort();
  }, [showToast]);

  const isFavorite =
    useCallback(
      (productId: number) =>
        favoriteIds.has(
          productId,
        ),
      [favoriteIds],
    );

  const toggleFavorite =
    useCallback(
      async (
        productId: number,
      ) => {
        if (
          updatingProductId !==
          null
        ) {
          return;
        }

        const accessToken =
          sessionStorage.getItem(
            'accessToken',
          );

        if (!accessToken) {
          showToast(
            'Vui lòng đăng nhập để lưu món yêu thích.',
            'info',
          );

          const redirect =
            encodeURIComponent(
              pathname || '/menu',
            );

          router.push(
            `/login?redirect=${redirect}`,
          );

          return;
        }

        const wasFavorite =
          favoriteIds.has(
            productId,
          );

        // Cập nhật UI ngay để nút trái tim phản hồi nhanh.
        setFavoriteIds(
          (current) => {
            const next =
              new Set(current);

            if (wasFavorite) {
              next.delete(
                productId,
              );
            } else {
              next.add(
                productId,
              );
            }

            return next;
          },
        );

        try {
          setUpdatingProductId(
            productId,
          );

          if (wasFavorite) {
            await removeFavorite(
              accessToken,
              productId,
            );

            showToast(
              'Đã bỏ khỏi danh sách yêu thích.',
              'success',
            );
          } else {
            await addFavorite(
              accessToken,
              productId,
            );

            showToast(
              'Đã thêm vào món yêu thích.',
              'success',
            );
          }
        } catch (error) {
          // API lỗi thì hoàn tác trạng thái vừa đổi.
          setFavoriteIds(
            (current) => {
              const next =
                new Set(current);

              if (wasFavorite) {
                next.add(
                  productId,
                );
              } else {
                next.delete(
                  productId,
                );
              }

              return next;
            },
          );

          showToast(
            error instanceof Error
              ? error.message
              : 'Không thể cập nhật món yêu thích',
            'error',
          );
        } finally {
          setUpdatingProductId(
            null,
          );
        }
      },
      [
        favoriteIds,
        pathname,
        router,
        showToast,
        updatingProductId,
      ],
    );

  return {
    favoriteIds,
    loadingFavorites,
    updatingProductId,
    isFavorite,
    toggleFavorite,
  };
}