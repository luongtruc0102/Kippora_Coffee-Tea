import type {
    Product,
  } from '@/types/menu';
  
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL;
  
  function getApiUrl() {
    if (!API_URL) {
      throw new Error(
        'Thiếu NEXT_PUBLIC_API_URL',
      );
    }
  
    return API_URL;
  }
  
  function getHeaders(
    accessToken: string,
  ) {
    return {
      'Content-Type':
        'application/json',
  
      Authorization:
        `Bearer ${accessToken}`,
    };
  }
  
  async function readResponse<T>(
    response: Response,
    fallbackMessage: string,
  ): Promise<T> {
    const data = await response
      .json()
      .catch(() => null);
  
    if (!response.ok) {
      const message =
        Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message;
  
      throw new Error(
        message || fallbackMessage,
      );
    }
  
    return data;
  }
  
  export type FavoriteMutationResult = {
    productId: number;
    isFavorite: boolean;
  };
  
  /**
   * Lấy toàn bộ sản phẩm yêu thích còn hoạt động.
   * Dùng cho trang /favorites ở bước sau.
   */
  export async function getFavorites(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<Product[]> {
    const response = await fetch(
      `${getApiUrl()}/favorites`,
      {
        headers:
          getHeaders(accessToken),
  
        cache: 'no-store',
        signal,
      },
    );
  
    return readResponse<Product[]>(
      response,
      'Không thể tải sản phẩm yêu thích',
    );
  }
  
  /**
   * Chỉ lấy ID để đánh dấu trái tim trên Menu.
   */
  export async function getFavoriteIds(
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<number[]> {
    const response = await fetch(
      `${getApiUrl()}/favorites/ids`,
      {
        headers:
          getHeaders(accessToken),
  
        cache: 'no-store',
        signal,
      },
    );
  
    return readResponse<number[]>(
      response,
      'Không thể tải danh sách yêu thích',
    );
  }
  
  export async function addFavorite(
    accessToken: string,
    productId: number,
  ): Promise<FavoriteMutationResult> {
    const response = await fetch(
      `${getApiUrl()}/favorites/${productId}`,
      {
        method: 'POST',
  
        headers:
          getHeaders(accessToken),
      },
    );
  
    return readResponse<FavoriteMutationResult>(
      response,
      'Không thể thêm sản phẩm yêu thích',
    );
  }
  
  export async function removeFavorite(
    accessToken: string,
    productId: number,
  ): Promise<FavoriteMutationResult> {
    const response = await fetch(
      `${getApiUrl()}/favorites/${productId}`,
      {
        method: 'DELETE',
  
        headers:
          getHeaders(accessToken),
      },
    );
  
    return readResponse<FavoriteMutationResult>(
      response,
      'Không thể bỏ sản phẩm yêu thích',
    );
  }