"use client";

import {
  CheckCircle2,
  Copy,
  LoaderCircle,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBankTransferInstruction } from "@/services/bank-reconciliation.service";
import type { BankTransferInstruction } from "@/types/bank-reconciliation";
import type { PaymentStatus } from "@/types/order";

type Props = {
  target: { orderId: number } | { paymentId: number };
  initialStatus: PaymentStatus;
  onPaid?: () => void;
  compact?: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

export default function BankTransferPanel({
  target,
  initialStatus,
  onPaid,
  compact,
}: Props) {
  const orderId = "orderId" in target ? target.orderId : undefined;
  const paymentId = "paymentId" in target ? target.paymentId : undefined;
  const [instruction, setInstruction] =
    useState<BankTransferInstruction | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [status, setStatus] = useState<PaymentStatus>(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const paidNotified = useRef(initialStatus === "PAID");

  const load = useCallback(async () => {
    try {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      const queryTarget = orderId ? { orderId } : { paymentId: paymentId! };
      const data = await getBankTransferInstruction(accessToken, queryTarget);
      setInstruction(data);
      setStatus(data.status);
      setError("");
      if (data.status !== "PAID") {
        const { toDataURL } = await import("qrcode");
        setQrDataUrl(
          await toDataURL(data.qrPayload, {
            width: 260,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#2A211D", light: "#FFFFFF" },
          }),
        );
      }
      if (data.status === "PAID" && !paidNotified.current) {
        paidNotified.current = true;
        onPaid?.();
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Không thể tải mã QR",
      );
    } finally {
      setLoading(false);
    }
  }, [onPaid, orderId, paymentId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    if (status === "PAID") {
      return () => window.clearTimeout(timeoutId);
    }
    const interval = window.setInterval(() => void load(), 5000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(interval);
    };
  }, [load, status]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  }

  if (status === "PAID") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={34} />
        <p className="mt-2 font-bold text-emerald-800">Đã nhận chuyển khoản</p>
        <p className="mt-1 text-sm text-emerald-700">
          Giao dịch đã được hệ thống đối soát với đúng đơn hàng.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E9E1D8] p-6 text-sm text-[#78866B]">
        <LoaderCircle className="animate-spin" size={18} /> Đang tạo VietQR...
      </div>
    );
  }

  if (error || !instruction) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        <p>{error || "Chưa thể tạo mã QR."}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 font-semibold"
        >
          <RefreshCw size={16} /> Thử lại
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#E7D5C5] bg-[#FFF9F2] p-5">
      <div
        className={`grid items-center gap-5 ${compact ? "" : "sm:grid-cols-[220px_1fr]"}`}
      >
        <div className="mx-auto overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white p-2 shadow-sm">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`VietQR cho đơn ${instruction.orderId}`}
              width={220}
              height={220}
              className="h-auto w-[220px]"
            />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center">
              <LoaderCircle className="animate-spin text-[#C9894B]" />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 text-[#9A5C2F]">
            <QrCode size={20} />
            <h3 className="font-bold">Quét mã để thanh toán</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#6E625B]">
            Hệ thống tự xác nhận khi nhận đúng số tiền và nội dung. Không cần
            gửi ảnh chuyển khoản.
          </p>
          <div className="mt-4 space-y-2.5 text-sm">
            <Row
              label="Ngân hàng"
              value={`${instruction.bankAccount.bankCode} · ${instruction.bankAccount.bankName}`}
            />
            <Row
              label="Số tài khoản"
              value={instruction.bankAccount.accountNumber}
              onCopy={() =>
                void copy(instruction.bankAccount.accountNumber, "account")
              }
              copied={copied === "account"}
            />
            <Row
              label="Chủ tài khoản"
              value={instruction.bankAccount.accountName}
            />
            <Row label="Số tiền" value={money(instruction.amount)} strong />
            <Row
              label="Nội dung"
              value={instruction.referenceCode}
              strong
              onCopy={() => void copy(instruction.referenceCode, "reference")}
              copied={copied === "reference"}
            />
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-[#8A817B]">
            <LoaderCircle size={14} className="animate-spin" /> Đang tự kiểm tra
            thanh toán mỗi 5 giây
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  strong?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F0E5DA] pb-2 last:border-0">
      <span className="shrink-0 text-[#8A817B]">{label}</span>
      <span
        className={`flex min-w-0 items-center gap-2 text-right ${
          strong ? "font-bold text-[#4A2C20]" : "font-semibold text-[#2A211D]"
        }`}
      >
        <span className="break-all">{value}</span>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            title={copied ? "Đã sao chép" : "Sao chép"}
            className="shrink-0 text-[#C9894B]"
          >
            <Copy size={15} />
          </button>
        ) : null}
      </span>
    </div>
  );
}
