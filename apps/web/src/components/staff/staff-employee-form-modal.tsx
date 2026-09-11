"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import { createBranchStaff } from "@/services/user.service";
import type { BranchStaff } from "@/types/user";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (staff: BranchStaff) => void;
};

export default function StaffEmployeeFormModal({
  open,
  onClose,
  onSaved,
}: Props) {
  const { showToast } = useAppToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  function handleClose() {
    if (saving) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");

      const normalizedName = fullName.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhone = phone.trim();

      if (normalizedName.length < 2) {
        throw new Error("Họ tên phải có ít nhất 2 ký tự.");
      }
      if (!normalizedEmail) throw new Error("Vui lòng nhập email.");
      if (!/^[0-9]{9,11}$/.test(normalizedPhone)) {
        throw new Error("Số điện thoại không hợp lệ.");
      }
      if (password.length < 6) {
        throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
      }
      if (password !== confirmPassword) {
        throw new Error("Mật khẩu xác nhận không khớp.");
      }

      const created = await createBranchStaff(accessToken, {
        fullName: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        password,
      });

      onSaved(created);
      showToast("Đã thêm nhân viên vào chi nhánh", "success");
      resetForm();
      onClose();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể tạo nhân viên",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-[#1F1B18]">Thêm nhân viên</h2>
            <p className="mt-1 text-sm text-[#78866B]">
              Tài khoản có role Nhân viên và tự thuộc chi nhánh hiện tại.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            aria-label="Đóng"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-[#78866B] transition hover:bg-[#FAF8F5]"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#2A211D]">
              Họ và tên
            </span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nhập họ tên nhân viên"
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-semibold text-[#2A211D]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-[#2A211D]">
                Số điện thoại
              </span>
              <input
                inputMode="numeric"
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value.replace(/\D/g, ""))
                }
                maxLength={11}
                placeholder="0901234567"
                className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#2A211D]">
              Mật khẩu ban đầu
            </span>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 pr-12 outline-none focus:border-[#C9894B]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center text-[#8A817B]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#2A211D]">
              Xác nhận mật khẩu
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Nhập lại mật khẩu"
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
            />
          </label>

          <div className="flex justify-end gap-3 border-t border-[#F0E8E0] pt-5">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="cursor-pointer rounded-xl border border-[#E9E1D8] px-5 py-2.5 font-semibold text-[#5E5650] hover:bg-[#FAF8F5]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-xl bg-[#4A2C20] px-5 py-2.5 font-semibold text-white hover:bg-[#382118] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Đang tạo..." : "Tạo nhân viên"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
