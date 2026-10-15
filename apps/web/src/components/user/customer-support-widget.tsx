"use client";

import {
  ExternalLink,
  LoaderCircle,
  MessageCircleMore,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  getMySupportConversation,
  getMySupportUnreadCount,
  sendMySupportMessage,
} from "@/services/support.service";
import type { SupportConversation } from "@/types/support";
import {
  AUTH_USER_UPDATED_EVENT,
  type StoredAuthUser,
} from "@/utils/auth.util";

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

function readStoredUser() {
  const raw = sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuthUser;
  } catch {
    return null;
  }
}

function readSelectedBranchId() {
  const value = Number(sessionStorage.getItem("checkoutBranchId"));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export default function CustomerSupportWidget() {
  const pathname = usePathname();
  const { showToast } = useAppToast();
  const [user, setUser] = useState<StoredAuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setUser(readStoredUser()), 0);
    const handleUserUpdated = (event: Event) => {
      setUser((event as CustomEvent<StoredAuthUser>).detail);
    };
    const handleFocus = () => setUser(readStoredUser());
    window.addEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleUserUpdated);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!user || open) return;

    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;

    let active = true;
    const controller = new AbortController();
    const loadUnreadCount = async () => {
      try {
        const result = await getMySupportUnreadCount(
          accessToken,
          controller.signal,
        );
        if (active) setUnreadCount(result.unreadCount);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    };

    const timeoutId = window.setTimeout(() => void loadUnreadCount(), 0);
    const intervalId = window.setInterval(
      () => void loadUnreadCount(),
      8_000,
    );
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;

    let active = true;
    const controller = new AbortController();
    const load = async (initial = false) => {
      try {
        if (initial) setLoading(true);
        const result = await getMySupportConversation(
          accessToken,
          controller.signal,
          { branchId: readSelectedBranchId() },
        );
        if (active) {
          setConversation(result);
          setUnreadCount(0);
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

    const timeoutId = window.setTimeout(() => void load(true), 0);
    const intervalId = window.setInterval(() => void load(), 8_000);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [open, showToast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length, open]);

  async function sendMessage() {
    const message = content.trim();
    const accessToken = sessionStorage.getItem("accessToken");
    if (!message || !accessToken || sending) return;
    try {
      setSending(true);
      const updated = await sendMySupportMessage(accessToken, message, {
        branchId: conversation?.branch.id ?? readSelectedBranchId(),
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

  function toggleChat() {
    if (!open) setUnreadCount(0);
    setOpen((current) => !current);
  }

  if (!user || pathname.startsWith("/ho-tro")) return null;

  return (
    <>
      {open && (
        <section className="fixed bottom-20 right-4 z-[1200] flex h-[min(560px,calc(100vh-104px))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-[24px] border border-[#E4D8CC] bg-white shadow-[0_22px_65px_rgba(74,44,32,0.24)] sm:right-5">
          <header className="flex items-center justify-between bg-[#4A2C20] px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                <MessageCircleMore size={21} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold">Kippora CSKH</h2>
                <p className="mt-0.5 truncate text-[11px] text-white/70">
                  {conversation
                    ? `${statusLabel[conversation.status]} · ${conversation.branch.name}`
                    : "Sẵn sàng hỗ trợ bạn"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Đóng khung chat"
            >
              <X size={19} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#FCFAF7] px-3.5 py-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[#78866B]">
                <LoaderCircle className="mr-2 animate-spin" size={18} />
                Đang tải tin nhắn...
              </div>
            ) : !conversation?.messages.length ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3E9DE] text-[#A86632]">
                  <MessageCircleMore size={27} />
                </span>
                <h3 className="mt-4 text-base font-bold text-[#2A211D]">
                  Kippora có thể giúp gì cho bạn?
                </h3>
                <p className="mt-2 text-xs leading-5 text-[#78866B]">
                  Hãy gửi nội dung cần hỗ trợ và mã đơn hàng nếu có nhé.
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
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        mine
                          ? "rounded-br-md bg-[#4A2C20] text-white"
                          : "rounded-bl-md border border-[#E9E1D8] bg-white text-[#2A211D]"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-1 text-[11px] font-bold text-[#C1783D]">
                          Kippora
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-xs leading-5">
                        {message.content}
                      </p>
                      <p
                        className={`mt-1 text-[10px] ${mine ? "text-white/55" : "text-[#A0968F]"}`}
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

          <div className="border-t border-[#E9E1D8] bg-white p-3.5">
            <div className="flex items-end gap-2">
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
                placeholder="Nhập tin nhắn..."
                className="min-h-[46px] flex-1 resize-none rounded-2xl border border-[#E9E1D8] px-3.5 py-2.5 text-xs leading-5 outline-none focus:border-[#C9894B]"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!content.trim() || sending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C1783D] text-white transition hover:bg-[#A86632] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Gửi tin nhắn"
              >
                {sending ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <Link
              href="/ho-tro"
              onClick={() => setOpen(false)}
              className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#8A5A35] hover:text-[#4A2C20]"
            >
              Mở trang hỗ trợ đầy đủ <ExternalLink size={12} />
            </Link>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={toggleChat}
        className="fixed bottom-5 right-5 z-[1200] flex h-14 w-14 items-center justify-center rounded-full bg-[#4A2C20] text-white shadow-[0_10px_30px_rgba(74,44,32,0.35)] transition hover:-translate-y-0.5 hover:bg-[#5D382A] focus:outline-none focus:ring-4 focus:ring-[#E8D5C4]"
        aria-label={
          open
            ? "Đóng hỗ trợ trực tuyến"
            : unreadCount > 0
              ? `Mở hỗ trợ trực tuyến, có ${unreadCount} tin nhắn mới`
              : "Mở hỗ trợ trực tuyến"
        }
        title="Chat với Kippora"
      >
        {open ? <X size={23} /> : <MessageCircleMore size={25} />}
        {!open && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
