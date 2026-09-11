import { jsPDF } from "jspdf";
import type { PayrollEntry, PayrollReport } from "@/types/payroll";
import { payrollAttendanceLines } from "./payroll-attendance.util";

const FONT_NAME = "KipporaPayroll";
const FONT_FILE = "DejaVuSans.ttf";
let fontPromise: Promise<string> | undefined;

function clean(value: string) {
  return value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ");
}

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value)} đ`;
}

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours} giờ ${remaining} phút` : `${remaining} phút`;
}

function payrollStatusLabel(report: PayrollReport) {
  if (report.status === "PAID") return "Đã thanh toán";
  if (report.status === "FINALIZED") return "Đã chốt · Chờ thanh toán";
  return "Bản nháp";
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

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const width = doc.internal.pageSize.getWidth();
  doc.setTextColor("#4A2C20");
  doc.setFontSize(19);
  doc.text("KIPPORA", 12, 16);
  doc.setFontSize(13);
  doc.text(title, 52, 16);
  doc.setFontSize(8);
  doc.setTextColor("#756C64");
  doc.text(clean(subtitle), width - 12, 16, { align: "right" });
  doc.setDrawColor("#C9894B");
  doc.setLineWidth(0.5);
  doc.line(12, 23, width - 12, 23);
}

export function buildPayrollPdf(report: PayrollReport, font: string) {
  if (!report.entries.length) {
    throw new Error("Không có dữ liệu bảng lương để xuất PDF.");
  }
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  setupDocument(doc, font);
  doc.setProperties({
    title: `Kippora - Bảng lương ${report.month}`,
    subject: `${report.branch.code} - ${report.branch.name}`,
    author: "Kippora",
  });

  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const bottom = pageHeight - 17;
  const columns = [
    { title: "Nhân viên", width: 48 },
    { title: "Thời gian", width: 38 },
    { title: "Ca làm", width: 32 },
    { title: "Điều chỉnh", width: 34 },
    { title: "Thực nhận", width: contentWidth - 152 },
  ];
  let y = 31;

  const header = () =>
    drawHeader(doc, "BẢNG LƯƠNG", `${report.branch.code} · ${report.month}`);
  const tableHeader = () => {
    doc.setFillColor("#4A2C20");
    doc.rect(margin, y, contentWidth, 10, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFontSize(7.8);
    let x = margin;
    columns.forEach((column, index) => {
      doc.text(
        column.title,
        index === columns.length - 1 ? x + column.width - 2 : x + 2,
        y + 6.3,
        { align: index === columns.length - 1 ? "right" : "left" },
      );
      x += column.width;
    });
    y += 10;
  };
  const nextPage = (withTable = false) => {
    doc.addPage();
    header();
    y = 30;
    if (withTable) tableHeader();
  };

  header();
  doc.setFontSize(9);
  doc.setTextColor("#534B45");
  doc.text(clean(`${report.branch.code} · ${report.branch.name}`), margin, y);
  y += 6;
  doc.text(
    `Kỳ lương: ${report.month}  |  ${payrollStatusLabel(report)}`,
    margin,
    y,
  );
  y += 9;

  const cards = [
    ["Tổng thực nhận", money(report.summary.totalAmount)],
    ["Lương giờ", money(report.summary.baseAmount)],
    ["Lương tăng ca", money(report.summary.overtimeAmount)],
    [
      "Điều chỉnh",
      `+${money(report.summary.bonusAmount)} / -${money(
        report.summary.totalDeductionAmount,
      )}`,
    ],
  ];
  const cardWidth = (contentWidth - 4) / 2;
  cards.forEach((card, index) => {
    const x = margin + (index % 2) * (cardWidth + 4);
    const cardY = y + Math.floor(index / 2) * 25;
    doc.setFillColor("#FAF6F1");
    doc.setDrawColor("#E7DBCF");
    doc.roundedRect(x, cardY, cardWidth, 21, 2, 2, "FD");
    doc.setTextColor("#756C64");
    doc.setFontSize(7.5);
    doc.text(card[0], x + 3, cardY + 6);
    doc.setTextColor("#4A2C20");
    doc.setFontSize(10.5);
    doc.text(card[1], x + 3, cardY + 14);
  });
  y += 56;
  tableHeader();

  report.entries.forEach((entry, index) => {
    const texts = [
      `${entry.employee.fullName || "Chưa cập nhật tên"}\n${entry.employee.email}\n${money(entry.hourlyRateSnapshot)}/giờ · OT ×${entry.overtimeMultiplierSnapshot}`,
      `Giờ làm: ${duration(entry.regularSeconds)}\nTăng ca: ${duration(entry.overtimeSeconds)}\nTrễ: ${entry.lateMinutes}p · Sớm: ${entry.earlyLeaveMinutes}p`,
      payrollAttendanceLines(entry)
        .map((line) => line.text)
        .join("\n"),
      `Thưởng: +${money(entry.bonusAmount)}\nKhấu trừ: -${money(entry.totalDeductionAmount)}`,
      money(entry.totalAmount),
    ];
    doc.setFontSize(7.4);
    const cells = texts.map((text, column) =>
      text
        .split("\n")
        .flatMap(
          (line) =>
            doc.splitTextToSize(
              clean(line),
              columns[column].width - 4,
            ) as string[],
        ),
    );
    const lines = Math.max(...cells.map((cell) => cell.length));
    const rowHeight = Math.max(18, lines * 3.6 + 6);
    if (y + rowHeight > bottom) nextPage(true);
    doc.setFillColor(index % 2 ? "#FAF8F5" : "#FFFFFF");
    doc.rect(margin, y, contentWidth, rowHeight, "F");
    doc.setDrawColor("#E7DBCF");
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    let x = margin;
    cells.forEach((cell, column) => {
      doc.setTextColor(column === columns.length - 1 ? "#4A2C20" : "#2A211D");
      cell.forEach((line, lineIndex) => {
        doc.text(
          line,
          column === columns.length - 1 ? x + columns[column].width - 2 : x + 2,
          y + 5 + lineIndex * 3.6,
          { align: column === columns.length - 1 ? "right" : "left" },
        );
      });
      x += columns[column].width;
    });
    y += rowHeight;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor("#756C64");
    doc.text(
      `Trang ${page}/${pages} · ${report.entries.length} nhân viên`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" },
    );
  }
  return doc;
}

export function buildPayrollPayslip(
  report: PayrollReport,
  entry: PayrollEntry,
  font: string,
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
    compress: true,
    putOnlyUsedFonts: true,
  });
  setupDocument(doc, font);
  const width = doc.internal.pageSize.getWidth();
  const margin = 12;
  drawHeader(doc, "PHIẾU LƯƠNG", report.month);
  let y = 33;
  const name = entry.employee.fullName || "Chưa cập nhật tên";
  doc.setTextColor("#2A211D");
  doc.setFontSize(14);
  doc.text(clean(name), margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor("#756C64");
  doc.text(clean(entry.employee.email), margin, y);
  y += 5;
  doc.text(clean(`${report.branch.code} · ${report.branch.name}`), margin, y);
  y += 10;

  const line = (label: string, value: string, strong = false) => {
    doc.setFontSize(strong ? 10.5 : 8.5);
    doc.setTextColor(strong ? "#4A2C20" : "#756C64");
    doc.text(label, margin, y);
    doc.setTextColor("#2A211D");
    doc.text(value, width - margin, y, { align: "right" });
    y += strong ? 8 : 6;
  };
  line("Đơn giá", `${money(entry.hourlyRateSnapshot)}/giờ`);
  line("Giờ làm", duration(entry.regularSeconds));
  line("Lương giờ", money(entry.baseAmount));
  line(
    `Tăng ca ×${entry.overtimeMultiplierSnapshot}`,
    `${duration(entry.overtimeSeconds)} · ${money(entry.overtimeAmount)}`,
  );
  doc.setDrawColor("#E7DBCF");
  doc.line(margin, y - 2, width - margin, y - 2);
  y += 3;
  line("Thưởng", `+${money(entry.bonusAmount)}`);
  line("Khấu trừ", `-${money(entry.totalDeductionAmount)}`);
  doc.line(margin, y - 2, width - margin, y - 2);
  y += 4;
  line("THỰC NHẬN", money(entry.totalAmount), true);

  doc.setFontSize(7.5);
  doc.setTextColor("#756C64");
  const attendanceLines = doc.splitTextToSize(
    payrollAttendanceLines(entry)
      .map((item) => item.text)
      .join(" · ") +
      ` · Đi trễ: ${entry.lateMinutes} phút · Về sớm: ${entry.earlyLeaveMinutes} phút`,
    width - margin * 2,
  ) as string[];
  const writeDetailLines = (lines: string[]) => {
    for (const text of lines) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 16;
      }
      doc.text(text, margin, y);
      y += 4;
    }
  };
  y += 2;
  writeDetailLines(attendanceLines);
  y += 6;
  if (
    entry.lateDeductionAmount > 0 ||
    entry.earlyLeaveMinutes > 0 ||
    entry.earlyLeaveDeductionAmount > 0 ||
    entry.absenceDeductionAmount > 0 ||
    entry.adjustments.length
  ) {
    doc.setTextColor("#4A2C20");
    doc.setFontSize(8.5);
    writeDetailLines(["Chi tiết điều chỉnh"]);
    y += 1;
    if (entry.lateDeductionAmount > 0) {
      doc.setTextColor("#534B45");
      doc.setFontSize(7.5);
      writeDetailLines([
        `-${money(entry.lateDeductionAmount)} · Tự động: đi trễ ${entry.lateMinutes} phút`,
      ]);
      y += 2;
    }
    const approvedEarlyLeaveMinutes = Math.max(
      0,
      entry.earlyLeaveMinutes - entry.unexcusedEarlyLeaveMinutes,
    );
    if (approvedEarlyLeaveMinutes > 0) {
      doc.setTextColor("#3F6B4F");
      doc.setFontSize(7.5);
      writeDetailLines([
        `Về sớm được duyệt: ${approvedEarlyLeaveMinutes} phút (không khấu trừ thêm)`,
      ]);
      y += 2;
    }
    if (entry.earlyLeaveDeductionAmount > 0) {
      doc.setTextColor("#534B45");
      doc.setFontSize(7.5);
      writeDetailLines([
        `-${money(entry.earlyLeaveDeductionAmount)} · Tự động: về sớm không phép ${entry.unexcusedEarlyLeaveMinutes} phút`,
      ]);
      y += 2;
    }
    if (entry.absenceDeductionAmount > 0) {
      doc.setTextColor("#534B45");
      doc.setFontSize(7.5);
      writeDetailLines([
        `-${money(entry.absenceDeductionAmount)} · Tự động: vắng không phép ${duration(entry.unexcusedAbsentSeconds)}, phạt ${Math.round(report.rules.absencePenaltyRate * 100)}% giá trị ca`,
      ]);
      y += 2;
    }
    entry.adjustments.forEach((adjustment) => {
      doc.setTextColor("#534B45");
      doc.setFontSize(7.5);
      const prefix = adjustment.type === "BONUS" ? "+" : "-";
      const lines = doc.splitTextToSize(
        clean(`${prefix}${money(adjustment.amount)} · ${adjustment.reason}`),
        width - margin * 2,
      ) as string[];
      writeDetailLines(lines);
      y += 2;
    });
  }
  doc.setFontSize(7);
  doc.setTextColor("#8A817B");
  doc.text(
    report.status === "PAID"
      ? "Phiếu lương thuộc kỳ đã thanh toán."
      : report.status === "FINALIZED"
        ? "Phiếu lương thuộc kỳ đã chốt, đang chờ thanh toán."
        : "Phiếu lương tạm tính; số liệu còn có thể thay đổi trước khi chốt.",
    margin,
    doc.internal.pageSize.getHeight() - 10,
  );
  return doc;
}

export async function downloadPayrollPdf(report: PayrollReport) {
  const font = await loadFont();
  await buildPayrollPdf(report, font).save(
    `kippora-bang-luong_${report.branch.code}_${report.month}.pdf`,
    { returnPromise: true },
  );
}

export async function downloadPayrollPayslip(
  report: PayrollReport,
  entry: PayrollEntry,
) {
  const font = await loadFont();
  await buildPayrollPayslip(report, entry, font).save(
    `kippora-phieu-luong_${entry.employeeId}_${report.month}.pdf`,
    { returnPromise: true },
  );
}
