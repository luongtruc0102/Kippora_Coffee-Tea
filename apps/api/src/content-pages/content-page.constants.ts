export const CONTENT_PAGE_CATEGORIES = ['ABOUT', 'SUPPORT', 'POLICY'] as const;

export type ContentPageCategory = (typeof CONTENT_PAGE_CATEGORIES)[number];
