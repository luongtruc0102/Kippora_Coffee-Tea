import Link from 'next/link';
import { Coffee, Heart, Sparkles } from 'lucide-react';

import BrandLogo from '@/components/brand/brand-logo';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

const highlights = [
  { icon: Coffee, label: 'Đặt món nhanh chóng' },
  { icon: Heart, label: 'Tích điểm mỗi ngày' },
  { icon: Sparkles, label: 'Ưu đãi dành riêng cho bạn' },
] as const;

/**
 * Khung giao diện dùng chung cho các trang xác thực.
 * Desktop hiển thị thương hiệu và biểu mẫu song song; mobile chỉ giữ phần
 * biểu mẫu để nội dung luôn gọn và dễ thao tác.
 */
export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="relative flex h-dvh min-h-0 items-center justify-center overflow-hidden bg-[#F6F0E9] px-3 py-3 sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#E7A35B]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-[#78866B]/15 blur-3xl" />

      <section className="relative grid h-full min-h-0 w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_28px_90px_rgba(74,44,32,0.16)] lg:max-h-[760px] lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative hidden min-h-0 overflow-hidden bg-gradient-to-br from-[#3B2319] via-[#5A3323] to-[#C77D3E] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full border-[48px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-20 -left-24 h-80 w-80 rounded-full bg-[#F2A65A]/20 blur-2xl" />
          <div className="pointer-events-none absolute right-12 top-28 h-5 w-3 rotate-[28deg] rounded-full bg-[#F2A65A]/70" />
          <div className="pointer-events-none absolute right-24 top-44 h-7 w-4 -rotate-[32deg] rounded-full bg-white/15" />
          <div className="pointer-events-none absolute bottom-48 left-14 h-6 w-3 rotate-[34deg] rounded-full bg-[#F2A65A]/50" />

          <Link
            href="/"
            aria-label="Về trang chủ Kippora"
            className="relative z-10 w-fit rounded-2xl bg-white/95 px-5 py-3 shadow-lg shadow-black/10 transition hover:-translate-y-0.5"
          >
            <BrandLogo
              variant="wordmark"
              priority
              sizes="190px"
              className="h-auto w-[190px]"
            />
          </Link>

          <div className="relative z-10 my-6">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#FFD8AE] backdrop-blur-sm">
              Kippora Coffee & Tea
            </span>
            <h2 className="mt-6 max-w-md text-4xl font-bold leading-[1.15] tracking-[-0.03em]">
              Một góc nhỏ cho mỗi nhịp sống.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/75">
              Thưởng thức món bạn yêu thích, theo dõi đơn hàng và nhận những
              niềm vui nho nhỏ cùng Kippora.
            </p>

            <div className="mt-7 space-y-3">
              {highlights.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
                    <Icon size={17} />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs text-white/55">
            © 2026 Kippora. Mỗi ngày một vị vui.
          </p>
        </aside>

        <div className="flex min-h-0 items-center justify-center overflow-hidden px-6 py-4 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <Link
              href="/"
              aria-label="Về trang chủ Kippora"
              className="mb-4 block w-fit lg:hidden"
            >
              <BrandLogo
                variant="wordmark"
                priority
                sizes="160px"
                className="h-auto w-[160px]"
              />
            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C2763D]">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#1F1B18] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 leading-6 text-[#78866B]">{description}</p>

            <div className="mt-6">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
