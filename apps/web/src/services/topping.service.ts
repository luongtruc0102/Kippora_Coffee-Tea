import type {
  Topping,
} from '@/types/product';

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

// ADMIN lấy tất cả topping kể cả đã khóa
export async function getAdminToppings(
  accessToken: string,
  query = '',
  signal?: AbortSignal,
): Promise<Topping[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());

  const url = `${getApiUrl()}/toppings/admin/all?${params.toString()}`;

  const response = await fetch(
    url,
    {
      headers:
        getHeaders(accessToken),
      cache: 'no-store',
      signal,
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        'Không thể tải topping',
    );
  }

  return data;
}

// ADMIN tạo topping mới
export async function createTopping(
  accessToken: string,
  input: {
    name: string;
    price: number;
    imageUrl?: string | null;
  },
): Promise<Topping> {
  const response = await fetch(
    `${getApiUrl()}/toppings`,
    {
      method: 'POST',
      headers:
        getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        'Không thể tạo topping',
    );
  }

  return data;
}

// ADMIN cập nhật topping
export async function updateTopping(
  accessToken: string,
  toppingId: number,
  input: {
    name?: string;
    price?: number;
    imageUrl?: string | null;
  },
): Promise<Topping> {
  const response = await fetch(
    `${getApiUrl()}/toppings/${toppingId}`,
    {
      method: 'PATCH',
      headers:
        getHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        'Không thể cập nhật topping',
    );
  }

  return data;
}

// ADMIN khóa hoặc mở lại topping
export async function updateToppingStatus(
  accessToken: string,
  toppingId: number,
  isActive: boolean,
): Promise<Topping> {
  const response = await fetch(
    `${getApiUrl()}/toppings/${toppingId}/status`,
    {
      method: 'PATCH',
      headers:
        getHeaders(accessToken),
      body: JSON.stringify({
        isActive,
      }),
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        'Không thể thay đổi trạng thái topping',
    );
  }

  return data;
}

// Gắn topping vào sản phẩm
export async function addProductTopping(
  accessToken: string,
  productId: number,
  toppingId: number,
) {
  const response = await fetch(
    `${getApiUrl()}/products/${productId}/toppings/${toppingId}`,
    {
      method: 'POST',
      headers:
        getHeaders(accessToken),
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        'Không thể gắn topping',
    );
  }

  return data;
}

// Gỡ topping khỏi sản phẩm
export async function removeProductTopping(
  accessToken: string,
  productId: number,
  toppingId: number,
) {
  const response = await fetch(
    `${getApiUrl()}/products/${productId}/toppings/${toppingId}`,
    {
      method: 'DELETE',
      headers:
        getHeaders(accessToken),
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        'Không thể gỡ topping',
    );
  }

  return data;
}
