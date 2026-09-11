import { forwardRef } from "react";

import type { Order } from "@/types/order";

type Props = {
  order: Order;
  id?: string;
  className?: string;
  ariaHidden?: boolean;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function getPaymentMethod(order: Order) {
  if (order.payment?.method === "BANK_TRANSFER") return "Chuyển khoản";
  if (order.payment?.method === "COD" || order.channel === "POS") {
    return "Tiền mặt";
  }
  return "Thanh toán khi nhận hàng";
}

const OrderReceiptContent = forwardRef<HTMLDivElement, Props>(
  function OrderReceiptContent(
    { order, id, className = "", ariaHidden = false },
    ref,
  ) {
    const fallbackEarnedPoints = order.receiverPhone
      ? Math.floor(Number(order.totalPrice) / 1000) * 10
      : 0;
    const earnedPoints = order.loyaltyPointsEarned || fallbackEarnedPoints;
    const pointsCompleted = order.status === "COMPLETED";

    return (
      <div
        ref={ref}
        id={id}
        aria-hidden={ariaHidden || undefined}
        className={`bg-white p-6 text-[#2A211D] ${className}`}
      >
        <div className="text-center">
          <p className="text-2xl font-black tracking-wide text-[#4A2C20]">
            KIPPORA
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#C9894B]">
            Coffee & Tea
          </p>
          <p className="mt-3 text-sm font-semibold">
            {order.branch?.name ?? "Kippora"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#78866B]">
            {order.branch?.address ?? order.deliveryAddress}
          </p>
          {order.branch?.phone && (
            <p className="text-xs text-[#78866B]">SĐT: {order.branch.phone}</p>
          )}
        </div>

        <div className="my-5 border-y border-dashed border-[#D9CEC4] py-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#78866B]">Mã hóa đơn</span>
            <strong>#{order.id}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-[#78866B]">Thời gian</span>
            <span className="text-right">
              {new Date(order.createdAt).toLocaleString("vi-VN")}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-[#78866B]">Nhân viên</span>
            <span className="text-right">
              {order.createdByStaff?.fullName ||
                order.createdByStaff?.email ||
                (order.createdByStaffId ? `#${order.createdByStaffId}` : "—")}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-[#78866B]">Khách hàng</span>
            <span className="text-right">
              {order.receiverName}
              {order.receiverPhone ? ` · ${order.receiverPhone}` : ""}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {order.items.map((item) => (
            <div key={item.id} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {item.productName} × {item.quantity}
                  </p>
                  <p className="mt-0.5 text-xs text-[#78866B]">
                    Size {item.size}
                    {item.toppings.length > 0
                      ? ` · ${item.toppings
                          .map((topping) => topping.toppingName)
                          .join(", ")}`
                      : ""}
                  </p>
                </div>
                <strong className="shrink-0">
                  {formatCurrency(item.lineTotal)}
                </strong>
              </div>
            </div>
          ))}

          {order.note && (
            <div className="mt-4 border-t border-dashed border-[#D9CEC4] pt-3">
              <div className="rounded-lg bg-[#FAF8F5] px-3 py-2.5 text-xs leading-5 text-[#6B625C]">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#C2763D]">
                  Ghi chú
                </p>
                <p className="mt-1 break-words">{order.note}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2 border-y border-dashed border-[#D9CEC4] py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[#78866B]">Tạm tính</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Giảm giá</span>
              <span>-{formatCurrency(order.discountAmount)}</span>
            </div>
          )}
          {order.loyaltyPointsUsed > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>
                Điểm đã dùng ({order.loyaltyPointsUsed.toLocaleString("vi-VN")})
              </span>
              <span>-{formatCurrency(order.loyaltyDiscountAmount)}</span>
            </div>
          )}
          {Number(order.deliveryFee) > 0 && (
            <div className="flex justify-between">
              <span className="text-[#78866B]">Phí giao hàng</span>
              <span>{formatCurrency(order.deliveryFee)}</span>
            </div>
          )}
          <div className="flex items-end justify-between gap-4 pt-2">
            <span className="font-bold">Tổng thanh toán</span>
            <strong className="text-xl text-[#4A2C20]">
              {formatCurrency(order.totalPrice)}
            </strong>
          </div>
          <div className="flex justify-between pt-1 text-xs text-[#78866B]">
            <span>Phương thức</span>
            <span>{getPaymentMethod(order)}</span>
          </div>
        </div>

        {earnedPoints > 0 && (
          <p className="mt-4 text-center text-xs leading-5 text-[#78866B]">
            {pointsCompleted ? "Đã cộng" : "Dự kiến cộng"}{" "}
            <strong className="text-[#C2763D]">
              {earnedPoints.toLocaleString("vi-VN")}
            </strong>{" "}
            điểm cho khách hàng.
          </p>
        )}
        <p className="mt-4 text-center text-xs text-[#9A918A]">
          Cảm ơn quý khách và hẹn gặp lại!
        </p>
      </div>
    );
  },
);

export default OrderReceiptContent;
