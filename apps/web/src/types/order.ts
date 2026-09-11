import type { Cart } from "./cart";

export type ReorderSkippedItem = {
  orderItemId: number;
  productName: string;
  reason: string;
};

// Preview có cùng cấu trúc Cart để checkout tái sử dụng UI, nhưng không phải giỏ DB.
export type ReorderOrderResult = {
  sourceOrderId: number;
  cart: Cart;
  selectedCartItemIds: number[];
  addedItemCount: number;
  skippedItems: ReorderSkippedItem[];
};

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod = "COD" | "BANK_TRANSFER";

export type FulfillmentMethod = "DELIVERY" | "PICKUP";

export type OrderChannel = "ONLINE" | "POS";

export type PaymentStatus =
  "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

export type RefundMethod = "CASH" | "BANK_TRANSFER";

export type DiscountType = "PERCENT" | "FIXED";

export type OrderUser = {
  id: number;
  email: string;
  fullName: string | null;
};

export type OrderBranch = {
  id: number;
  code: string;
  name: string;
  address: string;
  phone: string | null;
};

export type OrderItemTopping = {
  id: number;
  orderItemId: number;
  toppingId: number;
  toppingName: string;
  toppingPrice: number | string;
};

export type OrderItemRecipeIngredient = {
  id: number;
  orderItemId: number;
  ingredientId: number;
  ingredientName: string;
  unit: "GRAM" | "MILLILITER" | "PIECE";
  sourceName: string;
  quantityPerItem: number | string;
  totalQuantity: number | string;
};

export type OrderItem = {
  id: number;

  orderId: number;
  productId: number;
  variantId: number;

  productName: string;
  size: string;

  variantPrice: number | string;
  quantity: number;

  unitPrice: number | string;
  lineTotal: number | string;

  toppings: OrderItemTopping[];

  recipeIngredients?: OrderItemRecipeIngredient[];

  createdAt: string;
};

export type OrderVoucher = {
  id: number;
  code: string;

  discountType: DiscountType;

  discountValue: number | string;
};

export type OrderPayment = {
  id: number;
  orderId: number;

  method: PaymentMethod;
  status: PaymentStatus;

  amount: number | string;

  transactionCode: string | null;

  paidAt: string | null;

  createdAt: string;
  updatedAt: string;
};

export type OrderRefund = {
  id: number;
  code: string;
  orderId: number;
  paymentId: number;
  branchId: number;
  amount: number | string;
  method: RefundMethod;
  reason: string;
  processedById: number;
  processedBy: OrderUser;
  processedAt: string;
  createdAt: string;
};

export type Order = {
  id: number;

  channel: OrderChannel;
  createdByStaffId: number | null;
  posCustomerId: number | null;

  userId: number;
  user: OrderUser;
  branch?: OrderBranch;
  createdByStaff?: OrderUser | null;

  subtotal: number | string;
  discountAmount: number | string;
  totalPrice: number | string;

  loyaltyPointsUsed: number;

  loyaltyDiscountAmount: number | string;

  loyaltyPointsEarned: number;

  loyaltyPointsGrantedAt: string | null;

  fulfillmentMethod: FulfillmentMethod;
  receiverName: string;
  receiverPhone: string;
  deliveryAddress: string;
  deliveryLatitude: number | string | null;
  deliveryLongitude: number | string | null;
  deliveryDistanceKm: number | string;
  deliveryBaseFee: number | string;
  deliveryDiscountAmount: number | string;
  deliveryFee: number | string;

  note: string | null;

  status: OrderStatus;
  inventoryState?: "NOT_TRACKED" | "RESERVED" | "CONSUMED" | "RELEASED";
  cancelReason: string | null;
  cancelledAt: string | null;

  voucherId: number | null;

  voucher: OrderVoucher | null;

  appliedVouchers?: Array<{
    orderId: number;
    voucherId: number;
    code: string;
    discountAmount: number | string;
    voucher?: OrderVoucher;
  }>;

  voucherCode: string | null;

  payment: OrderPayment | null;
  refund?: OrderRefund | null;

  items: OrderItem[];

  createdAt: string;
  updatedAt: string;
};
