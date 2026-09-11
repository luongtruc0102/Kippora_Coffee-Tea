'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import AuthShell from '@/components/auth/auth-shell';
import { useAppToast } from '@/components/ui/app-toast-provider';

/**
 * Giao diện chuẩn bị cho luồng khôi phục mật khẩu.
 * Hiện chưa gọi API; backend gửi và xác nhận OTP sẽ được nối ở giai đoạn sau.
 */
export default function ForgotPasswordPage() {
  const { showToast } = useAppToast();
  const [email, setEmail] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    showToast(
      'Khôi phục mật khẩu bằng OTP sẽ được kích hoạt ở bước hoàn thiện xác thực.',
      'info',
    );
  }

  return (
    <AuthShell
      eyebrow="Khôi phục tài khoản"
      title="Quên mật khẩu?"
      description="Nhập email đã đăng ký. Sau khi tính năng OTP hoàn thiện, Kippora sẽ gửi mã xác nhận đến email này."
    >
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#E7D7C8] bg-[#FFF8F1] p-4 text-sm leading-6 text-[#745642]">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3DFCA] text-[#C2763D]">
          <ShieldCheck size={18} />
        </span>
        <p>
          Mã OTP chỉ dùng khi khôi phục mật khẩu, không làm thay đổi cách đăng
          nhập hiện tại.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
            Email tài khoản
          </label>
          <div className="relative">
            <Mail
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A69A90]"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@example.com"
              autoComplete="email"
              required
              className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-3.5 pl-12 pr-4 outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-gradient-to-r from-[#4A2C20] to-[#6A3B27] px-4 py-3.5 font-semibold text-white shadow-lg shadow-[#4A2C20]/15 transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          Tiếp tục
        </button>
      </form>

      <Link
        href="/login"
        className="mx-auto mt-6 flex w-fit items-center gap-2 text-sm font-semibold text-[#78866B] transition hover:text-[#4A2C20]"
      >
        <ArrowLeft size={16} />
        Quay lại đăng nhập
      </Link>
    </AuthShell>
  );
}
