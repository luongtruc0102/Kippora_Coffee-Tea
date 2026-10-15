"use client";

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import AuthShell from "@/components/auth/auth-shell";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  requestPasswordReset,
  resetForgottenPassword,
} from "@/services/auth.service";

type Step = "EMAIL" | "OTP" | "SUCCESS";

export default function ForgotPasswordPage() {
  const { showToast } = useAppToast();
  const [step, setStep] = useState<Step>("EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      const result = await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setOtp("");
      setStep("OTP");
      showToast(result.message, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Chưa thể gửi mã OTP",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("Hai lần nhập mật khẩu chưa khớp.", "error");
      return;
    }

    try {
      setLoading(true);
      const result = await resetForgottenPassword({
        email,
        otp,
        newPassword,
      });
      setStep("SUCCESS");
      showToast(result.message, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể đặt lại mật khẩu",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Khôi phục tài khoản"
      title={
        step === "SUCCESS"
          ? "Đổi mật khẩu thành công"
          : step === "OTP"
            ? "Nhập mã xác nhận"
            : "Quên mật khẩu?"
      }
      description={
        step === "SUCCESS"
          ? "Mật khẩu mới đã được lưu và các phiên đăng nhập cũ đã kết thúc."
          : step === "OTP"
            ? `Mã OTP gồm 6 số đã được gửi đến ${email} và có hiệu lực trong 10 phút.`
            : "Nhập email đã đăng ký để nhận mã xác nhận đặt lại mật khẩu."
      }
    >
      {step === "SUCCESS" ? (
        <div className="space-y-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={32} />
          </span>
          <p className="text-sm leading-6 text-[#746B64]">
            Anh có thể đăng nhập lại bằng mật khẩu vừa tạo.
          </p>
          <Link
            href="/login"
            className="block w-full rounded-2xl bg-gradient-to-r from-[#4A2C20] to-[#6A3B27] px-4 py-3.5 font-semibold text-white shadow-lg shadow-[#4A2C20]/15 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Về trang đăng nhập
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#E7D7C8] bg-[#FFF8F1] p-4 text-sm leading-6 text-[#745642]">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3DFCA] text-[#C2763D]">
              <ShieldCheck size={18} />
            </span>
            <p>
              Kippora không bao giờ yêu cầu cung cấp mã OTP qua điện thoại hoặc
              tin nhắn.
            </p>
          </div>

          {step === "EMAIL" ? (
            <form onSubmit={sendOtp} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Email tài khoản
                </span>
                <span className="relative block">
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
                </span>
              </label>

              <SubmitButton loading={loading} label="Gửi mã OTP" />
            </form>
          ) : (
            <form onSubmit={submitNewPassword} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#1F1B18]">
                  Mã OTP
                </span>
                <span className="relative block">
                  <KeyRound
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A69A90]"
                  />
                  <input
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    required
                    minLength={6}
                    className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] py-3.5 pl-12 pr-4 tracking-[0.35em] outline-none transition placeholder:text-[#B1A79F] hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
                  />
                </span>
              </label>

              <PasswordInput
                label="Mật khẩu mới"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <PasswordInput
                label="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />

              <SubmitButton loading={loading} label="Đặt lại mật khẩu" />

              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setStep("EMAIL")}
                  className="font-semibold text-[#78866B] hover:text-[#4A2C20]"
                >
                  Đổi email
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void sendOtp()}
                  className="font-semibold text-[#C2763D] hover:underline disabled:opacity-50"
                >
                  Gửi lại mã
                </button>
              </div>
            </form>
          )}

          <Link
            href="/login"
            className="mx-auto mt-6 flex w-fit items-center gap-2 text-sm font-semibold text-[#78866B] transition hover:text-[#4A2C20]"
          >
            <ArrowLeft size={16} />
            Quay lại đăng nhập
          </Link>
        </>
      )}
    </AuthShell>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#1F1B18]">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        minLength={6}
        maxLength={100}
        required
        className="w-full rounded-2xl border border-[#DED5CC] bg-[#FCFAF8] px-4 py-3.5 outline-none transition hover:border-[#CBBBAE] focus:border-[#C9894B] focus:bg-white focus:ring-4 focus:ring-[#C9894B]/10"
      />
    </label>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4A2C20] to-[#6A3B27] px-4 py-3.5 font-semibold text-white shadow-lg shadow-[#4A2C20]/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <LoaderCircle size={18} className="animate-spin" />}
      {loading ? "Đang xử lý..." : label}
    </button>
  );
}
