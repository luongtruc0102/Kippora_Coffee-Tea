import { jsPDF } from "jspdf";

import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/inventory";

const FONT_NAME = "KipporaPurchaseOrder";
const FONT_FILE = "DejaVuSans.ttf";
let fontPromise: Promise<string> | undefined;

const statuses: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt",
  ORDERED: "Đã đặt nhà cung cấp",
  PARTIALLY_RECEIVED: "Đã nhận một phần",
  COMPLETED: "Đã nhận đủ",
  REJECTED: "Cần chỉnh lại",
  CANCELLED: "Đã hủy",
};
const units = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

function clean(value: string) {
  return value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ");
}

function number(value: number, digits = 3) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: digits,
  }).format(value);
}

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}

async function loadFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      const response = await fetch("/fonts/DejaVuSans.ttf");
      if (!response.ok) throw new Error("Không thể tải font báo cáo.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        bytes.length < 12 ||
        bytes[0] !== 0 ||
        bytes[1] !== 1 ||
        bytes[2] !== 0 ||
        bytes[3] !== 0
      )
        throw new Error("Font báo cáo không hợp lệ.");
      let binary = "";
      for (let start = 0; start < bytes.length; start += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
      return btoa(binary);
    })().catch((error: unknown) => {
      fontPromise = undefined;
      throw error;
    });
  }
  return fontPromise;
}

function setup(doc: jsPDF, font: string) {
  doc.addFileToVFS(FONT_FILE, font);
  doc.addFont(FONT_FILE, FONT_NAME, "normal");
  doc.setFont(FONT_NAME);
}

function wrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 4.5,
) {
  const lines = doc.splitTextToSize(clean(text), width) as string[];
  doc.text(lines, x, y);
  return y + Math.max(1, lines.length) * lineHeight;
}

export function buildPurchaseOrderPdf(order: PurchaseOrder, font: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  setup(doc, font);
  doc.setProperties({
    title: `Đơn nhập hàng ${order.code}`,
    subject: `${order.branch.code} - ${order.supplier.name}`,
    author: "Kippora",
  });
  const margin = 12;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const content = width - margin * 2;
  let page = 1;
  let y = 0;

  function footer() {
    doc.setFontSize(7);
    doc.setTextColor("#8A817B");
    doc.text(`Kippora · ${order.code}`, margin, height - 7);
    doc.text(`Trang ${page}`, width - margin, height - 7, { align: "right" });
  }
  function header(continued = false) {
    doc.setTextColor("#4A2C20");
    doc.setFontSize(18);
    doc.text("KIPPORA", margin, 16);
    doc.setFontSize(11);
    doc.text(
      continued ? "ĐƠN NHẬP HÀNG (tiếp)" : "ĐƠN ĐẶT NHÀ CUNG CẤP",
      width - margin,
      16,
      { align: "right" },
    );
    doc.setDrawColor("#C9894B");
    doc.setLineWidth(0.5);
    doc.line(margin, 22, width - margin, 22);
    y = 30;
  }
  function newPage() {
    footer();
    doc.addPage("a4", "portrait");
    setup(doc, font);
    page += 1;
    header(true);
  }
  function ensure(space: number) {
    if (y + space > height - 16) newPage();
  }

  header();
  doc.setFontSize(11);
  doc.setTextColor("#2A211D");
  doc.text(clean(order.code), margin, y);
  doc.setTextColor("#756C64");
  doc.text(clean(statuses[order.status]), width - margin, y, {
    align: "right",
  });
  y += 7;
  doc.setFontSize(8.5);
  y = wrapped(
    doc,
    `${order.branch.code} · ${order.branch.name} | Nhà cung cấp: ${order.supplier.name}`,
    margin,
    y,
    content,
  );
  y = wrapped(
    doc,
    `Ngày dự kiến giao: ${date(order.expectedAt)} | Người lập: ${order.createdBy.fullName || order.createdBy.email}`,
    margin,
    y,
    content,
  );
  if (order.note)
    y = wrapped(doc, `Ghi chú: ${order.note}`, margin, y, content);
  if (order.reviewNote)
    y = wrapped(doc, `Phản hồi Admin: ${order.reviewNote}`, margin, y, content);
  y += 3;

  order.items.forEach((item, index) => {
    ensure(22);
    const unit = units[item.ingredient.unit];
    const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity);
    doc.setFillColor(index % 2 === 0 ? "#FAF6F1" : "#FFFFFF");
    doc.roundedRect(margin, y, content, 19, 1.5, 1.5, "F");
    doc.setFontSize(9);
    doc.setTextColor("#2A211D");
    doc.text(
      clean(`${index + 1}. ${item.ingredient.name}`),
      margin + 4,
      y + 5.5,
    );
    doc.setFontSize(8);
    doc.setTextColor("#6B625C");
    doc.text(
      clean(
        `Đề xuất ${number(item.suggestedQuantity)} · Đặt ${number(item.orderedQuantity)} · Nhận ${number(item.receivedQuantity)} · Còn ${number(remaining)} ${unit}`,
      ),
      margin + 4,
      y + 11,
    );
    doc.text(clean(`Đơn giá: ${money(item.unitCost)}`), margin + 4, y + 16);
    doc.setTextColor("#4A2C20");
    doc.text(clean(money(item.lineTotal)), width - margin - 4, y + 5.5, {
      align: "right",
    });
    y += 21;
  });

  ensure(24);
  doc.setDrawColor("#DCCBBB");
  doc.line(margin, y, width - margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor("#4A2C20");
  doc.text("TỔNG GIÁ TRỊ DỰ KIẾN", margin, y);
  doc.text(clean(money(order.totalCost)), width - margin, y, {
    align: "right",
  });
  y += 7;
  const completedItems = order.items.filter(
    (item) => item.receivedQuantity + 0.0005 >= item.orderedQuantity,
  ).length;
  doc.setFontSize(8);
  doc.setTextColor("#756C64");
  doc.text(
    clean(
      `Tiến độ nhận: ${completedItems} / ${order.items.length} nguyên liệu đã nhận đủ`,
    ),
    margin,
    y,
  );
  footer();
  return doc;
}

export async function downloadPurchaseOrderPdf(order: PurchaseOrder) {
  const font = await loadFont();
  await buildPurchaseOrderPdf(order, font).save(
    `kippora-don-nhap_${order.code}.pdf`,
    { returnPromise: true },
  );
}
