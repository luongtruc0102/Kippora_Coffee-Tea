export const userProfileRelationsSelect = {
  profile: {
    select: {
      fullName: true,
      phone: true,
      avatarUrl: true,
      address: true,
    },
  },
  customerProfile: {
    select: {
      loyaltyPoints: true,
    },
  },
  staffProfile: {
    select: {
      branchId: true,
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
} as const;

export const personProfileSelect = {
  profile: {
    select: {
      fullName: true,
      phone: true,
      avatarUrl: true,
    },
  },
} as const;

type UserProfileRelations = {
  profile: {
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    address: string | null;
  } | null;
  customerProfile: { loyaltyPoints: number } | null;
  staffProfile: {
    branchId: number | null;
    branch: {
      id: number;
      code: string;
      name: string;
    } | null;
  } | null;
};

/**
 * Giữ nguyên hợp đồng API cũ trong khi dữ liệu đã được chuẩn hóa thành ba bảng
 * profile. Frontend vẫn nhận fullName, phone, loyaltyPoints và branch ở cấp User.
 */
export function flattenUserProfiles<T extends UserProfileRelations>(user: T) {
  const { profile, customerProfile, staffProfile, ...account } = user;

  return {
    ...account,
    fullName: profile?.fullName ?? null,
    phone: profile?.phone ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    address: profile?.address ?? null,
    loyaltyPoints: customerProfile?.loyaltyPoints ?? 0,
    branchId: staffProfile?.branchId ?? null,
    branch: staffProfile?.branch ?? null,
  };
}

type PersonProfileRelation = {
  profile: {
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
};

/** Trải phẳng thông tin hiển thị cho các quan hệ employee/actor/author. */
export function flattenPersonProfile<T extends PersonProfileRelation>(user: T) {
  const { profile, ...account } = user;

  return {
    ...account,
    fullName: profile?.fullName ?? null,
    phone: profile?.phone ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  };
}
