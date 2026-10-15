export type BannerTheme = "AMBER" | "COCOA" | "GREEN";

export type BannerTargetType =
  "NONE" | "MENU" | "PRODUCT" | "VOUCHER" | "CONTENT_PAGE" | "CUSTOM_URL";

export type PublicBanner = {
  id: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  buttonLabel: string | null;
  imageUrl: string | null;
  theme: BannerTheme;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  href: string | null;
  branch: { id: number; code: string; name: string } | null;
};

export type AdminBanner = Omit<PublicBanner, "href"> & {
  targetType: BannerTargetType;
  customUrl: string | null;
  productId: number | null;
  product: { id: number; name: string; isActive: boolean } | null;
  voucherId: number | null;
  voucher: { id: number; code: string; isActive: boolean } | null;
  contentPageId: number | null;
  contentPage: {
    id: number;
    slug: string;
    title: string;
    isPublished: boolean;
  } | null;
  branchId: number | null;
  isActive: boolean;
  updatedById: number | null;
  updatedBy: {
    email: string;
    profile: { fullName: string | null } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type BannerInput = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  imageUrl?: string;
  theme: BannerTheme;
  targetType: BannerTargetType;
  productId?: number | null;
  voucherId?: number | null;
  contentPageId?: number | null;
  customUrl?: string | null;
  branchId?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};
