"use client";

import { Mail, MapPin, Phone } from "lucide-react";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrandLogo from "@/components/brand/brand-logo";
import StoreStatusBadge from "@/components/user/store-status-badge";
import { getContentNavigation } from "@/services/content-page.service";
import { getPublicStoreLocations } from "@/services/store-settings.service";
import type {
  ContentPageCategory,
  ContentPageLink,
} from "@/types/content-page";
import type { PublicStoreLocation } from "@/types/store-settings";

const groupTitles: Record<ContentPageCategory, string> = {
  ABOUT: "Về Kippora",
  SUPPORT: "Hỗ trợ",
  POLICY: "Chính sách",
};

export default function UserFooter() {
  const [contentLinks, setContentLinks] = useState<ContentPageLink[]>([]);
  const [primaryLocation, setPrimaryLocation] =
    useState<PublicStoreLocation | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getContentNavigation(controller.signal)
      .then((items) => setContentLinks(items))
      .catch(() => {
        // Footer vẫn hiển thị thông tin cửa hàng khi API nội dung tạm gián đoạn.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getPublicStoreLocations(controller.signal)
      .then((items) => setPrimaryLocation(items[0] ?? null))
      .catch(() => {
        // Thông tin phụ không được làm gián đoạn footer.
      });
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => {
    return (Object.keys(groupTitles) as ContentPageCategory[]).map(
      (category) => ({
        category,
        title: groupTitles[category],
        items: contentLinks.filter(
          (item) => item.showInFooter && item.category === category,
        ),
      }),
    );
  }, [contentLinks]);

  return (
    <footer className="mt-6 border-t border-[#E9E1D8] bg-white">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.35fr_repeat(4,1fr)] lg:px-8">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLogo
            variant="horizontalFull"
            sizes="190px"
            className="h-auto w-[190px]"
          />

          <p className="mt-3 max-w-sm text-sm leading-6 text-[#78866B]">
            Mỗi ngày một vị vui. Đặt cà phê và trà nhanh chóng, tiện lợi theo
            cách của bạn.
          </p>

          <StoreStatusBadge showHours className="mt-4" />
        </div>

        <div>
          <h3 className="font-semibold text-[#1F1B18]">Khám phá</h3>

          <div className="mt-4 space-y-2 text-sm">
            <Link
              href="/"
              className="block text-[#78866B] transition hover:text-[#4A2C20]"
            >
              Trang chủ
            </Link>

            <Link
              href="/menu"
              className="block text-[#78866B] transition hover:text-[#4A2C20]"
            >
              Menu
            </Link>

            <Link
              href="/cua-hang"
              className="block text-[#78866B] transition hover:text-[#4A2C20]"
            >
              Cửa hàng
            </Link>

            <Link
              href="/orders"
              className="block text-[#78866B] transition hover:text-[#4A2C20]"
            >
              Đơn hàng
            </Link>
          </div>
        </div>

        {groups.map((group) =>
          group.items.length > 0 ? (
            <div key={group.category}>
              <h3 className="font-semibold text-[#1F1B18]">{group.title}</h3>

              <div className="mt-4 space-y-2 text-sm">
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/thong-tin/${item.slug}`}
                    className="block leading-5 text-[#78866B] transition hover:text-[#4A2C20]"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null,
        )}

        <div className="sm:col-span-2 lg:col-span-1">
          <h3 className="font-semibold text-[#1F1B18]">Liên hệ</h3>

          <div className="mt-4 space-y-3 text-sm text-[#78866B]">
            <Link
              href="/cua-hang"
              className="flex items-start gap-2 transition hover:text-[#4A2C20]"
            >
              <MapPin size={16} />
              <span>
                {primaryLocation?.address ||
                  primaryLocation?.name ||
                  "Xem hệ thống cửa hàng"}
              </span>
            </Link>

            <a
              href={
                primaryLocation?.phone
                  ? `tel:${primaryLocation.phone}`
                  : undefined
              }
              className="flex items-center gap-2 transition hover:text-[#4A2C20]"
            >
              <Phone size={16} />
              {primaryLocation?.phone || "Chưa cập nhật số điện thoại"}
            </a>

            <div className="flex items-center gap-2">
              <Mail size={16} />
              kippora.coffee@gmail.com
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#E9E1D8]">
        <div className="mx-auto max-w-[1440px] px-4 py-4 text-center text-xs text-[#8A817B] sm:px-6 lg:px-8">
          © 2026 Kippora. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
