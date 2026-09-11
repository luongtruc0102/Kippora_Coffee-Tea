export type StoredAuthUser = {
    id: number;
    email: string;
  
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
  
    role: string;
  };
  
  export const AUTH_USER_UPDATED_EVENT =
    'auth-user-updated';
  
  // Lưu user mới và báo cho header cập nhật ngay mà không reload.
  export function persistAuthenticatedUser(
    user: StoredAuthUser,
  ) {
    sessionStorage.setItem(
      'user',
      JSON.stringify(user),
    );
  
    window.dispatchEvent(
      new CustomEvent<StoredAuthUser>(
        AUTH_USER_UPDATED_EVENT,
        {
          detail: user,
        },
      ),
    );
  }