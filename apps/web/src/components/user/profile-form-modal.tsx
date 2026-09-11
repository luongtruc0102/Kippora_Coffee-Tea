"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  LoaderCircle,
  UserRound,
  X,
} from "lucide-react";

import {
  updateProfile,
  type CurrentUser,
  type UpdateProfileInput,
} from "@/services/auth.service";

import {
  uploadAvatar,
} from "@/services/upload.service";

import {
  persistAuthenticatedUser,
} from "@/utils/auth.util";

import {
  useAppToast,
} from "@/components/ui/app-toast-provider";

type Props = {
  open: boolean;
  user: CurrentUser;

  onClose: () => void;

  onSaved: (
    user: CurrentUser,
  ) => void;
};

export default function ProfileFormModal({
  open,
  user,
  onClose,
  onSaved,
}: Props) {
  const { showToast } =
    useAppToast();

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null,
  );

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState<
    string | null
  >(null);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  // Nạp thông tin hiện tại mỗi khi modal được mở.
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setFullName(
        user.fullName ?? "",
      );

      setPhone(
        user.phone ?? "",
      );

      setSelectedFile(null);
      setPreviewUrl(user.avatarUrl);
      setSubmitting(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    user,
  ]);

  // Thu hồi object URL khi modal đóng hoặc component bị hủy.
  useEffect(() => {
    return () => {
      if (
        previewUrl?.startsWith(
          "blob:",
        )
      ) {
        URL.revokeObjectURL(
          previewUrl,
        );
      }
    };
  }, [previewUrl]);

  function handleFileChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      showToast(
        "Avatar chỉ hỗ trợ JPG, PNG hoặc WEBP.",
        "error",
      );

      event.target.value = "";

      return;
    }

    if (
      file.size >
      2 * 1024 * 1024
    ) {
      showToast(
        "Avatar không được vượt quá 2MB.",
        "error",
      );

      event.target.value = "";

      return;
    }

    if (
      previewUrl?.startsWith(
        "blob:",
      )
    ) {
      URL.revokeObjectURL(
        previewUrl,
      );
    }

    setSelectedFile(file);

    setPreviewUrl(
      URL.createObjectURL(
        file,
      ),
    );
  }

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    const normalizedName =
      fullName.trim();

    const normalizedPhone =
      phone.trim();

    if (
      normalizedName.length < 2
    ) {
      showToast(
        "Họ tên phải có ít nhất 2 ký tự.",
        "error",
      );

      return;
    }

    if (
      normalizedPhone &&
      normalizedPhone.length < 8
    ) {
      showToast(
        "Số điện thoại chưa hợp lệ.",
        "error",
      );

      return;
    }

    try {
      setSubmitting(true);

      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        throw new Error(
          "Không tìm thấy phiên đăng nhập.",
        );
      }

      let avatarUrl =
        user.avatarUrl;

      // Upload ảnh trước, sau đó mới lưu URL vào User.
      if (selectedFile) {
        const uploadResult =
          await uploadAvatar(
            accessToken,
            selectedFile,
          );

        avatarUrl =
          uploadResult.imageUrl;
      }

      const input:
        UpdateProfileInput = {
        fullName:
          normalizedName,
      };

      if (normalizedPhone) {
        input.phone =
          normalizedPhone;
      }

      if (avatarUrl) {
        input.avatarUrl =
          avatarUrl;
      }

      const updatedUser =
        await updateProfile(
          accessToken,
          input,
        );

      // Đồng bộ localStorage và báo cho header cập nhật ngay.
      persistAuthenticatedUser({
        id: updatedUser.id,
        email:
          updatedUser.email,

        fullName:
          updatedUser.fullName,

        phone:
          updatedUser.phone,

        avatarUrl:
          updatedUser.avatarUrl,

        role:
          updatedUser.role,
      });

      onSaved(updatedUser);

      showToast(
        "Đã cập nhật hồ sơ.",
        "success",
      );

      onClose();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật hồ sơ",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="no-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#2A211D]">
              Chỉnh sửa hồ sơ
            </h2>

            <p className="mt-1 text-sm text-[#78866B]">
              Cập nhật ảnh đại diện và thông tin liên hệ.
            </p>
          </div>

          <button
            type="button"
            disabled={
              submitting
            }
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#FAF8F5] text-[#5E5650] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-5 p-6"
        >
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={
                submitting
              }
              onClick={() =>
                fileInputRef.current
                  ?.click()
              }
              className="group relative h-28 w-28 cursor-pointer rounded-full disabled:cursor-wait"
            >
              <div
                className="flex h-full w-full items-center justify-center rounded-full border-4 border-[#FAF0E6] bg-[#F3E9DE] bg-cover bg-center text-[#C9894B]"
                style={
                  previewUrl
                    ? {
                        backgroundImage:
                          `url("${previewUrl}")`,
                      }
                    : undefined
                }
              >
                {!previewUrl && (
                  <UserRound
                    size={42}
                  />
                )}
              </div>

              <span className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#4A2C20] text-white shadow-md">
                <Camera size={17} />
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={
                handleFileChange
              }
              className="hidden"
            />

            <p className="mt-3 text-xs text-[#8A817B]">
              JPG, PNG hoặc WEBP · tối đa 2MB
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
              Họ và tên
            </label>

            <input
              value={fullName}
              maxLength={100}
              onChange={(event) =>
                setFullName(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
              Email
            </label>

            <input
              value={user.email}
              disabled
              className="h-12 w-full cursor-not-allowed rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] px-4 text-[#8A817B]"
            />

            <p className="mt-2 text-xs text-[#A0968F]">
              Đổi email sẽ được bổ sung cùng xác thực OTP sau.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
              Số điện thoại
            </label>

            <input
              value={phone}
              maxLength={20}
              inputMode="tel"
              placeholder="Nhập số điện thoại..."
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-[#E9E1D8] pt-5">
            <button
              type="button"
              disabled={
                submitting
              }
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-[#E9E1D8] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={
                submitting
              }
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
            >
              {submitting && (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              )}

              {submitting
                ? "Đang lưu..."
                : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}