"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import Image from "next/image";
import Link from "next/link";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import ToastMessage from "@/components/ui/toast-message";
import {
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/services/cart.service";

import type { Cart, CartItem } from "@/types/cart";

import {
  consumeCartMessage,
  consumeNewCartItemIds,
  notifyCartUpdated,
} from "@/utils/cart.util";

type DeleteConfirmation =
  | {
      kind: "item";
      item: CartItem;
    }
  | { kind: "all" };

export default function CartPage() {
  const router = useRouter();

  const [cart, setCart] = useState<Cart | null>(null);

  const [loading, setLoading] = useState(true);

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [error, setError] = useState("");

  const [actionMessage, setActionMessage] = useState("");

  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);

  // undefined là chưa consume; mảng giữ được qua lượt effect thứ hai của Strict Mode.
  const pendingNewItemIdsRef = useRef<number[] | undefined>(undefined);
  const pendingMessageRef = useRef<string | null | undefined>(undefined);

  // Tải giỏ và chỉ chọn các CartItem vừa được thêm từ menu hoặc luồng mua lại.
  useEffect(() => {
    // Đọc trước khi chờ API và giữ bằng ref để React Strict Mode không
    // consume hai lần rồi để lượt effect sau ghi đè lựa chọn thành rỗng.
    if (pendingNewItemIdsRef.current === undefined) {
      pendingNewItemIdsRef.current = consumeNewCartItemIds();
    }
    if (pendingMessageRef.current === undefined) {
      pendingMessageRef.current = consumeCartMessage();
    }
    const newItemIds = pendingNewItemIdsRef.current;
    setActionMessage(pendingMessageRef.current ?? "");

    // Lấy dữ liệu thật từ backend rồi đồng bộ giỏ, lựa chọn và badge header.
    async function loadCart() {
      try {
        setLoading(true);
        setError("");

        const accessToken = sessionStorage.getItem("accessToken");

        if (!accessToken) {
          router.replace("/login?redirect=/cart");

          return;
        }

        const data = await getCart(accessToken);

        setCart(data);

        const validNewItemIds = newItemIds.filter((itemId) =>
          data.items.some((item) => item.id === itemId),
        );

        // Mặc định không chọn; mua lại có thể chọn nhiều dòng vừa thêm.
        setSelectedItemIds(validNewItemIds);

        pendingNewItemIdsRef.current = [];
        notifyCartUpdated(data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Không thể tải giỏ hàng",
        );
      } finally {
        setLoading(false);
      }
    }

    loadCart();
  }, [router]);

  // Định dạng số thành tiền Việt Nam để hiển thị trong giỏ.
  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value));
  }

  // Ghép URL backend cho ảnh sản phẩm lưu dưới dạng đường dẫn tương đối.
  function getImageUrl(imageUrl: string | null) {
    if (!imageUrl) {
      return null;
    }

    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      return null;
    }

    return `${apiUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
  }

  // Bật hoặc bỏ chọn một CartItem để quyết định món nào được checkout.
  function toggleItem(itemId: number) {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }

  // Chọn toàn bộ nếu chưa đủ; bỏ toàn bộ nếu tất cả món đang được chọn.
  function toggleAllItems() {
    if (!cart) {
      return;
    }

    const allSelected =
      cart.items.length > 0 &&
      cart.items.every((item) => selectedItemIds.includes(item.id));

    setSelectedItemIds(allSelected ? [] : cart.items.map((item) => item.id));
  }

  // Cập nhật quantity qua backend rồi đồng bộ tổng tiền và badge.
  async function handleQuantity(item: CartItem, quantity: number) {
    if (quantity < 1) {
      return;
    }

    try {
      setError("");
      setUpdatingId(item.id);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        router.replace("/login?redirect=/cart");

        return;
      }

      const updated = await updateCartItem(accessToken, item.id, {
        quantity,
      });

      setCart(updated);
      notifyCartUpdated(updated);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể cập nhật số lượng",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // Xóa một CartItem sau xác nhận và bỏ ID đó khỏi danh sách checkout.
  async function handleRemove(itemId: number) {
    try {
      setError("");
      setUpdatingId(itemId);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        return;
      }

      const updated = await removeCartItem(accessToken, itemId);

      setCart(updated);
      notifyCartUpdated(updated);
      setDeleteConfirmation(null);

      setSelectedItemIds((current) => current.filter((id) => id !== itemId));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể xóa món");
    } finally {
      setUpdatingId(null);
    }
  }

  // Xóa mọi CartItem, đưa badge và danh sách lựa chọn về trạng thái rỗng.
  async function handleClear() {
    try {
      setError("");
      setUpdatingId(-1);

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        return;
      }

      await clearCart(accessToken);

      if (cart) {
        const emptiedCart = {
          ...cart,
          items: [],
          totalPrice: 0,
        };

        setCart(emptiedCart);
        notifyCartUpdated(emptiedCart);
      }

      setSelectedItemIds([]);
      setDeleteConfirmation(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể xóa giỏ hàng",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // Chuyển đúng các CartItem đang chọn sang checkout qua session của tab.
  function handleCheckout() {
    if (selectedItemIds.length === 0) {
      return;
    }

    // Checkout từ giỏ phải xóa nguồn mua lại cũ để hai luồng không trộn nhau.
    sessionStorage.removeItem("checkoutReorderOrderId");
    sessionStorage.removeItem("checkoutReorderOrderItemIds");
    sessionStorage.setItem("checkoutItemIds", JSON.stringify(selectedItemIds));

    router.push("/checkout");
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 text-center text-sm text-[#78866B]">
        Đang tải giỏ hàng...
      </div>
    );
  }

  // Lọc từ giỏ thật để mọi phần tóm tắt chỉ dùng các dòng đang được tick.
  const selectedItems =
    cart?.items.filter((item) => selectedItemIds.includes(item.id)) ?? [];

  // Tổng quantity của các dòng đã chọn, dùng cho nhãn "Số món".
  const selectedQuantity = selectedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  // Tổng tiền chỉ của các món đã chọn, không lấy totalPrice của toàn bộ giỏ.
  const selectedTotal = selectedItems.reduce(
    (total, item) => total + Number(item.lineTotal),
    0,
  );

  // Điều khiển trạng thái checkbox "Chọn tất cả" theo toàn bộ CartItem.
  const allSelected =
    !!cart &&
    cart.items.length > 0 &&
    cart.items.every((item) => selectedItemIds.includes(item.id));

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1F1B18]">Giỏ hàng</h1>

          <p className="mt-1 text-sm text-[#78866B]">
            Kiểm tra món trước khi thanh toán.
          </p>
        </div>

        <Link
          href="/menu"
          className="flex items-center gap-2 text-sm font-medium text-[#4A2C20]"
        >
          <ArrowLeft size={17} />
          Tiếp tục chọn món
        </Link>
      </div>

      <ToastMessage message={actionMessage} variant="success" />
      <ToastMessage message={error} />

      {!cart || cart.items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#E9E1D8] bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#4A2C20]">
            <ShoppingBag size={25} />
          </div>

          <h2 className="mt-4 text-xl font-bold text-[#2A211D]">
            Giỏ hàng đang trống
          </h2>

          <p className="mt-2 text-sm text-[#78866B]">
            Chọn một món ngon rồi quay lại đây nhé.
          </p>

          <Link
            href="/menu"
            className="mt-5 inline-flex rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white"
          >
            Xem menu
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-[#E9E1D8] bg-white px-4 py-3 shadow-sm">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAllItems}
                  className="h-4 w-4 accent-[#4A2C20]"
                />

                <span className="text-sm font-semibold text-[#2A211D]">
                  Chọn tất cả
                </span>

                <span className="text-xs text-[#8A817B]">
                  ({cart.items.length} món)
                </span>
              </label>

              <span className="text-sm text-[#78866B]">
                Đã chọn{" "}
                <strong className="text-[#4A2C20]">{selectedQuantity}</strong>{" "}
                sản phẩm
              </span>
            </div>
            {cart.items.map((item) => {
              const imageUrl = getImageUrl(item.product.imageUrl);

              return (
                <article
                  key={item.id}
                  className={`flex gap-3 rounded-2xl border bg-white p-4 shadow-sm transition ${
                    selectedItemIds.includes(item.id)
                      ? "border-[#D8C6B7]"
                      : "border-[#E9E1D8] opacity-70"
                  }`}
                >
                  <div className="flex shrink-0 items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="h-4 w-4 cursor-pointer accent-[#4A2C20]"
                    />
                  </div>
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#F3E9DE] sm:h-28 sm:w-28">
                    {imageUrl ? (
                      <Image
                        unoptimized
                        src={imageUrl}
                        alt={item.product.name}
                        width={112}
                        height={112}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#C9894B]">
                        <ShoppingBag size={24} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-[#2A211D]">
                          {item.product.name}
                        </h2>

                        <p className="mt-1 text-sm text-[#78866B]">
                          Size {item.variant.size}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() =>
                          setDeleteConfirmation({ kind: "item", item })
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    {item.toppings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.toppings.map((relation) => (
                          <span
                            key={relation.toppingId}
                            className="rounded-lg bg-[#F7F2EC] px-2 py-1 text-xs text-[#6B625C]"
                          >
                            {relation.topping.name} +{" "}
                            {formatCurrency(relation.topping.price)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            updatingId === item.id || item.quantity <= 1
                          }
                          onClick={() =>
                            handleQuantity(item, item.quantity - 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E9E1D8] text-[#4A2C20] disabled:opacity-40"
                        >
                          <Minus size={15} />
                        </button>

                        <span className="min-w-6 text-center text-sm font-bold">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() =>
                            handleQuantity(item, item.quantity + 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4A2C20] text-white disabled:opacity-50"
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-[#8A817B]">
                          {formatCurrency(item.unitPrice)} / món
                        </p>

                        <p className="mt-1 font-bold text-[#4A2C20]">
                          {formatCurrency(item.lineTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              onClick={() => setDeleteConfirmation({ kind: "all" })}
              className="text-sm font-medium text-red-500 transition hover:text-red-600"
            >
              Xóa toàn bộ giỏ hàng
            </button>
          </div>

          <aside className="h-fit self-start rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-bold text-[#2A211D]">
              Tóm tắt đơn hàng
            </h2>

            {/* Danh sách dài vẫn cuộn được nhưng ẩn scrollbar để sidebar gọn. */}
            {selectedItems.length > 0 ? (
              <div className="no-scrollbar mt-4 max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#FAF8F5] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#2A211D]">
                          {item.product.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#78866B]">
                          Size {item.variant.size} · x{item.quantity}
                        </p>
                      </div>

                      <span className="shrink-0 text-sm font-semibold text-[#4A2C20]">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>

                    {item.toppings.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#8A817B]">
                        Topping:{" "}
                        {item.toppings
                          .map((relation) => relation.topping.name)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[#FAF8F5] px-3 py-3 text-sm text-[#8A817B]">
                Chọn sản phẩm bên trái để xem tóm tắt.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-[#78866B]">Số món</span>

              <span className="font-semibold text-[#2A211D]">
                {selectedQuantity}
              </span>
            </div>

            <div className="mt-4 border-t border-[#E9E1D8] pt-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#2A211D]">Tổng cộng</span>

                <span className="text-xl font-bold text-[#4A2C20]">
                  {formatCurrency(selectedTotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={selectedItemIds.length === 0}
              onClick={handleCheckout}
              className="mt-5 w-full rounded-2xl bg-[#4A2C20] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tiến hành thanh toán
            </button>
          </aside>
        </div>
      )}

      {/* Dùng chung một modal xác nhận cho xóa một món và xóa toàn bộ. */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#E9E1D8] bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <AlertTriangle size={24} />
            </div>

            <h2 className="mt-4 text-xl font-bold text-[#2A211D]">
              {deleteConfirmation.kind === "item"
                ? "Xóa sản phẩm khỏi giỏ?"
                : "Xóa toàn bộ giỏ hàng?"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#78866B]">
              {deleteConfirmation.kind === "item"
                ? `Bạn có chắc muốn xóa “${deleteConfirmation.item.product.name}” không?`
                : "Tất cả sản phẩm trong giỏ sẽ bị xóa. Thao tác này không thể hoàn tác."}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={updatingId !== null}
                onClick={() => setDeleteConfirmation(null)}
                className="rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#5E5650] disabled:opacity-60"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={updatingId !== null}
                onClick={() => {
                  if (deleteConfirmation.kind === "item") {
                    void handleRemove(deleteConfirmation.item.id);
                    return;
                  }

                  void handleClear();
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {updatingId !== null ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
