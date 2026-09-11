"use client";

import { FormEvent, Suspense, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import AuthShell from "@/components/auth/auth-shell";
import ToastMessage from "@/components/ui/toast-message";
import { login } from "@/services/auth.service";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login({ email, password });

      // Lưu thông tin phiên đăng nhập để các trang gọi API cần xác thực.
      // Xóa dữ liệu đăng nhập kiểu cũ để token không còn tồn tại lâu dài.
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      sessionStorage.setItem("accessToken", result.accessToken);
      sessionStorage.setItem("user", JSON.stringify(result.user));

      // Điều hướng về khu vực làm việc tương ứng với từng vai trò.
      if (result.user.role === "ADMIN") {
        router.replace("/admin");
        return;
      }

      // Chỉ trưởng chi nhánh vào khu vận hành. Nhân viên thường dùng giao diện
      // khách hàng để mua món và tự điểm danh trước khi bắt đầu ca.
      if (result.user.role === "BRANCH_MANAGER") {
        router.replace("/staff/orders");
        return;
      }

      // USER và STAFF được quay lại trang user đã yêu cầu trước lúc đăng nhập.
      // Không nhận redirect sang khu quản trị để tránh điều hướng sai vai trò.
      if (
        redirect?.startsWith("/") &&
        !redirect.startsWith("/admin") &&
        !redirect.startsWith("/staff")
      ) {
        router.replace(redirect);
        return;
      }

      router.replace("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Chào mừng trở lại"
      title="Đăng nhập Kippora"
      description="Tiếp tục hành trình thưởng thức những món bạn yêu thích."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#1F1B18]">
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
              className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-3.5 pl-12 pr-4 outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label className="block text-sm font-medium text-[#1F1B18]">
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#C2763D] transition hover:text-[#9A5D2E]"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A69A90]"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-3.5 pl-12 pr-12 outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#8E8177] transition hover:bg-[#F2E8DE] hover:text-[#4A2C20]"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <ToastMessage message={error} />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-[#4A2C20] to-[#6A3B27] px-4 py-3.5 font-semibold text-white shadow-lg shadow-[#4A2C20]/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#78866B]">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-semibold text-[#C2763D] hover:text-[#9A5D2E]"
        >
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F6F0E9] text-sm text-[#78866B]">
          Đang tải trang đăng nhập...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
