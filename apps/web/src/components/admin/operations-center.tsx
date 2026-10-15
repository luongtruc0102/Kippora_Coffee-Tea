import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  HandCoins,
  Hourglass,
  Landmark,
  PackagePlus,
  ShoppingBag,
  UserRoundCheck,
  Warehouse,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import type { DashboardOperations } from "@/types/dashboard";

type Props = { data: DashboardOperations; scopeLabel?: string };

const unitLabels: Record<
  DashboardOperations["lowStockItems"][number]["unit"],
  string
> = {
  GRAM: "g",
  MILLILITER: "ml",
  PIECE: "cái",
};

const leaveScopeLabels: Record<
  DashboardOperations["pendingLeaveRequests"][number]["scope"],
  string
> = {
  FULL_SHIFT: "nghỉ cả ca",
  LATE_ARRIVAL: "đến trễ",
  EARLY_LEAVE: "về sớm",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

function formatShiftTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  return `tháng ${Number(month)}/${year}`;
}

export default function OperationsCenter({
  data,
  scopeLabel = "Toàn hệ thống",
}: Props) {
  const attentionCount =
    data.summary.lowStockItems +
    data.summary.pendingLeaveRequests +
    data.summary.attendanceActions +
    data.summary.payrollActions +
    data.summary.draftStockReceipts +
    data.summary.pendingExpenses +
    data.summary.pendingCashSessions +
    data.summary.overdueCashSessions +
    data.summary.branchesWithoutShifts +
    data.summary.expiredLots +
    data.summary.expiringLots +
    data.summary.pendingInventoryCounts +
    data.summary.pendingPurchaseOrders +
    data.summary.overduePurchaseOrders +
    data.summary.bankReconciliationIssues;

  const attentionItems = [
    ...(data.summary.pendingLeaveRequests
      ? [
          {
            key: "leave",
            title: `${data.summary.pendingLeaveRequests} yêu cầu xin phép đang chờ duyệt`,
            description:
              data.pendingLeaveRequests.length > 0
                ? `${data.pendingLeaveRequests[0].employeeName} xin ${leaveScopeLabels[data.pendingLeaveRequests[0].scope]} · ${data.pendingLeaveRequests[0].branch.code} · Ca ${formatShiftTime(data.pendingLeaveRequests[0].shift.startAt)}`
                : "Cần kiểm tra và phản hồi cho nhân viên.",
            href: "/admin/schedules",
            icon: UserRoundCheck,
          },
        ]
      : []),
    ...data.attendanceActions.map((item) => ({
      key: `attendance-${item.branch.id}`,
      title:
        item.status === "PENDING"
          ? `Bảng công ${formatMonth(data.payrollMonth)} đang chờ duyệt`
          : item.status === "RETURNED"
            ? `Bảng công ${formatMonth(data.payrollMonth)} cần được gửi lại`
            : `Chưa gửi bảng công ${formatMonth(data.payrollMonth)}`,
      description: `${item.branch.code} · ${item.branch.name}`,
      href: "/admin/schedules",
      icon: ClipboardCheck,
    })),
    ...data.payrollActions.map((item) => ({
      key: `payroll-${item.branch.id}`,
      title:
        item.status === "FINALIZED"
          ? `Bảng lương ${formatMonth(data.payrollMonth)} chờ thanh toán`
          : item.status === "DRAFT"
            ? `Bảng lương ${formatMonth(data.payrollMonth)} chưa chốt`
            : `Chưa lập bảng lương ${formatMonth(data.payrollMonth)}`,
      description: `${item.branch.code} · ${item.branch.name}`,
      href: "/admin/payroll",
      icon: WalletCards,
    })),
    ...(data.summary.pendingExpenses
      ? [
          {
            key: "pending-expenses",
            title: `${data.summary.pendingExpenses} khoản chi đang chờ duyệt`,
            description: "Kiểm tra chứng từ trước khi đưa vào báo cáo chi phí.",
            href: "/admin/expenses",
            icon: HandCoins,
          },
        ]
      : []),
    ...data.cashSessionActions.map((session) => ({
      key: `cash-session-${session.id}`,
      title:
        session.status === "PENDING_REVIEW"
          ? `Sổ quỹ ${session.code} đang chờ duyệt`
          : `Sổ quỹ ${session.code} đã quá ngày nhưng chưa đóng`,
      description:
        session.status === "PENDING_REVIEW" && session.difference !== null
          ? `${session.branch.code} · Chênh lệch ${new Intl.NumberFormat("vi-VN").format(session.difference)} đ`
          : `${session.branch.code} · ${session.branch.name}`,
      href: "/admin/cash-reconciliation",
      icon: Landmark,
    })),
    ...(data.summary.draftStockReceipts
      ? [
          {
            key: "stock-receipts",
            title: `${data.summary.draftStockReceipts} phiếu nhập kho còn ở bản nháp`,
            description: "Hoàn tất phiếu để số lượng được cộng vào tồn kho.",
            href: "/admin/stock-in",
            icon: PackagePlus,
          },
        ]
      : []),
    ...(data.summary.expiredLots || data.summary.expiringLots
      ? [
          {
            key: "inventory-lot-expiry",
            title: data.summary.expiredLots
              ? `${data.summary.expiredLots} lô đã hết hạn cần xử lý`
              : `${data.summary.expiringLots} lô sắp hết hạn trong 7 ngày`,
            description: data.summary.expiredLots
              ? `Ngoài ra có ${data.summary.expiringLots} lô sắp hết hạn.`
              : "Ưu tiên sử dụng hoặc lên phương án xử lý để tránh hao hụt.",
            href: "/admin/inventory-lots",
            icon: Hourglass,
          },
        ]
      : []),
    ...(data.summary.pendingInventoryCounts
      ? [
          {
            key: "pending-inventory-counts",
            title: `${data.summary.pendingInventoryCounts} phiếu kiểm kê đang chờ duyệt`,
            description:
              "Kiểm tra chênh lệch trước khi điều chỉnh số lượng trong kho.",
            href: "/admin/inventory-counts",
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(data.summary.pendingPurchaseOrders
      ? [
          {
            key: "pending-purchase-orders",
            title: `${data.summary.pendingPurchaseOrders} đơn đặt nhà cung cấp chờ duyệt`,
            description: "Duyệt sớm để chi nhánh kịp bổ sung nguyên liệu.",
            href: "/admin/purchase-orders",
            icon: ClipboardList,
          },
        ]
      : []),
    ...(data.summary.overduePurchaseOrders
      ? [
          {
            key: "overdue-purchase-orders",
            title: `${data.summary.overduePurchaseOrders} đơn nhập hàng đã quá ngày dự kiến`,
            description: "Kiểm tra tiến độ giao hàng với nhà cung cấp.",
            href: "/admin/purchase-orders",
            icon: PackagePlus,
          },
        ]
      : []),
    ...(data.summary.bankReconciliationIssues
      ? [
          {
            key: "bank-reconciliation",
            title: `${data.summary.bankReconciliationIssues} giao dịch ngân hàng cần đối soát`,
            description:
              "Bao gồm giao dịch chưa ghép, lệch số tiền hoặc bị gửi trùng.",
            href: "/admin/bank-reconciliation",
            icon: Landmark,
          },
        ]
      : []),
    ...(data.branchesWithoutShifts.length
      ? [
          {
            key: "missing-shifts",
            title: `${data.branchesWithoutShifts.length} chi nhánh chưa có ca hôm nay`,
            description: data.branchesWithoutShifts
              .map((branch) => branch.code)
              .join(", "),
            href: "/admin/schedules",
            icon: CalendarClock,
          },
        ]
      : []),
  ];

  const summaryCards = [
    {
      label: "Cần xử lý",
      value: attentionCount,
      description: attentionCount ? "Có việc đang chờ" : "Không còn tồn đọng",
      icon: AlertTriangle,
      className: "bg-amber-50 text-amber-700",
    },
    {
      label: "Kho cần chú ý",
      value:
        data.summary.lowStockItems +
        data.summary.expiredLots +
        data.summary.expiringLots,
      description: `${data.summary.lowStockItems} tồn thấp · ${data.summary.expiredLots} hết hạn`,
      icon: Warehouse,
      className: "bg-red-50 text-red-600",
    },
    {
      label: "Đơn đang xử lý",
      value: data.summary.activeOrders,
      description: scopeLabel,
      icon: ShoppingBag,
      className: "bg-blue-50 text-blue-700",
    },
    {
      label: "Ca hôm nay",
      value: data.summary.todayShifts,
      description: data.summary.branchesWithoutShifts
        ? `${data.summary.branchesWithoutShifts} chi nhánh chưa xếp ca`
        : "Tất cả chi nhánh đã có lịch",
      icon: CalendarClock,
      className: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[#EEE5DC] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#2A211D]">
            Trung tâm vận hành
          </h3>
          <p className="mt-1 text-sm text-[#78866B]">
            Những việc cần chú ý tại {scopeLabel.toLocaleLowerCase("vi-VN")}.
          </p>
        </div>
        <p className="text-xs text-[#9A9089]">
          Cập nhật lúc{" "}
          {new Intl.DateTimeFormat("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(data.generatedAt))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#EEE5DC] bg-[#FCFAF7] p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-xs text-[#78866B]">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#2A211D]">
                  {card.value}
                </p>
                <p className="mt-1 truncate text-[11px] text-[#9A9089]">
                  {card.description}
                </p>
              </div>
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.className}`}
              >
                <Icon size={20} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 border-t border-[#EEE5DC] p-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-bold text-[#2A211D]">Việc cần xử lý</h4>
            {attentionCount > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {attentionCount} việc
              </span>
            )}
          </div>

          {attentionItems.length ? (
            <div className="space-y-2">
              {attentionItems.slice(0, 8).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-2xl border border-[#EEE5DC] p-3 transition hover:border-[#D9BEA4] hover:bg-[#FFF9F3]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#2A211D]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#8A817B]">
                        {item.description}
                      </span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-[#B4AAA3] transition group-hover:translate-x-0.5 group-hover:text-[#9F642F]"
                    />
                  </Link>
                );
              })}
              {attentionItems.length > 8 && (
                <p className="pt-1 text-center text-xs text-[#8A817B]">
                  Còn {attentionItems.length - 8} cảnh báo khác trong các trang
                  quản lý.
                </p>
              )}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-center">
              <CheckCircle2 size={28} className="text-emerald-600" />
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                Vận hành đang ổn định
              </p>
              <p className="mt-1 text-xs text-emerald-700/70">
                Chưa có công việc nào cần Admin xử lý ngay.
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-bold text-[#2A211D]">Cảnh báo kho</h4>
            <Link
              href="/admin/inventory"
              className="text-xs font-semibold text-[#9F642F] hover:underline"
            >
              Xem kho
            </Link>
          </div>

          {data.lowStockItems.length || data.inventoryLotAlerts.length ? (
            <div className="space-y-4">
              {data.lowStockItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#8A817B]">
                    Tồn kho chạm ngưỡng
                  </p>
                  {data.lowStockItems.slice(0, 4).map((item) => {
                    const unit = unitLabels[item.unit];
                    const outOfStock = item.availableQuantity <= 0;
                    return (
                      <Link
                        key={item.stockId}
                        href="/admin/inventory"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#EEE5DC] p-3 transition hover:border-red-200 hover:bg-red-50/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#2A211D]">
                            {item.ingredientName}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[#8A817B]">
                            {item.branch.code} · Ngưỡng{" "}
                            {formatNumber(item.minimumLevel)} {unit}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                            outOfStock
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {outOfStock
                            ? "Đã hết"
                            : `Còn ${formatNumber(item.availableQuantity)} ${unit}`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              {data.summary.lowStockItems > data.lowStockItems.length && (
                <Link
                  href="/admin/inventory"
                  className="block pt-1 text-center text-xs font-semibold text-[#9F642F] hover:underline"
                >
                  Xem thêm{" "}
                  {data.summary.lowStockItems - data.lowStockItems.length}{" "}
                  nguyên liệu
                </Link>
              )}
              {data.inventoryLotAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#8A817B]">
                    Hạn sử dụng
                  </p>
                  {data.inventoryLotAlerts.slice(0, 4).map((lot) => (
                    <Link
                      key={lot.id}
                      href="/admin/inventory-lots"
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#EEE5DC] p-3 transition hover:border-amber-200 hover:bg-amber-50/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#2A211D]">
                          {lot.ingredientName} · {lot.code}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[#8A817B]">
                          {lot.branch.code} · Còn{" "}
                          {formatNumber(lot.availableQuantity)}{" "}
                          {unitLabels[lot.unit]}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          lot.expiryState === "EXPIRED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {lot.expiryState === "EXPIRED"
                          ? `Quá ${Math.abs(lot.daysToExpiry)} ngày`
                          : lot.daysToExpiry === 0
                            ? "Hết hạn hôm nay"
                            : `Còn ${lot.daysToExpiry} ngày`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-5 text-center">
              <CheckCircle2 size={28} className="text-emerald-600" />
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                Tồn kho đang an toàn
              </p>
              <p className="mt-1 text-xs text-emerald-700/70">
                Chưa có nguyên liệu nào chạm ngưỡng cảnh báo.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
