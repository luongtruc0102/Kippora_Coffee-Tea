import ExcelJS from "exceljs";

import type { AttendanceReport } from "@/types/staff-schedule";
import { attendanceStatusLabels } from "@/utils/attendance-report.util";

const colors = {
  brown: "FF4A2C20",
  cream: "FFFAF6F1",
  border: "FFE7DBCF",
  text: "FF2A211D",
  muted: "FF756C64",
  green: "FF22754A",
};

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function localExcelDate(value: string, timeZone: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour"),
      read("minute"),
      read("second"),
    ),
  );
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 30;
  row.eachCell((cell) => {
    cell.fill = fill(colors.brown);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function title(sheet: ExcelJS.Worksheet, range: string, value: string) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  cell.value = value;
  cell.fill = fill(colors.brown);
  cell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  cell.alignment = { vertical: "middle" };
}

export function buildAttendanceReportExcel(report: AttendanceReport) {
  if (!report.rows.length) throw new Error("Không có dữ liệu chấm công để xuất Excel");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kippora";
  workbook.created = new Date(report.generatedAt);
  workbook.title = "Kippora - Bảng công nhân viên";

  const overview = workbook.addWorksheet("Tổng hợp nhân viên", {
    views: [{ state: "frozen", ySplit: 12, showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  overview.columns = [
    { width: 7 },
    { width: 28 },
    { width: 30 },
    { width: 13 },
    { width: 13 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];
  title(overview, "A1:K2", "KIPPORA - BẢNG CÔNG NHÂN VIÊN");
  overview.getCell("A4").value = "Chi nhánh";
  overview.getCell("B4").value = `${report.branch.code} · ${report.branch.name}`;
  overview.getCell("A5").value = "Khoảng ngày";
  overview.getCell("B5").value = `${report.startDate} đến ${report.endDate}`;
  overview.getCell("A6").value = "Múi giờ";
  overview.getCell("B6").value = report.timeZone;
  overview.getCell("A8").value = "Tổng ca được xếp";
  overview.getCell("B8").value = report.summary.scheduledShifts;
  overview.getCell("D8").value = "Đúng giờ";
  overview.getCell("E8").value = report.summary.onTimeShifts;
  overview.getCell("G8").value = "Đi trễ";
  overview.getCell("H8").value = report.summary.lateShifts;
  overview.getCell("A9").value = "Vắng mặt";
  overview.getCell("B9").value = report.summary.absentShifts;
  overview.getCell("D9").value = "Tổng giờ làm";
  overview.getCell("E9").value = report.summary.workedSeconds / 3600;
  overview.getCell("E9").numFmt = '0.00 "giờ"';
  overview.getCell("G9").value = "Tăng ca";
  overview.getCell("H9").value = report.summary.overtimeSeconds / 3600;
  overview.getCell("H9").numFmt = '0.00 "giờ"';
  [4, 5, 6, 8, 9].forEach((rowNumber) => {
    overview.getRow(rowNumber).height = 24;
    overview.getRow(rowNumber).eachCell((cell, column) => {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: column % 3 === 1,
        color: { argb: column % 3 === 1 ? colors.muted : colors.text },
      };
    });
  });

  const overviewHeader = overview.getRow(12);
  overviewHeader.values = [
    "STT",
    "Nhân viên",
    "Email",
    "Ca được xếp",
    "Đã chấm công",
    "Đi trễ",
    "Về sớm",
    "Vắng mặt",
    "Nghỉ có phép",
    "Giờ làm",
    "Tăng ca",
  ];
  styleHeader(overviewHeader);
  report.employees.forEach((item, index) => {
    const row = overview.getRow(13 + index);
    row.values = [
      index + 1,
      item.employee.fullName || "Chưa cập nhật tên",
      item.employee.email,
      item.scheduledShifts,
      item.attendedShifts,
      item.lateShifts,
      item.earlyLeaveShifts,
      item.absentShifts,
      item.excusedLeaveShifts,
      item.workedSeconds / 3600,
      item.overtimeSeconds / 3600,
    ];
    row.height = 28;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.fill = fill(index % 2 ? colors.cream : "FFFFFFFF");
      cell.font = { name: "Arial", size: 10, color: { argb: colors.text } };
      cell.border = { bottom: { style: "hair", color: { argb: colors.border } } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (column >= 10) cell.numFmt = '0.00 "giờ"';
    });
  });

  const detail = workbook.addWorksheet("Chi tiết từng ca", {
    views: [{ state: "frozen", ySplit: 6, xSplit: 2, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  detail.columns = [8, 26, 27, 18, 18, 18, 18, 22, 14, 14, 32].map((width) => ({ width }));
  title(detail, "A1:K2", "KIPPORA - CHI TIẾT CHẤM CÔNG");
  detail.mergeCells("A4:K4");
  detail.getCell("A4").value = `${report.branch.code} · ${report.branch.name} | ${report.startDate} đến ${report.endDate} | Múi giờ ${report.timeZone}`;
  detail.getCell("A4").font = { name: "Arial", size: 10, color: { argb: colors.muted } };
  const detailHeader = detail.getRow(6);
  detailHeader.values = [
    "STT",
    "Nhân viên",
    "Ngày ca",
    "Dự kiến vào",
    "Dự kiến ra",
    "Thực tế vào",
    "Thực tế ra",
    "Kết quả",
    "Giờ làm",
    "Tăng ca",
    "Lý do điều chỉnh",
  ];
  styleHeader(detailHeader);
  report.rows.forEach((item, index) => {
    const row = detail.getRow(7 + index);
    const baseDate = item.scheduledStart || item.clockIn;
    row.values = [
      index + 1,
      item.employee.fullName || item.employee.email,
      baseDate ? localExcelDate(baseDate, report.timeZone) : "",
      item.scheduledStart ? localExcelDate(item.scheduledStart, report.timeZone) : "",
      item.scheduledEnd ? localExcelDate(item.scheduledEnd, report.timeZone) : "",
      item.clockIn ? localExcelDate(item.clockIn, report.timeZone) : "",
      item.clockOut ? localExcelDate(item.clockOut, report.timeZone) : "",
      attendanceStatusLabels[item.status],
      item.workedSeconds / 3600,
      item.overtimeSeconds / 3600,
      item.leaveRequest
        ? `${item.leaveRequest.reason}${item.leaveRequest.reviewNote ? ` | Phản hồi: ${item.leaveRequest.reviewNote}` : ""}`
        : item.adjustmentReason || "",
    ];
    row.height = 30;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.fill = fill(index % 2 ? colors.cream : "FFFFFFFF");
      cell.font = { name: "Arial", size: 10, color: { argb: colors.text } };
      cell.border = { bottom: { style: "hair", color: { argb: colors.border } } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (column === 3) cell.numFmt = "dd/mm/yyyy";
      if (column >= 4 && column <= 7) cell.numFmt = "dd/mm/yyyy hh:mm";
      if (column === 9 || column === 10) cell.numFmt = '0.00 "giờ"';
    });
  });
  detail.autoFilter = `A6:K${6 + report.rows.length}`;

  return workbook;
}

export async function downloadAttendanceReportExcel(report: AttendanceReport) {
  const workbook = buildAttendanceReportExcel(report);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `kippora-bang-cong_${report.branch.code}_${report.startDate}_${report.endDate}.xlsx`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
