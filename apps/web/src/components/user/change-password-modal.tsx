'use client';

import {
  FormEvent,
  useState,
} from 'react';

import {
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  X,
} from 'lucide-react';

import {
  changePassword,
} from '@/services/auth.service';

import {
  useAppToast,
} from '@/components/ui/app-toast-provider';

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

type PasswordFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  visible: boolean;
  autoComplete:
    | 'current-password'
    | 'new-password';

  onChange: (
    value: string,
  ) => void;

  onToggle: () => void;
};

function PasswordField({
  label,
  value,
  placeholder,
  visible,
  autoComplete,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
        {label}
      </label>

      <div className="relative">
        <LockKeyhole
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A0968F]"
        />

        <input
          type={
            visible
              ? 'text'
              : 'password'
          }
          value={value}
          minLength={6}
          maxLength={100}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="h-12 w-full rounded-xl border border-[#E9E1D8] bg-white pl-12 pr-12 outline-none transition focus:border-[#C9894B] focus:ring-4 focus:ring-[#C9894B]/10"
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={
            visible
              ? 'Ẩn mật khẩu'
              : 'Hiện mật khẩu'
          }
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#8A817B] transition hover:bg-[#FAF0E6] hover:text-[#4A2C20]"
        >
          {visible ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Modal đổi mật khẩu cho user đang đăng nhập.
 * Sau khi thành công, parent xóa phiên và đưa user về trang đăng nhập.
 */
export default function ChangePasswordModal({
  onClose,
  onChanged,
}: Props) {
  const { showToast } =
    useAppToast();

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('');

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      currentPassword.length < 6
    ) {
      showToast(
        'Mật khẩu hiện tại chưa hợp lệ.',
        'error',
      );

      return;
    }

    if (newPassword.length < 6) {
      showToast(
        'Mật khẩu mới phải có ít nhất 6 ký tự.',
        'error',
      );

      return;
    }

    if (
      newPassword ===
      currentPassword
    ) {
      showToast(
        'Mật khẩu mới phải khác mật khẩu hiện tại.',
        'error',
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      showToast(
        'Mật khẩu nhập lại không khớp.',
        'error',
      );

      return;
    }

    try {
      setSubmitting(true);

      const accessToken =
        sessionStorage.getItem(
          'accessToken',
        );

      if (!accessToken) {
        throw new Error(
          'Không tìm thấy phiên đăng nhập.',
        );
      }

      await changePassword(
        accessToken,
        {
          currentPassword,
          newPassword,
        },
      );

      setSubmitting(false);

      showToast(
        'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
        'success',
      );

      onChanged();
    } catch (error) {
      setSubmitting(false);

      showToast(
        error instanceof Error
          ? error.message
          : 'Không thể đổi mật khẩu',
        'error',
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1E3] text-[#C9894B]">
                <KeyRound size={20} />
              </span>

              <h2 className="text-xl font-bold text-[#2A211D]">
                Đổi mật khẩu
              </h2>
            </div>

            <p className="mt-3 text-sm leading-6 text-[#78866B]">
              Sau khi đổi thành công,
              tài khoản sẽ được đăng xuất.
            </p>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#FAF8F5] text-[#5E5650] disabled:cursor-wait disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          <PasswordField
            label="Mật khẩu hiện tại"
            value={currentPassword}
            placeholder="Nhập mật khẩu hiện tại"
            visible={
              showCurrentPassword
            }
            autoComplete="current-password"
            onChange={
              setCurrentPassword
            }
            onToggle={() =>
              setShowCurrentPassword(
                (current) =>
                  !current,
              )
            }
          />

          <PasswordField
            label="Mật khẩu mới"
            value={newPassword}
            placeholder="Tối thiểu 6 ký tự"
            visible={showNewPassword}
            autoComplete="new-password"
            onChange={setNewPassword}
            onToggle={() =>
              setShowNewPassword(
                (current) =>
                  !current,
              )
            }
          />

          <PasswordField
            label="Nhập lại mật khẩu mới"
            value={confirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            visible={
              showConfirmPassword
            }
            autoComplete="new-password"
            onChange={
              setConfirmPassword
            }
            onToggle={() =>
              setShowConfirmPassword(
                (current) =>
                  !current,
              )
            }
          />

          <div className="rounded-xl bg-[#FFF8F1] px-4 py-3 text-xs leading-5 text-[#8A6548]">
            Mật khẩu nên kết hợp chữ,
            số và ký tự đặc biệt để tăng
            độ an toàn.
          </div>

          <div className="flex justify-end gap-3 border-t border-[#E9E1D8] pt-5">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-[#E9E1D8] px-5 py-2.5 text-sm font-semibold text-[#5E5650] disabled:cursor-wait disabled:opacity-50"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
            >
              {submitting && (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              )}

              {submitting
                ? 'Đang đổi...'
                : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}