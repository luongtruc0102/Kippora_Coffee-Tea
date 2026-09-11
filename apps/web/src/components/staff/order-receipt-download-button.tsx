"use client";

import { Download, LoaderCircle, ReceiptText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import OrderReceiptContent from "@/components/staff/order-receipt-content";
import { useAppToast } from "@/components/ui/app-toast-provider";
import type { Order } from "@/types/order";

type Props = {
  order: Order;
};

export default function OrderReceiptDownloadButton({ order }: Props) {
  const { showToast } = useAppToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exporting) setPreviewOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [exporting, previewOpen]);

  async function downloadPdf() {
    const receipt = receiptRef.current;
    if (!receipt || exporting) return;

    let exportReceipt: HTMLDivElement | null = null;
    let exportMask: HTMLDivElement | null = null;

    try {
      setExporting(true);
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      // Giữ nguyên đúng chiều rộng của bill đang xem trước để cách xuống dòng,
      // khoảng cách và tỷ lệ chữ trong PDF không khác giao diện modal.
      const previewWidth = Math.max(
        receipt.getBoundingClientRect().width,
        receipt.scrollWidth,
        1,
      );
      exportReceipt = receipt.cloneNode(true) as HTMLDivElement;
      exportReceipt.removeAttribute("aria-hidden");
      Object.assign(exportReceipt.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${previewWidth}px`,
        height: "auto",
        maxHeight: "none",
        overflow: "visible",
        transform: "none",
        visibility: "visible",
        zIndex: "2147483646",
        pointerEvents: "none",
      });

      exportMask = document.createElement("div");
      exportMask.textContent = "Đang tạo hóa đơn...";
      Object.assign(exportMask.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#faf8f5",
        color: "#4a2c20",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "wait",
      });
      document.body.append(exportReceipt, exportMask);

      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );

      const exportWidth = Math.max(exportReceipt.scrollWidth, 1);
      const canvas = await html2canvas(exportReceipt, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: Math.max(exportWidth, 1024),
        scrollX: 0,
        scrollY: 0,
      });

      const pageWidthMm = 80;
      const marginMm = 5;
      const imageWidthMm = pageWidthMm - marginMm * 2;
      const imageHeightMm = (canvas.height / canvas.width) * imageWidthMm;
      const pageHeightMm = Math.max(
        80,
        Math.ceil(imageHeightMm + marginMm * 2),
      );
      const pdf = new jsPDF({
        unit: "mm",
        format: [pageWidthMm, pageHeightMm],
        orientation: "portrait",
        compress: true,
      });

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.98),
        "JPEG",
        marginMm,
        marginMm,
        imageWidthMm,
        imageHeightMm,
        undefined,
        "FAST",
      );
      pdf.save(`kippora-hoa-don-${order.id}.pdf`);
      showToast(`Đã tải hóa đơn #${order.id}`, "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể tạo file hóa đơn PDF",
        "error",
      );
    } finally {
      exportReceipt?.remove();
      exportMask?.remove();
      setExporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#C9894B] bg-[#FCF4EA] px-4 py-2.5 text-sm font-semibold text-[#9A5C2F]"
      >
        <ReceiptText size={16} />
        Xem hóa đơn
      </button>

      {previewOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !exporting) {
                setPreviewOpen(false);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`receipt-preview-title-${order.id}`}
              className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F0E8E0] bg-white px-5 py-4">
                <div className="flex items-center gap-2">
                  <ReceiptText size={20} className="text-[#C9894B]" />
                  <h2
                    id={`receipt-preview-title-${order.id}`}
                    className="font-bold text-[#2A211D]"
                  >
                    Xem trước hóa đơn #{order.id}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => setPreviewOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F2EC] text-[#5E5650] disabled:cursor-wait disabled:opacity-50"
                  aria-label="Đóng xem trước hóa đơn"
                >
                  <X size={18} />
                </button>
              </div>

              <OrderReceiptContent ref={receiptRef} order={order} />

              <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-[#F0E8E0] bg-white p-5">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void downloadPdf()}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {exporting ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Download size={17} />
                  )}
                  {exporting ? "Đang tạo PDF" : "Tải PDF"}
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => setPreviewOpen(false)}
                  className="flex h-11 items-center justify-center rounded-xl border border-[#E9E1D8] font-semibold text-[#5E5650] disabled:cursor-wait disabled:opacity-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
