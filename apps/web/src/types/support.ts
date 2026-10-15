export type SupportConversationStatus =
  "OPEN" | "WAITING_CUSTOMER" | "RESOLVED";

export type SupportPerson = {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role?: { name: string };
};

export type SupportMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  senderType: "CUSTOMER" | "STAFF" | "ADMIN";
  content: string;
  readByAdminAt: string | null;
  readByCustomerAt: string | null;
  createdAt: string;
  sender: SupportPerson;
};

export type SupportBranch = {
  id: number;
  code: string;
  name: string;
  address: string | null;
};

export type SupportRelatedOrder = {
  id: number;
  status: string;
  branchId: number;
  createdAt: string;
};

export type SupportConversation = {
  id: number;
  customerId: number;
  customer: SupportPerson;
  branch: SupportBranch;
  relatedOrder: SupportRelatedOrder | null;
  status: SupportConversationStatus;
  lastMessageAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  reopenedCount: number;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
};

export type SupportConversationListItem = {
  id: number;
  customer: SupportPerson;
  branch: SupportBranch;
  relatedOrder: SupportRelatedOrder | null;
  status: SupportConversationStatus;
  lastMessageAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  reopenedCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessage: Omit<SupportMessage, "sender"> | null;
  unreadCount: number;
};

export type SupportConversationList = {
  summary: {
    open: number;
    waiting: number;
    resolved: number;
    unread: number;
  };
  items: SupportConversationListItem[];
};

export type SupportQualitySummary = {
  total: number;
  open: number;
  resolved: number;
  overdue: number;
  reopened: number;
  responded: number;
  slaMet: number;
  slaBreached: number;
  slaMetRate: number | null;
  averageFirstResponseMinutes: number | null;
  averageResolutionMinutes: number | null;
};

export type SupportMetrics = {
  period: {
    days: number;
    from: string;
    to: string;
    slaMinutes: number;
  };
  summary: SupportQualitySummary;
  branches: Array<
    SupportQualitySummary & {
      branch: Pick<SupportBranch, "id" | "code" | "name">;
    }
  >;
};
