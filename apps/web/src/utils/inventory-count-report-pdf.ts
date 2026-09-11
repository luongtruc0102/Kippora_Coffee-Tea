import { jsPDF } from "jspdf";

import type {
  InventoryCount,
  InventoryCountStatus,
  InventoryVarianceReason,
} from "@/types/inventory";

const FONT_NAME = "KipporaInventoryCount";
const FONT_FILE = "DejaVuSans.ttf";
let fontPromise: Promise<string> | undefined;

const statusLabels: Record<InventoryCountStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ Admin duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

const reasonLabels: Record<InventoryVarianceReason, string> = {
  BREAKAGE: "Đổ vỡ",
  SPOILAGE: "Hư hỏng",
  EXPIRED: "Hết hạn",
  LOSS: "Thất thoát",
  COUNTING_ERROR: "Sai lệch lần đếm trước",
  OTHER: "Khác",
};

const unitLabels = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

function clean(value: string) {
  return value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ");
}

function quantity(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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
      ) {
        throw new Error("Font báo cáo không hợp lệ.");
      }
      let binary = "";
      for (let start = 0; start < bytes.length; start += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
      }
      return btoa(binary);
    })().catch((error: unknown) => {
      fontPromise = undefined;
      throw error;
    });
  }
  return fontPromise;
}

function setupDocument(doc: jsPDF, font: string) {
  doc.addFileToVFS(FONT_FILE, font);
  doc.addFont(FONT_FILE, FONT_NAME, "normal");
  doc.setFont(FONT_NAME);
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
) {
  const lines = doc.splitTextToSize(clean(text), width) as string[];
  doc.text(lines, x, y);
  return y + Math.max(1, lines.length) * lineHeight;
}

export function buildInventoryCountPdf(count: InventoryCount, font: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  setupDocument(doc, font);
  doc.setProperties({
    title: `Phiếu kiểm kê ${count.code}`,
    subject: `${count.branch.code} - ${count.branch.name}`,
    author: "Kippora",
  });

  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let page = 1;
  let y = 0;

  function footer() {
    doc.setFontSize(7);
    doc.setTextColor("#8A817B");
    doc.text(`Kippora · ${count.code}`, margin, pageHeight - 7);
    doc.text(`Trang ${page}`, pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }

  function header(continued = false) {
    doc.setTextColor("#4A2C20");
    doc.setFontSize(18);
    doc.text("KIPPORA", margin, 16);
    doc.setFontSize(12);
    doc.text(
      continued ? "PHIẾU KIỂM KÊ (tiếp)" : "PHIẾU KIỂM KÊ KHO",
      pageWidth - margin,
      16,
      {
        align: "right",
      },
    );
    doc.setDrawColor("#C9894B");
    doc.setLineWidth(0.5);
    doc.line(margin, 22, pageWidth - margin, 22);
    y = 30;
  }

  function newPage() {
    footer();
    doc.addPage("a4", "portrait");
    setupDocument(doc, font);
    page += 1;
    header(true);
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - 16) newPage();
  }

  header();
  doc.setFontSize(11);
  doc.setTextColor("#2A211D");
  doc.text(clean(count.code), margin, y);
  doc.setTextColor("#756C64");
  doc.text(clean(statusLabels[count.status]), pageWidth - margin, y, {
    align: "right",
  });
  y += 7;
  doc.setFontSize(8.5);
  y = writeWrapped(
    doc,
    `${count.branch.code} · ${count.branch.name} | Kiểm lúc ${formatDate(count.countedAt)}`,
    margin,
    y,
    contentWidth,
    4.5,
  );
  y = writeWrapped(
    doc,
    `Người lập: ${count.createdBy.fullName || count.createdBy.email}`,
    margin,
    y,
    contentWidth,
    4.5,
  );
  if (count.note) {
    y = writeWrapped(
      doc,
      `Ghi chú: ${count.note}`,
      margin,
      y,
      contentWidth,
      4.5,
    );
  }
  if (count.reviewNote) {
    y = writeWrapped(
      doc,
      `Phản hồi Admin: ${count.reviewNote}`,
      margin,
      y,
      contentWidth,
      4.5,
    );
  }
  y += 3;

  count.items.forEach((item, index) => {
    const unit = unitLabels[item.ingredient.unit];
    const reason = item.reason ? reasonLabels[item.reason] : "Khớp số liệu";
    const difference = `${item.differenceQuantity > 0 ? "+" : ""}${quantity(item.differenceQuantity)} ${unit}`;
    const noteLines = doc.splitTextToSize(
      clean(`${reason}${item.note ? ` · ${item.note}` : ""}`),
      contentWidth - 8,
    ) as string[];
    const rowHeight = 17 + Math.max(0, noteLines.length - 1) * 4;
    ensureSpace(rowHeight);

    doc.setFillColor(index % 2 === 0 ? "#FAF6F1" : "#FFFFFF");
    doc.roundedRect(margin, y, contentWidth, rowHeight - 2, 1.5, 1.5, "F");
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
        `Hệ thống: ${quantity(item.expectedQuantity)} ${unit}  ·  Thực tế: ${quantity(item.countedQuantity)} ${unit}`,
      ),
      margin + 4,
      y + 10.5,
    );
    doc.setTextColor(
      item.differenceQuantity < -0.0005
        ? "#B13C3C"
        : item.differenceQuantity > 0.0005
          ? "#22754A"
          : "#756C64",
    );
    doc.text(clean(difference), pageWidth - margin - 4, y + 5.5, {
      align: "right",
    });
    doc.setTextColor("#756C64");
    doc.text(noteLines, margin + 4, y + 15);
    y += rowHeight;
  });

  ensureSpace(20);
  const shortage = count.items.filter(
    (item) => item.differenceQuantity < -0.0005,
  ).length;
  const surplus = count.items.filter(
    (item) => item.differenceQuantity > 0.0005,
  ).length;
  doc.setDrawColor("#DCCBBB");
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor("#4A2C20");
  doc.text(
    clean(
      `Tổng ${count.items.length} nguyên liệu · Thiếu ${shortage} · Dư ${surplus} · Khớp ${count.items.length - shortage - surplus}`,
    ),
    margin,
    y,
  );
  if (count.status !== "APPROVED") {
    y += 6;
    doc.setFontSize(7.5);
    doc.setTextColor("#8A817B");
    doc.text("Phiếu chưa được duyệt nên chưa làm thay đổi tồn kho.", margin, y);
  }
  footer();
  return doc;
}

export async function downloadInventoryCountPdf(count: InventoryCount) {
  const font = await loadFont();
  await buildInventoryCountPdf(count, font).save(
    `kippora-kiem-ke_${count.code}.pdf`,
    { returnPromise: true },
  );
}
