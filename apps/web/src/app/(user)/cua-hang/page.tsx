"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Coffee,
  MapPin,
  Navigation,
  Phone,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";

import { getPublicStoreLocations } from "@/services/store-settings.service";
import type { PublicStoreLocation } from "@/types/store-settings";

const StoreLocationsMap = dynamic(
  () => import("@/components/user/store-locations-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-3xl bg-[#F6F0E9] text-sm text-[#78866B] lg:h-[620px]">
        Đang mở bản đồ cửa hàng...
      </div>
    ),
  },
);

function hasCoordinates(
  location: PublicStoreLocation,
): location is PublicStoreLocation & {
  latitude: number;
  longitude: number;
} {
  return location.latitude !== null && location.longitude !== null;
}

function getDirectionsUrl(location: PublicStoreLocation) {
  const destination = hasCoordinates(location)
    ? `${location.latitude},${location.longitude}`
    : location.address || location.name;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export default function StoreLocationsPage() {
  const [locations, setLocations] = useState<PublicStoreLocation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void getPublicStoreLocations(controller.signal)
      .then((items) => {
        setLocations(items);
        setSelectedId(items.find(hasCoordinates)?.id ?? items[0]?.id ?? null);
      })
      .catch((loadError) => {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải danh sách cửa hàng",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const filteredLocations = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");

    if (!keyword) return locations;

    return locations.filter((location) =>
      [location.code, location.name, location.address]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("vi").includes(keyword)),
    );
  }, [locations, search]);

  const mappedLocations = useMemo(
    () => filteredLocations.filter(hasCoordinates),
    [filteredLocations],
  );

  return (
    <main className="min-h-screen bg-[#FCFAF7]">
      <section className="border-b border-[#E9E1D8] bg-gradient-to-br from-[#FFF8EF] via-white to-[#F5EBDD]">
        <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#C9894B]">
              Hệ thống Kippora
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F1B18] sm:text-5xl">
              Tìm cửa hàng gần bạn
            </h1>
            <p className="mt-4 text-base leading-7 text-[#6F7D64] sm:text-lg">
              Xem địa chỉ, giờ phục vụ và trạng thái nhận đơn theo thời gian
              thực trước khi ghé Kippora.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#E9E1D8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xl">
            <Search
              size={20}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#91867E]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, mã hoặc địa chỉ chi nhánh..."
              className="h-12 w-full rounded-2xl border border-[#E8DED4] bg-[#FCFAF7] pl-12 pr-4 text-sm outline-none transition focus:border-[#C9894B] focus:ring-2 focus:ring-[#F7E5D2]"
            />
          </div>
          <p className="shrink-0 px-2 text-sm text-[#78866B]">
            <strong className="text-[#4A2C20]">
              {filteredLocations.length}
            </strong>{" "}
            cửa hàng phù hợp
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <div className="h-[420px] animate-pulse rounded-3xl bg-[#F2ECE5]" />
            <div className="h-[620px] animate-pulse rounded-3xl bg-[#F2ECE5]" />
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#DBCDBF] bg-white px-6 py-16 text-center">
            <Coffee className="mx-auto text-[#C9894B]" size={40} />
            <h2 className="mt-4 text-xl font-bold text-[#1F1B18]">
              Chưa tìm thấy cửa hàng phù hợp
            </h2>
            <p className="mt-2 text-sm text-[#78866B]">
              Anh thử tìm bằng tên khu vực hoặc xóa từ khóa nhé.
            </p>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <div className="space-y-4 lg:max-h-[620px] lg:overflow-y-auto lg:pr-2">
              {filteredLocations.map((location) => {
                const selected = location.id === selectedId;

                return (
                  <article
                    key={location.id}
                    onClick={() => setSelectedId(location.id)}
                    className={`cursor-pointer rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      selected
                        ? "border-[#C9894B] ring-2 ring-[#F6E2CC]"
                        : "border-[#E9E1D8]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C9894B]">
                          {location.code}
                        </p>
                        <h2 className="mt-1 text-xl font-bold text-[#1F1B18]">
                          {location.name}
                        </h2>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          location.isOpen
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {location.isOpen ? "Đang mở cửa" : "Tạm đóng"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 text-sm text-[#6F675F]">
                      <div className="flex items-start gap-2.5">
                        <MapPin
                          size={18}
                          className="mt-0.5 shrink-0 text-[#C9894B]"
                        />
                        <span>
                          {location.address || "Địa chỉ đang được cập nhật"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Clock3
                          size={18}
                          className="shrink-0 text-[#C9894B]"
                        />
                        <span>
                          Phục vụ {location.openingTime} -{" "}
                          {location.closingTime}
                        </span>
                      </div>
                      {location.phone && (
                        <div className="flex items-center gap-2.5">
                          <Phone
                            size={18}
                            className="shrink-0 text-[#C9894B]"
                          />
                          <span>{location.phone}</span>
                        </div>
                      )}
                    </div>

                    {!location.isOpen && location.unavailableReason && (
                      <p className="mt-4 rounded-xl bg-[#FFF8ED] px-3 py-2 text-xs leading-5 text-[#A76528]">
                        {location.unavailableReason}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {location.pickupAvailable && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F0E9] px-2.5 py-1 text-xs font-medium text-[#5C4639]">
                          <ShoppingBag size={14} /> Nhận tại quán
                        </span>
                      )}
                      {location.deliveryAvailable && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF6EA] px-2.5 py-1 text-xs font-medium text-[#55704A]">
                          <Truck size={14} /> Có giao hàng
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex gap-2">
                      <a
                        href={getDirectionsUrl(location)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118]"
                      >
                        <Navigation size={16} />
                        Chỉ đường
                      </a>
                      {location.phone && (
                        <a
                          href={`tel:${location.phone}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E1D3C6] px-4 py-2.5 text-sm font-semibold text-[#4A2C20] transition hover:bg-[#FAF5EF]"
                        >
                          <Phone size={16} />
                          Gọi
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="sticky top-24">
              {mappedLocations.length > 0 ? (
                <StoreLocationsMap
                  locations={mappedLocations}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <div className="flex h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#DBCDBF] bg-white px-6 text-center lg:h-[620px]">
                  <MapPin size={42} className="text-[#C9894B]" />
                  <h2 className="mt-4 text-xl font-bold text-[#1F1B18]">
                    Vị trí đang được cập nhật
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#78866B]">
                    Admin cần bổ sung tọa độ cho chi nhánh để hiển thị trên bản
                    đồ. Thông tin địa chỉ và liên hệ vẫn dùng bình thường.
                  </p>
                  <Link
                    href="/menu"
                    className="mt-5 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Xem menu
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
