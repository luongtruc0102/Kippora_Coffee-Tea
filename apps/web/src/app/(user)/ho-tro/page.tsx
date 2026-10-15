"use client";

import {
  Building2,
  Headphones,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  getMySupportConversation,
  sendMySupportMessage,
} from "@/services/support.service";
import { getPublicStoreLocations } from "@/services/store-settings.service";
import type { SupportConversation } from "@/types/support";
import type { PublicStoreLocation } from "@/types/store-settings";

const statusLabel = {
  OPEN: "Đang chờ hỗ trợ",
  WAITING_CUSTOMER: "Kippora đã phản hồi",
  RESOLVED: "Đã giải quyết",
} as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export default function CustomerSupportPage() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const [branches, setBranches] = useState<PublicStoreLocation[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const storedBranchId = Number(
        sessionStorage.getItem("checkoutBranchId"),
      );
      if (Number.isInteger(storedBranchId) && storedBranchId > 0) {
        setSelectedBranchId(storedBranchId);
      }
    }, 0);
    void getPublicStoreLocations(controller.signal)
      .then(setBranches)
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
      });
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let active = true;
    const controller = new AbortController();
    const load = async (initial = false) => {
      try {
        if (initial) setLoading(true);
        const data = await getMySupportConversation(
          accessToken,
          controller.signal,
          selectedBranchId ? { branchId: selectedBranchId } : undefined,
        );
        if (active) {
          setConversation(data);
          if (!selectedBranchId && data?.branch.id) {
            setSelectedBranchId(data.branch.id);
            sessionStorage.setItem(
              "checkoutBranchId",
              String(data.branch.id),
            );
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (active && initial) {
          showToast(
            error instanceof Error
              ? error.message
              : "Không thể tải hội thoại hỗ trợ",
            "error",
          );
        }
      } finally {
        if (active && initial) setLoading(false);
      }
    };

    void load(true);
    const intervalId = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [router, selectedBranchId, showToast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  async function sendMessage() {
    const message = content.trim();
    const accessToken = sessionStorage.getItem("accessToken");
    if (!message || !accessToken || sending) return;

    try {
      setSending(true);
      const updated = await sendMySupportMessage(accessToken, message, {
        branchId: selectedBranchId || conversation?.branch.id,
      });
      setConversation(updated);
      setContent("");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể gửi tin nhắn",
        "error",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <section className="overflow-hidden rounded-[28px] border border-[#E9E1D8] bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-[#E9E1D8] bg-[#FFF9F2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3E9DE] text-[#A86632]">
              <Headphones size={24} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#2A211D]">
                Kippora hỗ trợ bạn
              </h1>
              <p className="mt-1 text-sm text-[#78866B]">
                Gửi câu hỏi về đơn hàng, thanh toán hoặc tài khoản.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Building2
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A86632]"
              />
              <select
                value={selectedBranchId || conversation?.branch.id || ""}
                onChange={(event) => {
                  const branchId = Number(event.target.value);
                  setSelectedBranchId(branchId);
                  setConversation(null);
                  sessionStorage.setItem(
                    "checkoutBranchId",
                    String(branchId),
                  );
                }}
                className="h-10 max-w-[260px] rounded-xl border border-[#E4D8CC] bg-white pl-9 pr-3 text-xs font-semibold text-[#5E5650] outline-none focus:border-[#C9894B]"
                aria-label="Chọn chi nhánh hỗ trợ"
              >
                {!selectedBranchId && !conversation && (
                  <option value="">Tự động chọn chi nhánh</option>
                )}
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            </label>
            {conversation && (
              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#8A5A35] shadow-sm">
                {statusLabel[conversation.status]}
                {conversation.relatedOrder
                  ? ` · Đơn #${conversation.relatedOrder.id}`
                  : ""}
              </span>
            )}
          </div>
        </header>

        <div className="flex h-[520px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#FCFAF7] px-4 py-5 sm:px-7">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[#78866B]">
                <LoaderCircle className="mr-2 animate-spin" size={20} />
                Đang tải hội thoại...
              </div>
            ) : !conversation?.messages.length ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <ShieldCheck size={42} className="text-[#C9894B]" />
                <h2 className="mt-4 text-lg font-bold text-[#2A211D]">
                  Bạn cần Kippora hỗ trợ gì?
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#78866B]">
                  Hãy mô tả rõ vấn đề và kèm mã đơn nếu có. Tin nhắn sẽ được lưu
                  để bạn theo dõi phản hồi ở lần đăng nhập sau.
                </p>
              </div>
            ) : (
              conversation.messages.map((message) => {
                const mine = message.senderType === "CUSTOMER";
                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[70%] ${
                        mine
                          ? "rounded-br-md bg-[#4A2C20] text-white"
                          : "rounded-bl-md border border-[#E9E1D8] bg-white text-[#2A211D]"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-1 text-xs font-bold text-[#C1783D]">
                          Kippora CSKH
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {message.content}
                      </p>
                      <p
                        className={`mt-1.5 text-[11px] ${mine ? "text-white/60" : "text-[#A0968F]"}`}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[#E9E1D8] bg-white p-4 sm:p-5">
            <div className="flex items-end gap-3">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                maxLength={2000}
                rows={2}
                placeholder="Nhập nội dung cần hỗ trợ..."
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!content.trim() || sending}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#4A2C20] text-white transition hover:bg-[#5D382A] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Gửi tin nhắn"
              >
                {sending ? (
                  <LoaderCircle className="animate-spin" size={20} />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#A0968F]">
              Enter để gửi · Shift + Enter để xuống dòng
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
