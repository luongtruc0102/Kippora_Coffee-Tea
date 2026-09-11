"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Coins,
  Home,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Camera,
  KeyRound,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import AddressFormModal from "@/components/user/address-form-modal";
import ProfileFormModal from "@/components/user/profile-form-modal";
import ChangePasswordModal from "@/components/user/change-password-modal";

import {
  deleteAddress,
  getMyAddresses,
  setDefaultAddress,
} from "@/services/address.service";

import {
  getMe,
  type CurrentUser,
} from "@/services/auth.service";

import {
  useAppToast,
} from "@/components/ui/app-toast-provider";

import type {
  UserAddress,
} from "@/types/address";

export default function ProfilePage() {
  const router =
    useRouter();

  const { showToast } =
    useAppToast();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    addresses,
    setAddresses,
  ] = useState<
    UserAddress[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    editingAddress,
    setEditingAddress,
  ] =
    useState<UserAddress | null>(
      null,
    );

  const [
    deletingAddress,
    setDeletingAddress,
  ] =
    useState<UserAddress | null>(
      null,
    );

  const [
    updatingId,
    setUpdatingId,
  ] = useState<number | null>(
    null,
  );

  const [
    profileFormOpen,
    setProfileFormOpen,
  ] = useState(false);

  const [
    changePasswordOpen,
    setChangePasswordOpen,
  ] = useState(false);

  // Tải đồng thời hồ sơ và sổ địa chỉ của user hiện tại.
  useEffect(() => {
    const controller =
      new AbortController();

    let cancelled = false;

    async function loadProfile() {
      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        router.replace(
          "/login?redirect=/profile",
        );

        return;
      }

      try {
        setLoading(true);

        const [
          userData,
          addressData,
        ] = await Promise.all([
          getMe(accessToken),

          getMyAddresses(
            accessToken,
            controller.signal,
          ),
        ]);

        if (cancelled) {
          return;
        }

        setUser(userData);
        setAddresses(
          addressData,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        showToast(
          error instanceof Error
            ? error.message
            : "Không thể tải thông tin tài khoản",
          "error",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    router,
    showToast,
  ]);

  function sortAddresses(
    items: UserAddress[],
  ) {
    return [...items].sort(
      (left, right) => {
        if (
          left.isDefault !==
          right.isDefault
        ) {
          return left.isDefault
            ? -1
            : 1;
        }

        return (
          new Date(
            right.updatedAt,
          ).getTime() -
          new Date(
            left.updatedAt,
          ).getTime()
        );
      },
    );
  }

  // Cập nhật đúng địa chỉ vừa được thêm/sửa mà không tải lại cả trang.
  function handleAddressSaved(
    savedAddress: UserAddress,
  ) {
    setAddresses(
      (current) => {
        const exists =
          current.some(
            (address) =>
              address.id ===
              savedAddress.id,
          );

        const next = exists
          ? current.map(
              (address) =>
                address.id ===
                savedAddress.id
                  ? savedAddress
                  : address,
            )
          : [
              savedAddress,
              ...current,
            ];

        return sortAddresses(
          next,
        );
      },
    );
  }

  // Backend bảo đảm chỉ còn một địa chỉ mặc định.
  async function handleSetDefault(
    address: UserAddress,
  ) {
    if (address.isDefault) {
      return;
    }

    try {
      setUpdatingId(
        address.id,
      );

      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        throw new Error(
          "Không tìm thấy phiên đăng nhập.",
        );
      }

      const updated =
        await setDefaultAddress(
          accessToken,
          address.id,
        );

      setAddresses(
        (current) =>
          sortAddresses(
            current.map(
              (item) => ({
                ...item,

                isDefault:
                  item.id ===
                  updated.id,
              }),
            ),
          ),
      );

      showToast(
        "Đã đặt địa chỉ mặc định.",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể đặt địa chỉ mặc định",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // Sau khi xóa, tải lại danh sách vì backend có thể tự chọn mặc định mới.
  async function handleDelete() {
    if (!deletingAddress) {
      return;
    }

    try {
      setUpdatingId(
        deletingAddress.id,
      );

      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        throw new Error(
          "Không tìm thấy phiên đăng nhập.",
        );
      }

      await deleteAddress(
        accessToken,
        deletingAddress.id,
      );

      const latestAddresses =
        await getMyAddresses(
          accessToken,
        );

      setAddresses(
        latestAddresses,
      );

      setDeletingAddress(
        null,
      );

      showToast(
        "Đã xóa địa chỉ.",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể xóa địa chỉ",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function openCreateForm() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function openEditForm(
    address: UserAddress,
  ) {
    setEditingAddress(
      address,
    );

    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingAddress(null);
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-12">
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-8 text-sm text-[#78866B] shadow-sm">
          Đang tải thông tin tài khoản...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
          Tài khoản
        </p>

        <h1 className="mt-2 text-3xl font-bold text-[#2A211D]">
          Hồ sơ của tôi
        </h1>

        <p className="mt-2 text-sm text-[#78866B]">
          Quản lý thông tin cá nhân và địa chỉ nhận hàng.
        </p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-3xl border border-[#E9E1D8] bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() =>
              setProfileFormOpen(true)
            }
            className="group relative h-20 w-20 cursor-pointer rounded-full"
          >
            <div
              className="flex h-full w-full items-center justify-center rounded-full bg-[#FAF0E6] bg-cover bg-center text-[#C9894B]"
              style={
                user.avatarUrl
                  ? {
                      backgroundImage:
                        `url("${user.avatarUrl}")`,
                    }
                  : undefined
              }
            >
              {!user.avatarUrl && (
                <UserRound size={34} />
              )}
            </div>

            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#4A2C20] text-white">
              <Camera size={15} />
            </span>
          </button>

            <h2 className="mt-4 text-xl font-bold text-[#2A211D]">
              {user.fullName ||
                "Khách hàng Kippora"}
            </h2>

            <div className="mt-5 space-y-3 border-t border-[#F0E8E0] pt-5">
              <div className="flex items-center gap-3 text-sm text-[#5E5650]">
                <Mail
                  size={17}
                  className="shrink-0 text-[#C9894B]"
                />

                <span className="min-w-0 truncate">
                  {user.email}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm text-[#5E5650]">
                <Phone
                  size={17}
                  className="shrink-0 text-[#C9894B]"
                />

                <span>
                  {user.phone ||
                    "Chưa cập nhật số điện thoại"}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setProfileFormOpen(true)
                }
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#4A2C20] transition hover:bg-[#FAF8F5]"
              >
                <Pencil size={17} />
                Chỉnh sửa hồ sơ
              </button>

              <button
                type="button"
                onClick={() =>
                  setChangePasswordOpen(true)
                }
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#4A2C20] transition hover:bg-[#FAF8F5]"
              >
                <KeyRound size={17} />
                Đổi mật khẩu
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-[#4A2C20] p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <Coins
                size={25}
                className="text-[#F2B66D]"
              />

              <p className="font-semibold">
                Điểm tích lũy
              </p>
            </div>

            <p className="mt-4 text-3xl font-bold">
              {user.loyaltyPoints.toLocaleString(
                "vi-VN",
              )}
            </p>

            <p className="mt-1 text-sm text-white/70">
              Mỗi 1.000 điểm được giảm 1.000đ.
            </p>
          </section>

        </aside>

        <section className="rounded-3xl border border-[#E9E1D8] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 border-b border-[#F0E8E0] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <MapPin
                  size={23}
                  className="text-[#C9894B]"
                />

                <h2 className="text-xl font-bold text-[#2A211D]">
                  Sổ địa chỉ
                </h2>
              </div>

              <p className="mt-2 text-sm text-[#78866B]">
                Đã lưu {addresses.length}/10 địa chỉ.
              </p>
            </div>

            <button
              type="button"
              disabled={
                addresses.length >=
                10
              }
              onClick={
                openCreateForm
              }
              className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={18} />

              Thêm địa chỉ
            </button>
          </div>

          {addresses.length ===
          0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FAF0E6]">
                <Home
                  size={28}
                  className="text-[#C9894B]"
                />
              </div>

              <h3 className="mt-4 font-bold text-[#2A211D]">
                Chưa có địa chỉ nào
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-[#78866B]">
                Thêm địa chỉ để lần checkout tiếp theo không phải nhập lại thông tin nhận hàng.
              </p>

              <button
                type="button"
                onClick={
                  openCreateForm
                }
                className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Plus size={18} />

                Thêm địa chỉ đầu tiên
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {addresses.map(
                (address) => (
                  <article
                    key={
                      address.id
                    }
                    className={`rounded-2xl border p-5 transition ${
                      address.isDefault
                        ? "border-[#C9894B] bg-[#FFF9F2]"
                        : "border-[#E9E1D8] bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-[#2A211D]">
                            {
                              address.label
                            }
                          </h3>

                          {address.isDefault && (
                            <span className="rounded-full bg-[#C9894B] px-2.5 py-1 text-xs font-semibold text-white">
                              Mặc định
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-sm font-semibold text-[#4A423D]">
                          {
                            address.receiverName
                          }
                          {" · "}
                          {
                            address.receiverPhone
                          }
                        </p>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78866B]">
                          {
                            address.addressLine
                          }
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          title="Chỉnh sửa"
                          onClick={() =>
                            openEditForm(
                              address,
                            )
                          }
                          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-[#FFF1E3] text-[#C9894B] transition hover:bg-[#FBE3CA]"
                        >
                          <Pencil
                            size={17}
                          />
                        </button>

                        <button
                          type="button"
                          title="Xóa địa chỉ"
                          onClick={() =>
                            setDeletingAddress(
                              address,
                            )
                          }
                          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100"
                        >
                          <Trash2
                            size={17}
                          />
                        </button>
                      </div>
                    </div>

                    {!address.isDefault && (
                      <div className="mt-4 border-t border-[#F0E8E0] pt-4">
                        <button
                          type="button"
                          disabled={
                            updatingId ===
                            address.id
                          }
                          onClick={() =>
                            void handleSetDefault(
                              address,
                            )
                          }
                          className="cursor-pointer text-sm font-semibold text-[#B66F32] disabled:cursor-wait disabled:opacity-50"
                        >
                          {updatingId ===
                          address.id
                            ? "Đang cập nhật..."
                            : "Đặt làm mặc định"}
                        </button>
                      </div>
                    )}
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      <ProfileFormModal
        open={profileFormOpen}
        user={user}
        onClose={() =>
          setProfileFormOpen(false)
        }
        onSaved={(updatedUser) => {
          setUser(updatedUser);

          setProfileFormOpen(
            false,
          );
        }}
      />

      {changePasswordOpen && (
        <ChangePasswordModal
          onClose={() =>
            setChangePasswordOpen(false)
          }
          onChanged={() => {
            // Xóa phiên hiện tại để user đăng nhập lại bằng mật khẩu mới.
            sessionStorage.removeItem(
              "accessToken",
            );

            sessionStorage.removeItem(
              "user",
            );

            setChangePasswordOpen(
              false,
            );

            router.replace("/login");
          }}
        />
      )}

      {formOpen && (
        <AddressFormModal
          key={
            editingAddress?.id ??
            "new-address"
          }
          address={editingAddress}
          defaultReceiverName={
            user.fullName ?? ""
          }
          defaultReceiverPhone={
            user.phone ?? ""
          }
          onClose={closeForm}
          onSaved={
            handleAddressSaved
          }
        />
      )}

      {deletingAddress && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <Trash2
                size={25}
                className="text-red-500"
              />
            </div>

            <h2 className="mt-4 text-xl font-bold text-[#2A211D]">
              Xóa địa chỉ?
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#78866B]">
              Anh có chắc muốn xóa địa chỉ{" "}
              <strong className="text-[#4A423D]">
                {
                  deletingAddress.label
                }
              </strong>
              ?
            </p>

            {deletingAddress.isDefault && (
              <p className="mt-2 text-xs text-[#B66F32]">
                Hệ thống sẽ tự chọn một địa chỉ khác làm mặc định.
              </p>
            )}

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                disabled={
                  updatingId !==
                  null
                }
                onClick={() =>
                  setDeletingAddress(
                    null,
                  )
                }
                className="cursor-pointer rounded-xl border border-[#E9E1D8] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={
                  updatingId !==
                  null
                }
                onClick={() =>
                  void handleDelete()
                }
                className="cursor-pointer rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
              >
                {updatingId !==
                null
                  ? "Đang xóa..."
                  : "Xóa địa chỉ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}