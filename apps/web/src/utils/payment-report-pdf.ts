import { jsPDF } from "jspdf";
import {
  getPaymentMethodLabel,
  hasInvalidPaymentDateRange,
  paymentMethodLabels,
  paymentStatusLabels,
  summarizePayments,
  type PaymentFilters,
  type PaymentReportSnapshot,
} from "./payment.util";

export type { PaymentReportSnapshot } from "./payment.util";

const FONT_NAME = "KipporaReport";
const FONT_FILE = "DejaVuSans.ttf";
let fontPromise: Promise<string> | undefined;

function cleanText(value: string) {
  return value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ");
}

function money(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function shortDate(value: string) {
  return value.split("-").reverse().join("/");
}

function rangeLabel(filters: PaymentFilters) {
  if (filters.dateFrom && filters.dateTo) {
    return filters.dateFrom === filters.dateTo
      ? `Ngày ${shortDate(filters.dateFrom)}`
      : `Từ ${shortDate(filters.dateFrom)} đến ${shortDate(filters.dateTo)}`;
  }
  if (filters.dateFrom) return `Từ ${shortDate(filters.dateFrom)}`;
  if (filters.dateTo) return `Đến ${shortDate(filters.dateTo)}`;
  return "Toàn bộ thời gian";
}

// Render chữ trực tiếp với font nhúng: không phụ thuộc CSS, DOM, mức zoom
// hoặc độ dài ảnh chụp màn hình. Đây là báo cáo A4 đứng, không phải bill 80 mm.
export function buildPaymentReportPdf(
  snapshot: PaymentReportSnapshot,
  fontBase64: string,
) {
  if (hasInvalidPaymentDateRange(snapshot.filters)) {
    throw new Error("Ngày bắt đầu không được sau ngày kết thúc.");
  }
  if (snapshot.payments.length === 0) {
    throw new Error("Không có giao dịch phù hợp để xuất báo cáo.");
  }
  if (
    snapshot.payments.some((item) => {
      const amount = Number(item.amount);
      return !Number.isFinite(amount) || amount < 0;
    })
  ) {
    throw new Error(
      "Dữ liệu số tiền không hợp lệ. Vui lòng tải lại danh sách.",
    );
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  doc.addFileToVFS(FONT_FILE, fontBase64);
  doc.addFont(FONT_FILE, FONT_NAME, "normal");
  doc.setFont(FONT_NAME);
  doc.setProperties({
    title: "Kippora - Báo cáo thanh toán",
    subject: rangeLabel(snapshot.filters),
    author: "Kippora",
    creator: "Kippora - Quản lý thanh toán",
  });
  doc.setCreationDate(snapshot.generatedAt);

  const margin = 12;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const contentWidth = width - margin * 2;
  const bottom = height - 20;
  const rowLineHeight = 3.9;
  const tableHeaderHeight = 10;
  const summary = summarizePayments(snapshot.payments);
  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: snapshot.timeZone,
  });
  const exportedAt = dateFormatter.format(snapshot.generatedAt);
  // Gộp các trường liên quan để vừa A4 đứng, không bỏ bớt thông tin giao dịch.
  const columns = [
    { title: "Giao dịch", width: 23 },
    { title: "Khách hàng", width: 36 },
    { title: "Chi nhánh", width: 31 },
    { title: "Thanh toán", width: 39 },
    { title: "Số tiền", width: 27 },
    { title: "Thời gian", width: contentWidth - 156 },
  ];
  const amountColumn = 4;
  const paymentColumn = 3;
  let y = 32;

  function pageHeader() {
    doc.setTextColor("#4A2C20");
    doc.setFontSize(19);
    doc.text("KIPPORA", margin, 16);
    doc.setFontSize(13);
    doc.text("BÁO CÁO THANH TOÁN", margin + 39, 16);
    doc.setFontSize(8);
    doc.setTextColor("#756C64");
    doc.text(`Xuất lúc: ${exportedAt}`, width - margin, 13, { align: "right" });
    doc.text(`Múi giờ: ${snapshot.timeZone}`, width - margin, 18, {
      align: "right",
    });
    doc.setDrawColor("#C9894B");
    doc.setLineWidth(0.5);
    doc.line(margin, 23, width - margin, 23);
  }

  function tableHeader() {
    doc.setFillColor("#4A2C20");
    doc.rect(margin, y, contentWidth, tableHeaderHeight, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(8);
    let x = margin;
    for (const [index, column] of columns.entries()) {
      doc.text(
        column.title,
        index === amountColumn ? x + column.width - 3 : x + 2.5,
        y + 6.3,
        {
          align: index === amountColumn ? "right" : "left",
        },
      );
      x += column.width;
    }
    y += tableHeaderHeight;
  }

  function nextPage(withTableHeader = false) {
    doc.addPage();
    pageHeader();
    y = 30;
    if (withTableHeader) tableHeader();
  }

  function paragraph(text: string, fontSize = 9, color = "#534B45") {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(
      cleanText(text),
      contentWidth,
    ) as string[];
    for (const line of lines) {
      if (y + 5 > bottom) nextPage();
      doc.setFontSize(fontSize);
      doc.setTextColor(color);
      doc.text(line, margin, y);
      y += 5;
    }
  }

  pageHeader();
  paragraph(`Thời gian: ${rangeLabel(snapshot.filters)}`);
  paragraph(`Chi nhánh: ${snapshot.branchLabel}`);
  paragraph(
    `Phương thức: ${paymentMethodLabels[snapshot.filters.method]}  |  Trạng thái: ${
      snapshot.filters.status === "ALL"
        ? "Tất cả trạng thái"
        : paymentStatusLabels[snapshot.filters.status]
    }`,
  );
  if (snapshot.filters.search.trim()) {
    paragraph(`Từ khóa tìm kiếm: ${snapshot.filters.search.trim()}`);
  }
  paragraph(
    "Ngày lọc là ngày thanh toán; giao dịch chưa thu dùng ngày tạo.",
    8,
    "#756C64",
  );
  y += 3;
  // Giữ khối tổng hợp và ít nhất một dòng giao dịch cùng trang.
  if (y + 100 > bottom) nextPage();

  const cards = [
    [
      "TỔNG ĐÃ THU",
      money(summary.collectedAmount),
      `${summary.paidCount} giao dịch thành công`,
    ],
    ["TIỀN MẶT TẠI QUẦY", money(summary.cashAmount), "Đơn POS đã thanh toán"],
    [
      "CHUYỂN KHOẢN",
      money(summary.bankTransferAmount),
      "Giao dịch đã xác nhận",
    ],
    [
      "CHỜ THANH TOÁN",
      money(summary.pendingAmount),
      `${summary.pendingCount} giao dịch đang chờ`,
    ],
  ];
  const cardWidth = (contentWidth - 4) / 2;
  for (const [index, card] of cards.entries()) {
    const x = margin + (index % 2) * (cardWidth + 4);
    const cardY = y + Math.floor(index / 2) * 28;
    doc.setFillColor("#FAF6F1");
    doc.setDrawColor("#E7DBCF");
    doc.setLineWidth(0.2);
    doc.roundedRect(x, cardY, cardWidth, 24, 2, 2, "FD");
    doc.setTextColor("#756C64");
    doc.setFontSize(8);
    doc.text(card[0], x + 4, cardY + 6);
    doc.setTextColor("#4A2C20");
    let size = 13;
    doc.setFontSize(size);
    while (doc.getTextWidth(card[1]) > cardWidth - 8 && size > 8) {
      doc.setFontSize(--size);
    }
    doc.text(card[1], x + 4, cardY + 13);
    doc.setFontSize(7.7);
    doc.setTextColor("#756C64");
    doc.text(card[2], x + 4, cardY + 19);
  }
  y += 59;
  paragraph(
    `COD đã thu: ${money(summary.codAmount)}. Tổng đã thu gồm tiền mặt tại quầy, COD và chuyển khoản.`,
    8,
  );
  paragraph(
    "Số tiền đã thu không bao gồm giao dịch đang chờ, thất bại hoặc đã hủy.",
    8,
  );
  y += 3;
  paragraph(`DANH SÁCH GIAO DỊCH (${snapshot.payments.length})`, 10, "#4A2C20");
  y += 1;
  if (y + tableHeaderHeight + 15 > bottom) nextPage();
  tableHeader();

  for (const [index, payment] of snapshot.payments.entries()) {
    const texts = [
      `${index + 1}. #${payment.id}\nĐơn #${payment.orderId}\n${payment.order.channel === "POS" ? "Tại quầy" : "Online"}`,
      `${payment.order.receiverName}\n${payment.order.receiverPhone || "Không cung cấp SĐT"}`,
      `${payment.order.branch.code}\n${payment.order.branch.name}`,
      `${getPaymentMethodLabel(payment)}\n${paymentStatusLabels[payment.status]}${payment.transactionCode ? `\n${payment.transactionCode}` : ""}`,
      money(payment.amount),
      dateFormatter.format(new Date(payment.paidAt || payment.createdAt)),
    ];
    doc.setFontSize(8.3);
    const cells = texts.map((text, col) =>
      // Giữ chủ động xuống dòng giữa các trường, còn giá trị người dùng là plain text.
      text
        .split("\n")
        .flatMap(
          (line) =>
            doc.splitTextToSize(
              cleanText(line),
              columns[col].width - 5,
            ) as string[],
        ),
    );
    const lineCount = Math.max(...cells.map((cell) => cell.length));
    const rowHeight = Math.max(15, lineCount * rowLineHeight + 6);
    const freshPageSpace = bottom - 30 - tableHeaderHeight;
    if (y + rowHeight > bottom && rowHeight <= freshPageSpace) nextPage(true);

    let offset = 0;
    while (offset < lineCount) {
      if (bottom - y < 15) nextPage(true);
      const lineCapacity = Math.max(
        1,
        Math.floor((bottom - y - 6) / rowLineHeight),
      );
      const linesHere = Math.min(lineCount - offset, lineCapacity);
      const segmentHeight = Math.max(15, linesHere * rowLineHeight + 6);
      doc.setFillColor(index % 2 === 0 ? "#FFFFFF" : "#FAF8F5");
      doc.rect(margin, y, contentWidth, segmentHeight, "F");
      doc.setDrawColor("#E7DBCF");
      doc.setLineWidth(0.15);
      doc.line(margin, y + segmentHeight, width - margin, y + segmentHeight);
      doc.setFontSize(8.3);
      let x = margin;
      for (const [col, cell] of cells.entries()) {
        const lines = cell.slice(offset, offset + linesHere);
        if (offset > 0 && col === 0) lines.push(`${index + 1}. (tiếp)`);
        for (const [lineIndex, line] of lines.entries()) {
          doc.setTextColor(col === amountColumn ? "#4A2C20" : "#2A211D");
          if (
            col === paymentColumn &&
            line === paymentStatusLabels[payment.status]
          ) {
            doc.setTextColor(
              payment.status === "PAID"
                ? "#22754A"
                : payment.status === "FAILED"
                  ? "#B13C3C"
                  : "#796844",
            );
          }
          doc.text(
            line,
            col === amountColumn ? x + columns[col].width - 2.5 : x + 2.5,
            y + 5 + lineIndex * rowLineHeight,
            {
              align: col === amountColumn ? "right" : "left",
            },
          );
        }
        x += columns[col].width;
      }
      y += segmentHeight;
      offset += linesHere;
      if (offset < lineCount) nextPage(true);
    }
  }

  // Tổng số trang chỉ có sau khi hoàn tất bảng; không phụ thuộc độ dài danh sách.
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor("#E7DBCF");
    doc.setLineWidth(0.2);
    doc.line(margin, height - 13, width - margin, height - 13);
    doc.setFontSize(7.5);
    doc.setTextColor("#756C64");
    doc.text(
      "Kippora - Báo cáo đối soát nội bộ, không thay thế hóa đơn thuế.",
      margin,
      height - 8,
    );
    doc.text(
      `Trang ${page}/${pageCount}  |  ${snapshot.payments.length} giao dịch`,
      width - margin,
      height - 8,
      { align: "right" },
    );
  }

  return doc;
}

async function loadReportFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      const response = await fetch("/fonts/DejaVuSans.ttf");
      if (!response.ok)
        throw new Error("Không thể tải font báo cáo. Vui lòng thử lại.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Chặn HTML lỗi bị trả về HTTP 200 thay cho font trong một số cấu hình hosting.
      if (
        bytes.length < 12 ||
        bytes[0] !== 0 ||
        bytes[1] !== 1 ||
        bytes[2] !== 0 ||
        bytes[3] !== 0
      ) {
        throw new Error("Font báo cáo không hợp lệ. Vui lòng tải lại trang.");
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

export async function downloadPaymentReportPdf(
  snapshot: PaymentReportSnapshot,
) {
  const font = await loadReportFont();
  const report = buildPaymentReportPdf(snapshot, font);
  const period =
    [snapshot.filters.dateFrom, snapshot.filters.dateTo]
      .filter(Boolean)
      .join("_") || "tat-ca";
  const timestamp = snapshot.generatedAt.getTime();
  await report.save(`kippora-thanh-toan_${period}_${timestamp}.pdf`, {
    returnPromise: true,
  });
}
