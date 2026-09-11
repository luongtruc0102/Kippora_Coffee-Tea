"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Baby,
  BriefcaseBusiness,
  Coffee,
  LoaderCircle,
  MapPin,
  PackageCheck,
  PawPrint,
  Sparkles,
  Users,
} from "lucide-react";

import BrandLogo from "@/components/brand/brand-logo";
import { getPublicProducts } from "@/services/menu.service";
import type { Product } from "@/types/menu";

const spaces = [
  {
    title: "Không gian chung",
    description: "Thoải mái gặp gỡ, trò chuyện và tận hưởng một ly nước ngon.",
    icon: Users,
  },
  {
    title: "Góc cho trẻ nhỏ",
    description: "Một khoảng vui tươi để các bé có thêm trải nghiệm đáng nhớ.",
    icon: Baby,
  },
  {
    title: "Khu vực tập trung",
    description: "Yên tĩnh vừa đủ cho những buổi học tập và làm việc hiệu quả.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Không gian đáng yêu",
    description: "Nơi những người bạn nhỏ mang đến niềm vui thật tự nhiên.",
    icon: PawPrint,
  },
];

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function getProductImageUrl(imageUrl: string | null) {
  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return null;
  }

  return `${apiUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

function getStartingPrice(product: Product) {
  const prices = product.variants
    .filter((variant) => variant.isActive)
    .map((variant) => Number(variant.price));

  return prices.length > 0 ? Math.min(...prices) : Number(product.price);
}

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Trang chủ chỉ lấy một nhóm nhỏ món đang bán; lỗi API không chặn các nội dung khác.
  useEffect(() => {
    let active = true;

    void getPublicProducts()
      .then((products) => {
        if (active) {
          setFeaturedProducts(products.slice(0, 4));
        }
      })
      .catch(() => {
        if (active) {
          setFeaturedProducts([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProducts(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-[#E9E1D8] bg-[#F8F1E9]">
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-[#E8B67D]/20 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#78866B]/15 blur-3xl" />

        <div className="relative mx-auto grid min-h-[620px] max-w-[1440px] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E5C8AA] bg-white/80 px-4 py-2 text-sm font-semibold text-[#9F642F]">
              <Sparkles size={16} />
              Mỗi ngày một vị vui
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-[#1F1B18] sm:text-5xl lg:text-6xl">
              Một ly thật ngon,
              <span className="block text-[#C9894B]">một ngày thật vui.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#6F7C63] sm:text-lg">
              Thưởng thức cà phê và trà theo cách riêng của bạn. Chọn món,
              tùy chỉnh hương vị và để Kippora chuẩn bị phần còn lại.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#4A2C20] px-6 py-3.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#382118]"
              >
                Khám phá Menu
                <ArrowRight size={18} />
              </Link>

              <Link
                href="/orders"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#DCCDBF] bg-white px-6 py-3.5 font-semibold text-[#4A2C20] transition hover:border-[#C9894B] hover:bg-[#FFF9F2]"
              >
                Theo dõi đơn hàng
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#6F7C63]">
              <span className="inline-flex items-center gap-2">
                <PackageCheck size={18} className="text-[#C9894B]" />
                Đặt món nhanh chóng
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin size={18} className="text-[#C9894B]" />
                Giao hàng hoặc nhận tại quán
              </span>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-[540px] items-center justify-center">
            <div className="absolute inset-8 rotate-6 rounded-[40px] bg-[#C9894B]/20" />
            <div className="absolute inset-8 -rotate-6 rounded-[40px] border border-[#DDB78F] bg-white/60" />

            <div className="relative flex aspect-square w-full max-w-[470px] items-center justify-center overflow-hidden rounded-[42px] border border-white/80 bg-gradient-to-br from-[#FFFDF9] via-[#F8E6D4] to-[#E9B579] p-10 shadow-[0_30px_80px_rgba(74,44,32,0.18)]">
              <div className="absolute left-8 top-8 h-16 w-16 rounded-full border-[12px] border-white/50" />
              <div className="absolute bottom-10 right-10 h-24 w-24 rounded-full bg-[#78866B]/20" />
              <div className="absolute right-14 top-12 h-5 w-12 rotate-45 rounded-full bg-[#4A2C20]/15" />

              <BrandLogo
                variant="stackedFull"
                priority
                sizes="(max-width: 1024px) 70vw, 420px"
                className="relative z-10 h-auto w-[84%] drop-shadow-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#C9894B]">
              Gợi ý hôm nay
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[#1F1B18] sm:text-4xl">
              Món ngon đang chờ bạn
            </h2>
            <p className="mt-3 text-[#78866B]">
              Một vài lựa chọn từ menu Kippora.
            </p>
          </div>

          <Link
            href="/menu"
            className="inline-flex items-center gap-2 font-semibold text-[#9F642F] transition hover:text-[#4A2C20]"
          >
            Xem tất cả
            <ArrowRight size={18} />
          </Link>
        </div>

        {loadingProducts ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoaderCircle className="animate-spin text-[#C9894B]" size={30} />
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {featuredProducts.map((product) => {
              const imageUrl = getProductImageUrl(product.imageUrl);

              return (
                <Link
                  key={product.id}
                  href="/menu"
                  className="group overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden bg-[#F3E9DE] sm:aspect-[4/3]">
                    {imageUrl ? (
                      <Image
                        unoptimized
                        src={imageUrl}
                        alt={product.name}
                        width={640}
                        height={480}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#C9894B]">
                        <Coffee size={44} />
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#C9894B]">
                      {product.category.name}
                    </p>
                    <h3 className="mt-1 line-clamp-1 text-base font-bold text-[#1F1B18] sm:text-lg">
                      {product.name}
                    </h3>
                    <p className="mt-2 text-sm text-[#78866B]">Giá từ</p>
                    <p className="mt-0.5 font-bold text-[#4A2C20] sm:text-lg">
                      {formatCurrency(getStartingPrice(product))}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-[#DCCDBF] bg-white py-14 text-center">
            <Coffee className="mx-auto text-[#C9894B]" size={38} />
            <p className="mt-3 text-[#78866B]">
              Menu đang được chuẩn bị. Ghé lại sau bạn nhé!
            </p>
          </div>
        )}
      </section>

      <section className="bg-[#4A2C20]">
        <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#E7AA6F]">
              Không chỉ là một ly nước
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Một nơi, nhiều nhịp sống
            </h2>
            <p className="mt-4 leading-7 text-[#E6D9D1]">
              Kippora hướng đến một không gian nơi mỗi người đều tìm thấy góc
              phù hợp với mình.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {spaces.map((space) => {
              const Icon = space.icon;

              return (
                <article
                  key={space.title}
                  className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4D2AE] text-[#4A2C20]">
                    <Icon size={23} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">
                    {space.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#E6D9D1]">
                    {space.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] border border-[#E7D5C3] bg-[#F3E9DE] px-6 py-12 text-center sm:px-12">
          <div className="absolute -left-12 -top-12 h-36 w-36 rounded-full bg-[#C9894B]/20" />
          <div className="absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-[#78866B]/20" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-[#1F1B18]">
              Hôm nay bạn muốn uống gì?
            </h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-[#6F7C63]">
              Chọn món yêu thích, thêm topping theo ý bạn và đặt hàng chỉ trong
              vài bước.
            </p>
            <Link
              href="/menu"
              className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#4A2C20] px-6 py-3.5 font-semibold text-white transition hover:bg-[#382118]"
            >
              Chọn món ngay
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
