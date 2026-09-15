import type {
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundMethod,
} from "@/types/order";

export type PaymentRecord = {
  id: number;
  orderId: number;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number | string;
  transactionCode: string | null;
  referenceCode: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  refund?: {
    id: number;
    code: string;
    amount: number | string;
    method: RefundMethod;
    reason: string;
    processedById: number;
    processedAt: string;
  } | null;
};

export type ManagedPayment = PaymentRecord & {
  order: {
    id: number;
    channel: OrderChannel;
    receiverName: string;
    receiverPhone: string;
    totalPrice: number | string;
    status: OrderStatus;
    createdAt: string;
    user: {
      id: number;
      email: string;
      fullName: string | null;
    };
    branch: {
      id: number;
      code: string;
      name: string;
      address: string | null;
      phone: string | null;
    };
  };
};

export type UpdatePaymentStatusInput = {
  status: PaymentStatus;
  transactionCode?: string;
};
