export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: {
    id: number;
    email: string;
    fullName: string | null;
    role: string;
    phone: string | null;
    avatarUrl: string | null;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getApiUrl() {
  if (!API_URL) {
    throw new Error(
      'Thiếu NEXT_PUBLIC_API_URL trong .env.local',
    );
  }

  return API_URL;
}

// Đăng nhập và lấy JWT từ backend
export async function login(
  payload: LoginPayload,
): Promise<LoginResponse> {
  const response = await fetch(
    `${getApiUrl()}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Đăng nhập thất bại',
    );
  }

  return data;
}

// Đăng ký tài khoản USER mới
export async function register(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  const response = await fetch(
    `${getApiUrl()}/auth/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const message =
      Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message;

    throw new Error(
      message || 'Đăng ký tài khoản thất bại',
    );
  }

  return data;
}

export type CurrentUser = {
  id: number;
  email: string;

  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;

  address: string | null;

  loyaltyPoints: number;
  role: string;

  createdAt: string;
};

export async function getMe(
  accessToken: string,
): Promise<CurrentUser> {
  const response = await fetch(
    `${getApiUrl()}/auth/me`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },

      cache: 'no-store',
    },
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        'Không thể tải thông tin tài khoản',
    );
  }

  return data;
}

//Register
export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
};

export type RegisterResponse = {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: string;
};

export type UpdateProfileInput = {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
};

// Cập nhật thông tin hồ sơ của tài khoản hiện tại.
export async function updateProfile(
  accessToken: string,
  input: UpdateProfileInput,
): Promise<CurrentUser> {
  const response = await fetch(
    `${getApiUrl()}/auth/me`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type':
          'application/json',

        Authorization:
          `Bearer ${accessToken}`,
      },

      body:
        JSON.stringify(input),
    },
  );

  const data =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    const message =
      Array.isArray(
        data?.message,
      )
        ? data.message.join(', ')
        : data?.message;

    throw new Error(
      message ||
        'Không thể cập nhật hồ sơ',
    );
  }

  return data;
}

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ChangePasswordResponse = {
  message: string;
};

/**
 * Đổi mật khẩu của tài khoản đang đăng nhập.
 * Access Token xác định user nên frontend không gửi userId.
 */
export async function changePassword(
  accessToken: string,
  input: ChangePasswordInput,
): Promise<ChangePasswordResponse> {
  const response = await fetch(
    `${getApiUrl()}/auth/change-password`,
    {
      method: 'PATCH',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },

      body: JSON.stringify(input),
    },
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(
      data?.message,
    )
      ? data.message.join(', ')
      : data?.message;

    throw new Error(
      message ||
        'Không thể đổi mật khẩu',
    );
  }

  return data;
}