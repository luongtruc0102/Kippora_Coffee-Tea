export type ContentPageCategory = "ABOUT" | "SUPPORT" | "POLICY";

export type ContentPageLink = {
  id: number;
  slug: string;
  title: string;
  category: ContentPageCategory;
  showInHeader: boolean;
  showInFooter: boolean;
  sortOrder: number;
};

export type ContentPage = ContentPageLink & {
  summary: string | null;
  content: string;
  updatedAt: string;
};

export type AdminContentPage = ContentPage & {
  isPublished: boolean;
  createdAt: string;
  updatedById: number | null;
  updatedBy: {
    email: string;
    profile: { fullName: string | null } | null;
  } | null;
};

export type ContentPageInput = {
  title: string;
  slug?: string;
  summary?: string;
  content: string;
  category: ContentPageCategory;
  isPublished?: boolean;
  showInHeader?: boolean;
  showInFooter?: boolean;
  sortOrder?: number;
};
