import { jsPDF } from "jspdf";
import type { ProfitabilityReport } from "@/types/profitability";

const FONT_NAME = "KipporaReport";
const FONT_FILE = "DejaVuSans.ttf";
let fontPromise: Promise<string> | undefined;

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} đ`;
}

function shortDate(value: string) {
  return value.split("-").reverse().join("/");
}

async function loadFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      const response = await fetch("/fonts/DejaVuSans.ttf");
      if (!response.ok) throw new Error("Không thể tải font báo cáo.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 12 || bytes[0] !== 0 || bytes[1] !== 1) {
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

export function buildProfitabilityReportPdf(
  report: ProfitabilityReport,
  branchLabel: string,
  fontBase64: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS(FONT_FILE, fontBase64);
  doc.addFont(FONT_FILE, FONT_NAME, "normal");
  doc.setFont(FONT_NAME);
  doc.setProperties({
    title: "Kippora - Báo cáo giá vốn và lợi nhuận",
    subject: `${report.filters.from} - ${report.filters.to}`,
    author: "Kippora",
  });
  const margin = 12;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const bottom = height - 16;
  let y = 31;

  function pageHeader() {
    doc.setTextColor("#4A2C20");
    doc.setFontSize(18);
    doc.text("KIPPORA", margin, 16);
    doc.setFontSize(12);
    doc.text("BÁO CÁO GIÁ VỐN & LỢI NHUẬN", margin + 38, 16);
    doc.setDrawColor("#C9894B");
    doc.line(margin, 23, width - margin, 23);
  }

  function nextPage() {
    doc.addPage();
    pageHeader();
    y = 31;
  }

  function ensure(space: number) {
    if (y + space > bottom) nextPage();
  }

  function sectionTitle(value: string) {
    ensure(12);
    doc.setFontSize(10);
    doc.setTextColor("#4A2C20");
    doc.text(value, margin, y);
    y += 5;
  }

  pageHeader();
  doc.setFontSize(8.5);
  doc.setTextColor("#756C64");
  doc.text(`Thời gian: ${shortDate(report.filters.from)} - ${shortDate(report.filters.to)}`, margin, y);
  y += 5;
  doc.text(`Chi nhánh: ${branchLabel}`, margin, y);
  y += 8;

  const cards = [
    ["Doanh thu thuần", report.summary.netRevenue],
    ["Giá vốn", report.summary.cogs],
    ["Lợi nhuận gộp", report.summary.grossProfit],
    ["Chi phí đã duyệt", report.summary.approvedExpenses],
    ["Chi phí lương", report.summary.payroll],
    ["Hao hụt kho", report.summary.inventoryLoss],
    ["Hoàn tiền", report.summary.refunds],
    ["Lợi nhuận ròng", report.summary.netProfit],
  ] as const;
  const cardWidth = (width - margin * 2 - 5) / 2;
  cards.forEach(([label, value], index) => {
    const x = margin + (index % 2) * (cardWidth + 5);
    const cardY = y + Math.floor(index / 2) * 20;
    doc.setFillColor("#FAF6F1");
    doc.setDrawColor("#E7DBCF");
    doc.roundedRect(x, cardY, cardWidth, 16, 2, 2, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor("#756C64");
    doc.text(label, x + 3, cardY + 5);
    doc.setFontSize(11);
    doc.setTextColor(index === 7 && value < 0 ? "#B13C3C" : "#4A2C20");
    doc.text(money(value), x + 3, cardY + 12);
  });
  y += 84;
  doc.setFontSize(8);
  doc.setTextColor("#756C64");
  doc.text(`Biên gộp: ${report.summary.grossMarginPercent}%  |  Biên ròng: ${report.summary.netMarginPercent}%`, margin, y);
  y += 8;

  sectionTitle("KẾT QUẢ THEO CHI NHÁNH");
  const branchWidths = [22, 47, 31, 29, 29, 28];
  const branchHeaders = ["Mã", "Chi nhánh", "DTT", "Giá vốn", "Chi phí", "LN ròng"];
  doc.setFillColor("#4A2C20");
  doc.rect(margin, y, width - margin * 2, 8, "F");
  let x = margin;
  branchHeaders.forEach((header, index) => {
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(7.2);
    doc.text(header, x + 2, y + 5);
    x += branchWidths[index];
  });
  y += 8;
  report.branches.forEach((branch, index) => {
    ensure(8);
    if (index % 2) {
      doc.setFillColor("#FAF6F1");
      doc.rect(margin, y, width - margin * 2, 8, "F");
    }
    const values = [
      branch.branchCode,
      branch.branchName,
      money(branch.netRevenue),
      money(branch.cogs),
      money(branch.approvedExpenses + branch.payroll + branch.inventoryLoss),
      money(branch.netProfit),
    ];
    x = margin;
    values.forEach((value, column) => {
      doc.setTextColor(column === 5 && branch.netProfit < 0 ? "#B13C3C" : "#2A211D");
      doc.setFontSize(6.8);
      const display = doc.splitTextToSize(value, branchWidths[column] - 3)[0];
      doc.text(display, x + 2, y + 5);
      x += branchWidths[column];
    });
    y += 8;
  });

  y += 5;
  sectionTitle(`LỢI NHUẬN TỪNG MÓN (${report.products.length})`);
  const productWidths = [48, 16, 32, 31, 33, 26];
  const productHeaders = ["Món", "Đã bán", "DTT", "Giá vốn", "Lãi gộp", "Biên"];
  function productHeader() {
    doc.setFillColor("#4A2C20");
    doc.rect(margin, y, width - margin * 2, 8, "F");
    let headerX = margin;
    productHeaders.forEach((header, index) => {
      doc.setTextColor("#FFFFFF");
      doc.setFontSize(7);
      doc.text(header, headerX + 2, y + 5);
      headerX += productWidths[index];
    });
    y += 8;
  }
  productHeader();
  report.products.forEach((product, index) => {
    if (y + 8 > bottom) {
      nextPage();
      productHeader();
    }
    if (index % 2) {
      doc.setFillColor("#FAF6F1");
      doc.rect(margin, y, width - margin * 2, 8, "F");
    }
    const values = [
      product.productName,
      String(product.quantitySold),
      money(product.netRevenue),
      money(product.cogs),
      money(product.grossProfit),
      `${product.grossMarginPercent}%`,
    ];
    let rowX = margin;
    values.forEach((value, column) => {
      const warning =
        (column === 4 && product.grossProfit < 0) ||
        (column === 5 && product.grossMarginPercent < 30);
      doc.setTextColor(warning ? "#B13C3C" : "#2A211D");
      doc.setFontSize(6.8);
      doc.text(doc.splitTextToSize(value, productWidths[column] - 3)[0], rowX + 2, y + 5);
      rowX += productWidths[column];
    });
    y += 8;
  });

  y += 5;
  sectionTitle(`CHI TIẾT ĐƠN ĐÃ THU (${report.orders.length})`);
  const orderWidths = [17, 20, 29, 32, 29, 29, 28];
  const orderHeaders = ["Đơn", "CN", "Ngày thu", "Doanh thu", "Giá vốn", "Lãi", "Biên"];
  function orderHeader() {
    doc.setFillColor("#4A2C20");
    doc.rect(margin, y, width - margin * 2, 8, "F");
    let headerX = margin;
    orderHeaders.forEach((header, index) => {
      doc.setTextColor("#FFFFFF");
      doc.setFontSize(7);
      doc.text(header, headerX + 2, y + 5);
      headerX += orderWidths[index];
    });
    y += 8;
  }
  orderHeader();
  report.orders.forEach((order, index) => {
    if (y + 8 > bottom) {
      nextPage();
      orderHeader();
    }
    if (index % 2) {
      doc.setFillColor("#FAF6F1");
      doc.rect(margin, y, width - margin * 2, 8, "F");
    }
    const values = [
      `#${order.orderId}`,
      order.branchCode,
      new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(order.paidAt)),
      money(order.grossRevenue),
      money(order.cogs),
      money(order.grossProfit),
      `${order.grossMarginPercent}%`,
    ];
    let rowX = margin;
    values.forEach((value, column) => {
      doc.setTextColor(column === 5 && order.grossProfit < 0 ? "#B13C3C" : "#2A211D");
      doc.setFontSize(6.8);
      doc.text(doc.splitTextToSize(value, orderWidths[column] - 3)[0], rowX + 2, y + 5);
      rowX += orderWidths[column];
    });
    y += 8;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor("#E7DBCF");
    doc.line(margin, height - 12, width - margin, height - 12);
    doc.setFontSize(7);
    doc.setTextColor("#756C64");
    doc.text("Báo cáo nội bộ; số liệu lấy tại thời điểm xuất.", margin, height - 7);
    doc.text(`Trang ${page}/${pages}`, width - margin, height - 7, { align: "right" });
  }
  return doc;
}

export async function downloadProfitabilityReportPdf(
  report: ProfitabilityReport,
  branchLabel: string,
) {
  const font = await loadFont();
  const doc = buildProfitabilityReportPdf(report, branchLabel, font);
  await doc.save(`kippora-loi-nhuan_${report.filters.from}_${report.filters.to}.pdf`, {
    returnPromise: true,
  });
}
