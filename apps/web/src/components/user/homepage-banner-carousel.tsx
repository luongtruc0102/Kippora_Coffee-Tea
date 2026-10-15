"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getPublicBanners } from "@/services/banner.service";
import { getStoreStatus } from "@/services/store-settings.service";
import type { BannerTheme, PublicBanner } from "@/types/banner";

const themeView: Record<
  BannerTheme,
  {
    section: string;
    eyebrow: string;
    title: string;
    text: string;
    button: string;
    accent: string;
  }
> = {
  AMBER: {
    section: "from-[#FFF0D9] via-[#F6D6AE] to-[#D99A58]",
    eyebrow: "text-[#8B4D20]",
    title: "text-[#3D261B]",
    text: "text-[#6B4C39]",
    button: "bg-[#4A2C20] text-white hover:bg-[#382118]",
    accent: "bg-white/30 text-[#8B4D20]",
  },
  COCOA: {
    section: "from-[#382118] via-[#573526] to-[#8B5A3C]",
    eyebrow: "text-[#F3C796]",
    title: "text-white",
    text: "text-[#F2E5DA]",
    button: "bg-white text-[#4A2C20] hover:bg-[#FFF8F1]",
    accent: "bg-white/10 text-[#F3C796]",
  },
  GREEN: {
    section: "from-[#E6F1E4] via-[#C8DDC3] to-[#78906D]",
    eyebrow: "text-[#3D5B36]",
    title: "text-[#20351E]",
    text: "text-[#4D6248]",
    button: "bg-[#294329] text-white hover:bg-[#203620]",
    accent: "bg-white/30 text-[#3D5B36]",
  },
};

export default function HomepageBannerCarousel() {
  const [banners, setBanners] = useState<PublicBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void getStoreStatus(controller.signal)
        .then((status) => getPublicBanners(status.branch.id, controller.signal))
        .catch(() => getPublicBanners(undefined, controller.signal))
        .then((items) => setBanners(items))
        .catch(() => {
          // Banner là nội dung bổ trợ, lỗi tải không được chặn trang chủ.
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 6500);
    return () => window.clearInterval(intervalId);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const activeBanner = banners[Math.min(activeIndex, banners.length - 1)];
  const theme = themeView[activeBanner.theme] ?? themeView.AMBER;

  function changeSlide(nextIndex: number) {
    setActiveIndex((nextIndex + banners.length) % banners.length);
  }

  return (
    <section className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      <div
        className={`relative min-h-[330px] overflow-hidden rounded-[32px] bg-gradient-to-br shadow-[0_20px_60px_rgba(74,44,32,0.12)] ${theme.section}`}
      >
        <div className="absolute -left-16 -top-20 h-56 w-56 rounded-full border-[35px] border-white/15" />
        <div className="absolute -bottom-20 right-[35%] h-52 w-52 rounded-full bg-white/10" />

        <div className="relative grid min-h-[330px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12 lg:px-16">
            {activeBanner.eyebrow && (
              <p
                className={`text-xs font-bold uppercase tracking-[0.22em] ${theme.eyebrow}`}
              >
                {activeBanner.eyebrow}
              </p>
            )}
            <h2
              className={`mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl ${theme.title}`}
            >
              {activeBanner.title}
            </h2>
            {activeBanner.subtitle && (
              <p className={`mt-4 max-w-xl leading-7 ${theme.text}`}>
                {activeBanner.subtitle}
              </p>
            )}
            {activeBanner.href && activeBanner.buttonLabel && (
              <Link
                href={activeBanner.href}
                className={`mt-7 inline-flex w-fit items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${theme.button}`}
              >
                {activeBanner.buttonLabel}
                <ArrowRight size={17} />
              </Link>
            )}
          </div>

          <div className="relative min-h-60 overflow-hidden lg:min-h-full">
            {activeBanner.imageUrl ? (
              <>
                <Image
                  unoptimized
                  src={activeBanner.imageUrl}
                  alt={activeBanner.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                  priority={activeIndex === 0}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent lg:bg-gradient-to-l" />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`relative flex h-44 w-44 items-center justify-center rounded-[44px] ${theme.accent}`}
                >
                  <Coffee size={78} strokeWidth={1.4} />
                  <Sparkles className="absolute -right-5 -top-5" size={38} />
                </div>
              </div>
            )}
          </div>
        </div>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changeSlide(activeIndex - 1)}
              aria-label="Banner trước"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#4A2C20] shadow-md backdrop-blur transition hover:bg-white sm:left-5"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => changeSlide(activeIndex + 1)}
              aria-label="Banner tiếp theo"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#4A2C20] shadow-md backdrop-blur transition hover:bg-white sm:right-5"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/15 px-3 py-2 backdrop-blur-sm">
              {banners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Xem banner ${index + 1}`}
                  className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-7 bg-white" : "w-2 bg-white/55 hover:bg-white/80"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
