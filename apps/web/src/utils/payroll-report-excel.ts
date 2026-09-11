import ExcelJS from "exceljs";
import type { PayrollReport } from "@/types/payroll";
import { payrollAttendanceLines } from "./payroll-attendance.util";

const MONEY_FORMAT = '#,##0 "₫"';
const colors = {
  brown: "FF4A2C20",
  cream: "FFFAF6F1",
  border: "FFE7DBCF",
  green: "FF22754A",
  red: "FFB13C3C",
  muted: "FF756C64",
};

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function hours(seconds: number) {
  return Math.round((seconds / 3600) * 100) / 100;
}

function payrollStatusLabel(report: PayrollReport) {
  if (report.status === "PAID") return "Đã thanh toán";
  if (report.status === "FINALIZED") return "Đã chốt · Chờ thanh toán";
  return "Bản nháp";
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 32;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(colors.brown);
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

export function buildPayrollExcel(report: PayrollReport) {
  if (!report.entries.length) {
    throw new Error("Không có dữ liệu bảng lương để xuất Excel.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kippora";
  workbook.created = new Date(report.generatedAt);
  workbook.title = `Bảng lương ${report.month}`;

  const sheet = workbook.addWorksheet("Bảng lương", {
    views: [{ state: "frozen", ySplit: 7, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  sheet.columns = [
    { width: 7 },
    { width: 28 },
    { width: 31 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 13 },
    { width: 13 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  sheet.mergeCells("A1:O2");
  sheet.getCell("A1").value = "KIPPORA - BẢNG LƯƠNG NHÂN VIÊN";
  sheet.getCell("A1").fill = fill(colors.brown);
  sheet.getCell("A1").font = {
    name: "Arial",
    size: 18,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.mergeCells("A3:O3");
  sheet.getCell("A3").value =
    `${report.branch.code} · ${report.branch.name} | Tháng ${report.month} | ` +
    `Trạng thái: ${payrollStatusLabel(report)}`;
  sheet.mergeCells("A4:O4");
  sheet.getCell("A4").value =
    `Tổng thực nhận: ${report.summary.totalAmount.toLocaleString("vi-VN")} ₫ | ` +
    `Thưởng: ${report.summary.bonusAmount.toLocaleString("vi-VN")} ₫ | ` +
    `Khấu trừ: ${report.summary.totalDeductionAmount.toLocaleString("vi-VN")} ₫`;
  sheet.mergeCells("A5:O5");
  sheet.getCell("A5").value =
    "Giờ làm và tăng ca lấy từ các lần chấm công đã kết thúc. File là ảnh chụp tại thời điểm xuất.";
  [3, 4, 5].forEach((row) => {
    sheet.getCell(row, 1).font = {
      name: "Arial",
      size: 10,
      color: { argb: colors.muted },
    };
  });

  const headers = [
    "STT",
    "Nhân viên",
    "Email",
    "Lương giờ",
    "Hệ số OT",
    "Lượt đã kết thúc",
    "Ca được xếp",
    "Giờ làm",
    "Giờ tăng ca",
    "Đi trễ (phút)",
    "Về sớm (phút)",
    "Lương giờ",
    "Lương tăng ca",
    "Thưởng / Khấu trừ",
    "Thực nhận",
  ];
  sheet.getRow(7).values = headers;
  styleHeader(sheet.getRow(7));

  report.entries.forEach((entry, index) => {
    const row = sheet.getRow(index + 8);
    row.values = [
      index + 1,
      entry.employee.fullName || "Chưa cập nhật tên",
      entry.employee.email,
      entry.hourlyRateSnapshot,
      entry.overtimeMultiplierSnapshot,
      entry.completedShifts,
      entry.scheduledShifts,
      hours(entry.regularSeconds),
      hours(entry.overtimeSeconds),
      entry.lateMinutes,
      entry.earlyLeaveMinutes,
      entry.baseAmount,
      entry.overtimeAmount,
      entry.bonusAmount - entry.totalDeductionAmount,
      entry.totalAmount,
    ];
    row.height = 28;
    row.getCell(6).note = payrollAttendanceLines(entry)
      .map((line) => line.text)
      .join("\n");
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.fill = fill(index % 2 ? colors.cream : "FFFFFFFF");
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: column === 1 ? "center" : column >= 4 ? "right" : "left",
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: colors.border } },
      };
      if ([4, 12, 13, 14, 15].includes(column)) cell.numFmt = MONEY_FORMAT;
      if ([8, 9].includes(column)) cell.numFmt = '0.00 "giờ"';
    });
  });
  const lastRow = report.entries.length + 7;
  sheet.autoFilter = `A7:O${lastRow}`;

  const adjustments = workbook.addWorksheet("Thưởng và khấu trừ", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: false }],
  });
  adjustments.columns = [
    { width: 8 },
    { width: 30 },
    { width: 18 },
    { width: 20 },
    { width: 50 },
    { width: 28 },
    { width: 22 },
  ];
  adjustments.mergeCells("A1:G1");
  adjustments.getCell("A1").value = "CHI TIẾT THƯỞNG VÀ KHẤU TRỪ";
  adjustments.getCell("A1").fill = fill(colors.brown);
  adjustments.getCell("A1").font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  adjustments.getRow(2).values = [
    "STT",
    "Nhân viên",
    "Loại",
    "Số tiền",
    "Lý do",
    "Người tạo",
    "Thời gian",
  ];
  styleHeader(adjustments.getRow(2));
  const adjustmentRows = report.entries.flatMap((entry) => [
    ...(entry.lateDeductionAmount > 0
      ? [
          {
            entry,
            type: "DEDUCTION" as const,
            amount: entry.lateDeductionAmount,
            reason: `Tự động: đi trễ ${entry.lateMinutes} phút`,
            creator: "Hệ thống",
            createdAt: "Khi tạo bảng lương",
          },
        ]
      : []),
    ...(entry.earlyLeaveDeductionAmount > 0
      ? [
          {
            entry,
            type: "DEDUCTION" as const,
            amount: entry.earlyLeaveDeductionAmount,
            reason: `Tự động: về sớm không phép ${entry.unexcusedEarlyLeaveMinutes} phút`,
            creator: "Hệ thống",
            createdAt: "Khi tạo bảng lương",
          },
        ]
      : []),
    ...(entry.absenceDeductionAmount > 0
      ? [
          {
            entry,
            type: "DEDUCTION" as const,
            amount: entry.absenceDeductionAmount,
            reason: `Tự động: vắng không phép ${hours(entry.unexcusedAbsentSeconds)}, phạt ${Math.round(report.rules.absencePenaltyRate * 100)}% giá trị ca`,
            creator: "Hệ thống",
            createdAt: "Khi tạo bảng lương",
          },
        ]
      : []),
    ...entry.adjustments.map((adjustment) => ({
      entry,
      type: adjustment.type,
      amount: adjustment.amount,
      reason: adjustment.reason,
      creator:
        adjustment.createdBy?.fullName || adjustment.createdBy?.email || "—",
      createdAt: new Date(adjustment.createdAt),
    })),
  ]);
  adjustmentRows.forEach((item, index) => {
    const row = adjustments.getRow(index + 3);
    row.values = [
      index + 1,
      item.entry.employee.fullName || item.entry.employee.email,
      item.type === "BONUS" ? "Thưởng" : "Khấu trừ",
      item.amount,
      item.reason,
      item.creator,
      item.createdAt,
    ];
    row.height = 30;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = {
        name: "Arial",
        size: 10,
        color: {
          argb:
            column === 3
              ? item.type === "BONUS"
                ? colors.green
                : colors.red
              : "FF2A211D",
        },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        bottom: { style: "hair", color: { argb: colors.border } },
      };
      if (column === 4) cell.numFmt = MONEY_FORMAT;
      if (column === 7) cell.numFmt = "dd/mm/yyyy hh:mm";
    });
  });

  return workbook;
}

export async function downloadPayrollExcel(report: PayrollReport) {
  const workbook = buildPayrollExcel(report);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `kippora-bang-luong_${report.branch.code}_${report.month}.xlsx`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
