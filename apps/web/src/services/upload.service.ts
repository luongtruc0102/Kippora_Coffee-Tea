type UploadImageResponse = {
    imageUrl: string;
  };
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  
  export async function uploadProductImage(
    accessToken: string,
    file: File,
  ): Promise<UploadImageResponse> {
    if (!API_URL) {
      throw new Error(
        'Thiếu NEXT_PUBLIC_API_URL',
      );
    }
  
    const formData =
      new FormData();
  
    formData.append(
      'file',
      file,
    );
  
    const response = await fetch(
      `${API_URL}/uploads/products`,
      {
        method: 'POST',
  
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
  
        body: formData,
      },
    );
  
    const data =
      await response.json();
  
    if (!response.ok) {
      throw new Error(
        data.message ||
          'Không thể tải ảnh lên',
      );
    }
  
    return data;
  }

  // Upload ảnh topping riêng để backend lưu tài nguyên đúng thư mục.
  export async function uploadToppingImage(
    accessToken: string,
    file: File,
  ): Promise<UploadImageResponse> {
    if (!API_URL) {
      throw new Error('Thiếu NEXT_PUBLIC_API_URL');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Ảnh topping chỉ hỗ trợ JPG, PNG hoặc WEBP');
    }

    if (file.size > 3 * 1024 * 1024) {
      throw new Error('Ảnh topping không được vượt quá 3MB');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/uploads/toppings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message;
      throw new Error(message || 'Không thể tải ảnh topping lên');
    }

    return data;
  }

  // Upload ảnh đại diện của tài khoản hiện tại.
  export async function uploadAvatar(
    accessToken: string,
    file: File,
  ): Promise<UploadImageResponse> {
    if (!API_URL) {
      throw new Error(
        'Thiếu NEXT_PUBLIC_API_URL',
      );
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      throw new Error(
        'Avatar chỉ hỗ trợ JPG, PNG hoặc WEBP',
      );
    }

    if (
      file.size >
      2 * 1024 * 1024
    ) {
      throw new Error(
        'Avatar không được vượt quá 2MB',
      );
    }

    const formData =
      new FormData();

    formData.append(
      'file',
      file,
    );

    const response = await fetch(
      `${API_URL}/uploads/avatars`,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        body: formData,
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
          'Không thể tải avatar lên',
      );
    }

    return data;
  }
