"use client";

import {
  Star,
  Trash2,
} from "lucide-react";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useAppToast,
} from "@/components/ui/app-toast-provider";

import {
  createOrderReview,
  deleteOrderReview,
  getMyOrderReview,
  updateOrderReview,
} from "@/services/review.service";

import type {
  OrderItem,
} from "@/types/order";

import type {
  OrderReview,
} from "@/types/review";

type Props = {
  orderId: number;

  items: OrderItem[];
};

type StarRatingProps = {
  value: number;

  disabled?: boolean;

  onChange?: (
    rating: number,
  ) => void;
};

function StarRating({
  value,
  disabled = false,
  onChange,
}: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(
        (rating) => {
          const active =
            rating <= value;

          return (
            <button
              key={rating}
              type="button"
              disabled={disabled}
              aria-label={`${rating} sao`}
              onClick={() =>
                onChange?.(
                  rating,
                )
              }
              className={`transition ${
                disabled
                  ? "cursor-default"
                  : "hover:scale-110"
              }`}
            >
              <Star
                size={24}
                className={
                  active
                    ? "fill-[#E6A23C] text-[#E6A23C]"
                    : "text-[#D9CABE]"
                }
              />
            </button>
          );
        },
      )}
    </div>
  );
}

export default function OrderReviewSection({
  orderId,
  items,
}: Props) {
  const {
    showToast,
  } = useAppToast();

  const [
    review,
    setReview,
  ] =
    useState<OrderReview | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    deleteConfirmOpen,
    setDeleteConfirmOpen,
  ] = useState(false);

  const [
    overallRating,
    setOverallRating,
  ] = useState(5);

  const [
    comment,
    setComment,
  ] = useState("");

  const [
    itemRatings,
    setItemRatings,
  ] = useState<
    Record<number, number>
  >({});

  const [
    itemComments,
    setItemComments,
  ] = useState<
    Record<number, string>
  >({});

  function fillForm(
    current:
      OrderReview | null,
  ) {
    setOverallRating(
      current
        ?.overallRating ?? 5,
    );

    setComment(
      current?.comment ?? "",
    );

    const ratings:
      Record<number, number> =
        {};

    const comments:
      Record<number, string> =
        {};

    for (
      const itemReview
      of current
        ?.productReviews ?? []
    ) {
      ratings[
        itemReview.orderItemId
      ] =
        itemReview.rating;

      comments[
        itemReview.orderItemId
      ] =
        itemReview.comment ??
        "";
    }

    setItemRatings(ratings);
    setItemComments(comments);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReview() {
      try {
        setLoading(true);

        const accessToken =
          sessionStorage.getItem(
            "accessToken",
          );

        if (!accessToken) {
          return;
        }

        const data =
          await getMyOrderReview(
            accessToken,
            orderId,
          );

        if (cancelled) {
          return;
        }

        setReview(data);
        fillForm(data);

        // Chưa có đánh giá thì hiển thị form ngay.
        setEditing(
          data === null,
        );
      } catch (error) {
        if (!cancelled) {
          showToast(
            error instanceof Error
              ? error.message
              : "Không thể tải đánh giá",
            "error",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReview();

    return () => {
      cancelled = true;
    };
  }, [
    orderId,
    showToast,
  ]);

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    try {
      setSaving(true);

      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        throw new Error(
          "Không tìm thấy phiên đăng nhập",
        );
      }

      const reviewedItems =
        items
          .filter(
            (item) =>
              (
                itemRatings[
                  item.id
                ] ?? 0
              ) > 0,
          )
          .map((item) => ({
            orderItemId:
              item.id,

            rating:
              itemRatings[
                item.id
              ],

            comment:
              itemComments[
                item.id
              ]?.trim() ||
              undefined,
          }));

      const input = {
        overallRating,

        comment:
          comment.trim() ||
          undefined,

        items:
          reviewedItems,
      };

      const saved =
        review
          ? await updateOrderReview(
              accessToken,
              review.id,
              input,
            )
          : await createOrderReview(
              accessToken,
              orderId,
              input,
            );

      setReview(saved);
      fillForm(saved);
      setEditing(false);

      showToast(
        review
          ? "Đã cập nhật đánh giá"
          : "Cảm ơn anh/chị đã đánh giá!",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể lưu đánh giá",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!review) {
      return;
    }

    try {
      setSaving(true);

      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        throw new Error(
          "Không tìm thấy phiên đăng nhập",
        );
      }

      await deleteOrderReview(
        accessToken,
        review.id,
      );

      setReview(null);
      fillForm(null);
      setEditing(true);
      setDeleteConfirmOpen(false);

      showToast(
        "Đã xóa đánh giá",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể xóa đánh giá",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white p-5 text-sm text-[#78866B] shadow-sm">
        Đang tải đánh giá...
      </section>
    );
  }

  if (
    review &&
    !editing
  ) {
    return (
      <section className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-[#2A211D]">
              Đánh giá của bạn
            </h2>

            <div className="mt-3">
              <StarRating
                value={
                  review.overallRating
                }
                disabled
              />
            </div>

            {review.comment && (
              <p className="mt-3 text-sm leading-6 text-[#5E5650]">
                {review.comment}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setEditing(true)
              }
              className="rounded-xl border border-[#D9CABE] px-4 py-2 text-sm font-semibold text-[#4A2C20]"
            >
              Chỉnh sửa
            </button>

            <button
              type="button"
              onClick={() =>
                setDeleteConfirmOpen(
                  true,
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600"
              aria-label="Xóa đánh giá"
            >
              <Trash2
                size={18}
              />
            </button>
          </div>
        </div>

        {/* Phản hồi chính thức của cửa hàng dành cho đánh giá đơn hàng. */}
        {review.adminReply && (
          <div className="mt-5 rounded-2xl border border-[#F0D9C1] bg-[#FFF9F2] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-[#4A2C20]">
                Phản hồi từ Kippora
              </p>

              {review.adminRepliedAt && (
                <span className="text-xs text-[#A0968F]">
                  {new Date(
                    review.adminRepliedAt,
                  ).toLocaleDateString(
                    "vi-VN",
                  )}
                </span>
              )}
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5E5650]">
              {review.adminReply}
            </p>

            <p className="mt-2 text-xs text-[#9B8E84]">
              {review.adminRepliedBy
                ?.fullName ||
                "Đội ngũ Kippora"}
            </p>
          </div>
        )}

        {review.productReviews
          .length > 0 && (
          <div className="mt-5 divide-y divide-[#F0E8E0] border-t border-[#F0E8E0]">
            {review.productReviews.map(
              (
                itemReview,
              ) => (
                <div
                  key={
                    itemReview.id
                  }
                  className="py-4"
                >
                  <p className="font-semibold text-[#2A211D]">
                    {
                      itemReview
                        .orderItem
                        .productName
                    }{" "}
                    · Size{" "}
                    {
                      itemReview
                        .orderItem
                        .size
                    }
                  </p>

                  <div className="mt-2">
                    <StarRating
                      value={
                        itemReview.rating
                      }
                      disabled
                    />
                  </div>

                  {itemReview.comment && (
                    <p className="mt-2 text-sm text-[#5E5650]">
                      {
                        itemReview.comment
                      }
                    </p>
                  )}
                </div>
              ),
            )}
          </div>
        )}

        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-[#2A211D]">
                Xóa đánh giá?
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#78866B]">
                Điểm sao và nhận xét của đơn hàng này sẽ bị xóa.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setDeleteConfirmOpen(
                      false,
                    )
                  }
                  className="rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold"
                >
                  Giữ lại
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void handleDelete()
                  }
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving
                    ? "Đang xóa..."
                    : "Xóa đánh giá"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[#2A211D]">
        {review
          ? "Chỉnh sửa đánh giá"
          : "Đánh giá đơn hàng"}
      </h2>

      <p className="mt-1 text-sm text-[#78866B]">
        Chia sẻ trải nghiệm để Kippora phục vụ tốt hơn.
      </p>

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-5 space-y-6"
      >
        <div>
          <label className="text-sm font-semibold text-[#4A2C20]">
            Trải nghiệm chung
          </label>

          <div className="mt-2">
            <StarRating
              value={
                overallRating
              }
              onChange={
                setOverallRating
              }
            />
          </div>

          <textarea
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(event) =>
              setComment(
                event.target.value,
              )
            }
            placeholder="Chia sẻ cảm nhận về đơn hàng..."
            className="mt-3 w-full resize-none rounded-xl border border-[#D9CABE] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
          />
        </div>

        <div className="space-y-4 border-t border-[#F0E8E0] pt-5">
          <div>
            <h3 className="font-semibold text-[#2A211D]">
              Đánh giá từng món
            </h3>

            <p className="mt-1 text-xs text-[#8A817B]">
              Phần này không bắt buộc.
            </p>
          </div>

          {items.map(
            (item) => (
              <div
                key={item.id}
                className="rounded-xl bg-[#FAF8F5] p-4"
              >
                <p className="font-semibold text-[#2A211D]">
                  {
                    item.productName
                  }{" "}
                  · Size{" "}
                  {item.size}
                </p>

                <div className="mt-2">
                  <StarRating
                    value={
                      itemRatings[
                        item.id
                      ] ?? 0
                    }
                    onChange={(
                      rating,
                    ) =>
                      setItemRatings(
                        (
                          current,
                        ) => ({
                          ...current,
                          [item.id]:
                            rating,
                        }),
                      )
                    }
                  />
                </div>

                {(
                  itemRatings[
                    item.id
                  ] ?? 0
                ) > 0 && (
                  <input
                    value={
                      itemComments[
                        item.id
                      ] ?? ""
                    }
                    maxLength={500}
                    onChange={(
                      event,
                    ) =>
                      setItemComments(
                        (
                          current,
                        ) => ({
                          ...current,
                          [item.id]:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="Nhận xét về món này..."
                    className="mt-3 h-11 w-full rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B]"
                  />
                )}
              </div>
            ),
          )}
        </div>

        <div className="flex justify-end gap-3">
          {review && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                fillForm(
                  review,
                );

                setEditing(
                  false,
                );
              }}
              className="rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold"
            >
              Hủy chỉnh sửa
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {saving
              ? "Đang lưu..."
              : review
                ? "Lưu thay đổi"
                : "Gửi đánh giá"}
          </button>
        </div>
      </form>
    </section>
  );
}