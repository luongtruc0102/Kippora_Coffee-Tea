"use client";

import Link from "next/link";

import {
  Bell,
  Banknote,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Boxes,
  Building2,
  Coffee,
  CreditCard,
  Images,
  HandCoins,
  LayoutDashboard,
  Landmark,
  MessagesSquare,
  Package,
  PackagePlus,
  ScrollText,
  Settings,
  ShoppingBag,
  Star,
  TicketPercent,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Warehouse,
  X,
} from "lucide-react";

import { usePathname } from "next/navigation";

import BrandLogo from "@/components/brand/brand-logo";

type Props = {
  open: boolean;
  onClose: () => void;
};

const menuGroups = [
  {
    label: null,

    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },

  {
    label: "Bán hàng",

    items: [
      {
        label: "Đơn hàng",
        href: "/admin/orders",
        icon: ShoppingBag,
      },
      {
        label: "Thanh toán",
        href: "/admin/payments",
        icon: CreditCard,
      },
      {
        label: "Giá vốn & lợi nhuận",
        href: "/admin/profitability",
        icon: TrendingUp,
      },
    ],
  },

  {
    label: "Sản phẩm",

    items: [
      {
        label: "Sản phẩm",
        href: "/admin/products",
        icon: Package,
      },
      {
        label: "Danh mục",
        href: "/admin/categories",
        icon: Boxes,
      },
      {
        label: "Topping",
        href: "/admin/toppings",
        icon: Coffee,
      },
    ],
  },

  {
    label: "Khuyến mãi",

    items: [
      {
        label: "Voucher",
        href: "/admin/vouchers",
        icon: TicketPercent,
      },
    ],
  },

  {
    label: "Kho hàng",

    items: [
      {
        label: "Tồn kho",
        href: "/admin/inventory",
        icon: Warehouse,
      },
      {
        label: "Lô & hạn dùng",
        href: "/admin/inventory-lots",
        icon: CalendarDays,
      },
      {
        label: "Nhập kho",
        href: "/admin/stock-in",
        icon: PackagePlus,
      },
      {
        label: "Đặt hàng NCC",
        href: "/admin/purchase-orders",
        icon: ClipboardList,
      },
      {
        label: "Kiểm kê kho",
        href: "/admin/inventory-counts",
        icon: ClipboardCheck,
      },
      {
        label: "Nhà cung cấp",
        href: "/admin/suppliers",
        icon: Truck,
      },
    ],
  },

  {
    label: "Tài khoản",

    items: [
      {
        label: "Khách hàng",
        href: "/admin/users",
        icon: Users,
      },
      {
        label: "Nhân viên",
        href: "/admin/employees",
        icon: UserCog,
      },
      {
        label: "Lịch làm",
        href: "/admin/schedules",
        icon: CalendarDays,
      },
      {
        label: "Bảng lương",
        href: "/admin/payroll",
        icon: Banknote,
      },
      {
        label: "Chi phí",
        href: "/admin/expenses",
        icon: HandCoins,
      },
      {
        label: "Chốt quỹ",
        href: "/admin/cash-reconciliation",
        icon: Landmark,
      },
      {
        label: "Đánh giá",
        href: "/admin/reviews",
        icon: Star,
      },
      {
        label: "Chat / CSKH",
        href: "/admin/chat",
        icon: MessagesSquare,
      },
    ],
  },

  {
    label: "Nội dung",

    items: [
      {
        label: "Banner",
        href: "/admin/banners",
        icon: Images,
      },
      {
        label: "Thông báo",
        href: "/admin/notifications",
        icon: Bell,
      },
    ],
  },

  {
    label: "Hệ thống",

    items: [
      {
        label: "Chi nhánh",
        href: "/admin/branches",
        icon: Building2,
      },
      {
        label: "Cài đặt",
        href: "/admin/settings",
        icon: Settings,
      },
      {
        label: "Nhật ký hoạt động",
        href: "/admin/activity-logs",
        icon: ScrollText,
      },
    ],
  },
];

export default function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#E9E1D8] bg-white transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#E9E1D8] px-6">
          <Link
            href="/admin"
            onClick={onClose}
            aria-label="Kippora Admin"
            className="flex items-center"
          >
            <BrandLogo
              variant="wordmark"
              priority
              sizes="140px"
              className="h-auto w-[140px]"
            />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#78866B] transition hover:bg-[#FAF8F5] lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            {menuGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {group.label && (
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A0968F]">
                    {group.label}
                  </p>
                )}

                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    const isActive =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : item.href === "/admin/inventory"
                          ? pathname === item.href
                          : pathname.startsWith(item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive
                              ? "bg-[#F3E9DE] text-[#4A2C20]"
                              : "text-[#5E5650] hover:bg-[#FAF8F5] hover:text-[#1F1B18]"
                          }`}
                        >
                          <Icon size={18} strokeWidth={isActive ? 2.3 : 2} />

                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-[#E9E1D8] p-4">
          <div className="rounded-xl bg-[#FAF8F5] px-3 py-3">
            <p className="text-xs font-semibold text-[#4A2C20]">
              Kippora Admin
            </p>

            <p className="mt-1 text-xs text-[#8A817B]">
              Quản lý vận hành hệ thống.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
