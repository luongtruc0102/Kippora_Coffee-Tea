"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  MessageSquareReply,
  Search,
  Send,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import {
  getAdminReviews,
  removeReviewReply,
  replyToReview,
  updateReviewVisibility,
} from "@/services/review.service";

import { useAppToast } from "@/components/ui/app-toast-provider";

import type {
  AdminOrderReview,
} from "@/types/review";

type RatingFilter =
  | "ALL"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5";

type VisibilityFilter =
  | "ALL"
  | "VISIBLE"
  | "HIDDEN";

type ReplyFilter =
  | "ALL"
  | "REPLIED"
  | "PENDING";

export default function AdminReviewsPage() {
  const { showToast } =
    useAppToast();

  const [
    reviews,
    setReviews,
  ] = useState<
    AdminOrderReview[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const debouncedSearch =
    useDebouncedValue(search);

  const [
    ratingFilter,
    setRatingFilter,
  ] = useState<RatingFilter>(
    "ALL",
  );

  const [
    visibilityFilter,
    setVisibilityFilter,
  ] =
    useState<VisibilityFilter>(
      "ALL",
    );

  const [
    replyFilter,
    setReplyFilter,
  ] = useState<ReplyFilter>(
    "ALL",
  );

  const [
    replyingReview,
    setReplyingReview,
  ] =
    useState<AdminOrderReview | null>(
      null,
    );

  const [
    deletingReview,
    setDeletingReview,
  ] =
    useState<AdminOrderReview | null>(
      null,
    );

  const [reply, setReply] =
    useState("");

  const [
    updatingId,
    setUpdatingId,
  ] = useState<number | null>(
    null,
  );

  const loadReviews =
    useCallback(
      async (
        query = "",
        signal?: AbortSignal,
      ) => {
        await Promise.resolve();

        try {
          setLoading(true);

          const accessToken =
            sessionStorage.getItem(
              "accessToken",
            );

          if (!accessToken) {
            throw new Error(
              "Không tìm thấy phiên đăng nhập.",
            );
          }

          const data =
            await getAdminReviews(
              accessToken,
              query,
              signal,
            );

          setReviews(data);
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
              : "Không thể tải đánh giá",
            "error",
          );
        } finally {
          if (!signal?.aborted) {
            setLoading(false);
          }
        }
      },
      [showToast],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    queueMicrotask(() => {
      if (controller.signal.aborted) {
        return;
      }

      void loadReviews(
        debouncedSearch,
        controller.signal,
      );
    });

    return () => {
      controller.abort();
    };
  }, [
    debouncedSearch,
    loadReviews,
  ]);

  const filteredReviews =
    useMemo(() => {
      return reviews.filter(
        (review) => {
          const matchesRating =
            ratingFilter ===
              "ALL" ||
            review.overallRating ===
              Number(
                ratingFilter,
              );

          const matchesVisibility =
            visibilityFilter ===
              "ALL" ||
            (visibilityFilter ===
              "VISIBLE" &&
              review.isVisible) ||
            (visibilityFilter ===
              "HIDDEN" &&
              !review.isVisible);

          const matchesReply =
            replyFilter ===
              "ALL" ||
            (replyFilter ===
              "REPLIED" &&
              Boolean(
                review.adminReply,
              )) ||
            (replyFilter ===
              "PENDING" &&
              !review.adminReply);

          return (
            matchesRating &&
            matchesVisibility &&
            matchesReply
          );
        },
      );
    }, [
      reviews,
      ratingFilter,
      visibilityFilter,
      replyFilter,
    ]);

  const statistics = useMemo(
    () => ({
      total: reviews.length,

      pending: reviews.filter(
        (review) =>
          !review.adminReply,
      ).length,

      replied: reviews.filter(
        (review) =>
          Boolean(
            review.adminReply,
          ),
      ).length,

      hidden: reviews.filter(
        (review) =>
          !review.isVisible,
      ).length,
    }),
    [reviews],
  );

  function formatDate(
    value: string,
  ) {
    return new Intl.DateTimeFormat(
      "vi-VN",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(new Date(value));
  }

  function openReplyModal(
    review: AdminOrderReview,
  ) {
    setReplyingReview(review);

    setReply(
      review.adminReply ?? "",
    );
  }

  function closeReplyModal() {
    if (updatingId !== null) {
      return;
    }

    setReplyingReview(null);
    setReply("");
  }

  async function handleSaveReply() {
    if (!replyingReview) {
      return;
    }

    const normalizedReply =
      reply.trim();

    if (
      normalizedReply.length < 2
    ) {
      showToast(
        "Phản hồi phải có ít nhất 2 ký tự.",
        "error",
      );

      return;
    }

    try {
      setUpdatingId(
        replyingReview.id,
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
        await replyToReview(
          accessToken,
          replyingReview.id,
          normalizedReply,
        );

      // Chỉ cập nhật đánh giá vừa phản hồi để tránh tải lại cả trang.
      setReviews((current) =>
        current.map((review) =>
          review.id ===
          replyingReview.id
            ? {
                ...review,

                adminReply:
                  updated.adminReply,

                adminRepliedById:
                  updated.adminRepliedById,

                adminRepliedAt:
                  updated.adminRepliedAt,

                adminRepliedBy:
                  updated.adminRepliedBy,

                updatedAt:
                  updated.updatedAt,
              }
            : review,
        ),
      );

      showToast(
        replyingReview.adminReply
          ? "Đã cập nhật phản hồi."
          : "Đã gửi phản hồi cho khách hàng.",
        "success",
      );

      setReplyingReview(null);
      setReply("");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể gửi phản hồi",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleVisibility(
    review: AdminOrderReview,
  ) {
    try {
      setUpdatingId(review.id);

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
        await updateReviewVisibility(
          accessToken,
          review.id,
          !review.isVisible,
        );

      setReviews((current) =>
        current.map((item) =>
          item.id === review.id
            ? {
                ...item,

                isVisible:
                  updated.isVisible,

                updatedAt:
                  updated.updatedAt,
              }
            : item,
        ),
      );

      showToast(
        updated.isVisible
          ? "Đã hiển thị lại đánh giá."
          : "Đã ẩn đánh giá.",
        "success",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật đánh giá",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeleteReply() {
    if (!deletingReview) {
      return;
    }

    try {
      setUpdatingId(
        deletingReview.id,
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
        await removeReviewReply(
          accessToken,
          deletingReview.id,
        );

      setReviews((current) =>
        current.map((review) =>
          review.id ===
          deletingReview.id
            ? {
                ...review,

                adminReply: null,

                adminRepliedById:
                  null,

                adminRepliedAt:
                  null,

                adminRepliedBy:
                  null,

                updatedAt:
                  updated.updatedAt,
              }
            : review,
        ),
      );

      showToast(
        "Đã xóa phản hồi của cửa hàng.",
        "success",
      );

      setDeletingReview(null);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể xóa phản hồi",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-[#1F1B18]">
          Quản lý đánh giá
        </h2>

        <p className="mt-1 text-[#78866B]">
          Theo dõi và phản hồi đánh giá của khách hàng.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Tổng đánh giá", statistics.total],
          ["Chờ phản hồi", statistics.pending],
          ["Đã phản hồi", statistics.replied],
          ["Đang bị ẩn", statistics.hidden],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-[#78866B]">
              {label}
            </p>

            <p className="mt-2 text-3xl font-bold text-[#4A2C20]">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_180px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Tìm khách hàng, email, nội dung hoặc mã đơn..."
              className="h-11 w-full rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] pl-10 pr-4 text-sm outline-none focus:border-[#C9894B]"
            />
          </div>

          <select
            value={ratingFilter}
            onChange={(event) =>
              setRatingFilter(
                event.target
                  .value as RatingFilter,
              )
            }
            className="h-11 rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
          >
            <option value="ALL">
              Tất cả số sao
            </option>

            {[5, 4, 3, 2, 1].map(
              (rating) => (
                <option
                  key={rating}
                  value={rating}
                >
                  {rating} sao
                </option>
              ),
            )}
          </select>

          <select
            value={
              visibilityFilter
            }
            onChange={(event) =>
              setVisibilityFilter(
                event.target
                  .value as VisibilityFilter,
              )
            }
            className="h-11 rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
          >
            <option value="ALL">
              Tất cả hiển thị
            </option>

            <option value="VISIBLE">
              Đang hiển thị
            </option>

            <option value="HIDDEN">
              Đang bị ẩn
            </option>
          </select>

          <select
            value={replyFilter}
            onChange={(event) =>
              setReplyFilter(
                event.target
                  .value as ReplyFilter,
              )
            }
            className="h-11 rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
          >
            <option value="ALL">
              Tất cả phản hồi
            </option>

            <option value="PENDING">
              Chưa phản hồi
            </option>

            <option value="REPLIED">
              Đã phản hồi
            </option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-8 text-sm text-[#78866B]">
          Đang tải đánh giá...
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="rounded-2xl border border-[#E9E1D8] bg-white p-10 text-center text-sm text-[#78866B]">
          Không tìm thấy đánh giá phù hợp.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map(
            (review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[#1F1B18]">
                        {review.user
                          .fullName ||
                          "Khách hàng"}
                      </p>

                      <span className="text-sm text-[#8A817B]">
                        {
                          review.user
                            .email
                        }
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          review.isVisible
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {review.isVisible
                          ? "Đang hiển thị"
                          : "Đã ẩn"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[#8A817B]">
                      Đơn #
                      {review.orderId}
                      {" · "}
                      {formatDate(
                        review.createdAt,
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: 5 },
                      (_, index) => (
                        <Star
                          key={index}
                          size={18}
                          className={
                            index <
                            review.overallRating
                              ? "fill-[#E9A23B] text-[#E9A23B]"
                              : "text-[#D8CEC5]"
                          }
                        />
                      ),
                    )}
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#4A423D]">
                  {review.comment ||
                    "Khách hàng không để lại nhận xét."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {review.productReviews.map(
                    (item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-[#FAF4ED] px-3 py-1.5 text-xs text-[#6D4A38]"
                      >
                        {
                          item.product
                            .name
                        }
                        {" · Size "}
                        {
                          item.orderItem
                            .size
                        }
                        {" · "}
                        {item.rating} sao
                      </span>
                    ),
                  )}
                </div>

                {review.adminReply && (
                  <div className="mt-5 rounded-xl border border-[#F0D9C1] bg-[#FFF9F2] p-4">
                    <p className="text-sm font-bold text-[#4A2C20]">
                      Phản hồi từ Kippora
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5E5650]">
                      {
                        review.adminReply
                      }
                    </p>

                    <p className="mt-2 text-xs text-[#9B8E84]">
                      {review
                        .adminRepliedBy
                        ?.fullName ||
                        "Quản trị viên"}

                      {review.adminRepliedAt
                        ? ` · ${formatDate(
                            review.adminRepliedAt,
                          )}`
                        : ""}
                    </p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#F0E8E0] pt-4">
                  <button
                    type="button"
                    disabled={
                      updatingId ===
                      review.id
                    }
                    onClick={() =>
                      openReplyModal(
                        review,
                      )
                    }
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
                  >
                    <MessageSquareReply
                      size={17}
                    />

                    {review.adminReply
                      ? "Sửa phản hồi"
                      : "Phản hồi"}
                  </button>

                  {review.adminReply && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeletingReview(
                          review,
                        )
                      }
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600"
                    >
                      <Trash2
                        size={17}
                      />

                      Xóa phản hồi
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={
                      updatingId ===
                      review.id
                    }
                    onClick={() =>
                      void handleVisibility(
                        review,
                      )
                    }
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E9E1D8] px-4 py-2 text-sm font-semibold text-[#5E5650] disabled:cursor-wait disabled:opacity-50"
                  >
                    {review.isVisible ? (
                      <EyeOff
                        size={17}
                      />
                    ) : (
                      <Eye
                        size={17}
                      />
                    )}

                    {review.isVisible
                      ? "Ẩn đánh giá"
                      : "Hiện đánh giá"}
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      )}

      {replyingReview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#1F1B18]">
                {replyingReview.adminReply
                  ? "Sửa phản hồi"
                  : "Phản hồi đánh giá"}
              </h3>

              <button
                type="button"
                onClick={
                  closeReplyModal
                }
                className="cursor-pointer rounded-lg p-2 text-[#8A817B] hover:bg-[#FAF8F5]"
              >
                <X size={20} />
              </button>
            </div>

            <textarea
              rows={6}
              maxLength={1000}
              value={reply}
              onChange={(event) =>
                setReply(
                  event.target.value,
                )
              }
              placeholder="Nhập phản hồi chính thức của cửa hàng..."
              className="mt-5 w-full resize-none rounded-xl border border-[#E9E1D8] p-4 text-sm outline-none focus:border-[#C9894B]"
            />

            <div className="mt-2 text-right text-xs text-[#8A817B]">
              {reply.length}/1000
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={
                  closeReplyModal
                }
                className="cursor-pointer rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-semibold"
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
                  void handleSaveReply()
                }
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4A2C20] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
              >
                <Send size={17} />
                Lưu phản hồi
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingReview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <Trash2
              size={30}
              className="mx-auto text-red-500"
            />

            <h3 className="mt-4 text-xl font-bold">
              Xóa phản hồi?
            </h3>

            <p className="mt-2 text-sm text-[#78866B]">
              Đánh giá của khách vẫn được giữ nguyên.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setDeletingReview(
                    null,
                  )
                }
                className="cursor-pointer rounded-xl border border-[#E9E1D8] px-4 py-2.5 text-sm font-semibold"
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
                  void handleDeleteReply()
                }
                className="cursor-pointer rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
              >
                Xóa phản hồi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}