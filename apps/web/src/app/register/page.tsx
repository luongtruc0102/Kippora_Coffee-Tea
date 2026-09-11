'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import AuthShell from '@/components/auth/auth-shell';
import { useAppToast } from '@/components/ui/app-toast-provider';
import ToastMessage from '@/components/ui/toast-message';
import { register } from '@/services/auth.service';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useAppToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      setError('Vui lòng nhập họ và tên');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }

    try {
      setSubmitting(true);

      await register({
        fullName: normalizedName,
        email: normalizedEmail,
        password,
      });

      showToast('Đăng ký thành công. Anh có thể đăng nhập ngay.', 'success');
      router.replace('/login');
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Đăng ký tài khoản thất bại',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Bắt đầu cùng Kippora"
      title="Tạo tài khoản"
      description="Đăng ký để đặt món, lưu địa chỉ và theo dõi đơn hàng dễ dàng hơn."
    >
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#1F1B18]">
            Họ và tên
          </label>
          <div className="relative">
            <UserRound
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A69A90]"
            />
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nguyễn Văn A"
              autoComplete="name"
              required
              className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-2.5 pl-12 pr-4 outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#1F1B18]">
            Email
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
              className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-2.5 pl-12 pr-4 outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#1F1B18]">
            Mật khẩu
          </label>
          <div className="relative">
            <LockKeyhole
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A69A90]"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              minLength={6}
              required
              className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-2.5 pl-12 pr-12 outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#8E8177] transition hover:bg-[#F2E8DE] hover:text-[#4A2C20]"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#1F1B18]">
            Nhập lại mật khẩu
          </label>
          <div className="relative">
            <LockKeyhole
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A69A90]"
            />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              minLength={6}
              required
              className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-2.5 pl-12 pr-12 outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={
                showConfirmPassword
                  ? 'Ẩn mật khẩu nhập lại'
                  : 'Hiện mật khẩu nhập lại'
              }
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#8E8177] transition hover:bg-[#F2E8DE] hover:text-[#4A2C20]"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <ToastMessage message={error} />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-gradient-to-r from-[#4A2C20] to-[#6A3B27] px-4 py-2.5 font-semibold text-white shadow-lg shadow-[#4A2C20]/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
      </form>

      <p className="mt-3 text-center text-sm text-[#78866B]">
        Đã có tài khoản?{' '}
        <Link
          href="/login"
          className="font-semibold text-[#C2763D] hover:text-[#9A5D2E]"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
