export const BANNER_THEMES = ['AMBER', 'COCOA', 'GREEN'] as const;

export const BANNER_TARGET_TYPES = [
  'NONE',
  'MENU',
  'PRODUCT',
  'VOUCHER',
  'CONTENT_PAGE',
  'CUSTOM_URL',
] as const;

export type BannerTargetType = (typeof BANNER_TARGET_TYPES)[number];
