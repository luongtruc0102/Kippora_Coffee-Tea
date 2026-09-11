import ExcelJS from "exceljs";
import {
  getPaymentMethodKey,
  getPaymentMethodLabel,
  hasInvalidPaymentDateRange,
  paymentMethodLabels,
  paymentStatusLabels,
  summarizePayments,
  type PaymentReportSnapshot,
} from "./payment.util";

const DETAIL_SHEET = "Chi tiết giao dịch";
const FIRST_ROW = 8;
const MONEY_FORMAT = '#,##0.00 "₫"';
const DATE_FORMAT = "dd/mm/yyyy hh:mm";
const colors = {
  brown: "FF4A2C20",
  cream: "FFFAF6F1",
  border: "FFE7DBCF",
  text: "FF2A211D",
  muted: "FF756C64",
  green: "FF22754A",
};

function text(value: string) {
  const result = value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (result.length > 32767)
    throw new Error(
      "Một trường dữ liệu vượt giới hạn ô Excel. Vui lòng kiểm tra lại giao dịch.",
    );
  // ExcelJS lưu string thành ô văn bản, không diễn giải =, +, - hoặc @ thành công thức.
  return result;
}

function dateOnly(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Ngày lọc không hợp lệ.");
  }
  return date;
}

// Excel không lưu múi giờ. Ghi giờ địa phương như trên web thành serial date,
// đồng thời ghi rõ múi giờ trong workbook để tránh lệch 7 giờ khi mở file.
export function toPaymentExcelDate(value: string | Date, timeZone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error(
      "Dữ liệu thời gian không hợp lệ. Vui lòng tải lại danh sách.",
    );
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
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === name)?.value);
  return new Date(
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    ),
  );
}

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function band(sheet: ExcelJS.Worksheet, range: string, title: string) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  cell.value = title;
  cell.fill = fill(colors.brown);
  cell.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  cell.alignment = { vertical: "middle", wrapText: true };
}

function styleHeader(row: ExcelJS.Row, count: number) {
  row.height = 32;
  for (let col = 1; col <= count; col += 1) {
    const cell = row.getCell(col);
    cell.fill = fill(colors.brown);
    cell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

export function buildPaymentReportExcel(snapshot: PaymentReportSnapshot) {
  if (hasInvalidPaymentDateRange(snapshot.filters))
    throw new Error("Ngày bắt đầu không được sau ngày kết thúc.");
  if (!snapshot.payments.length)
    throw new Error("Không có giao dịch phù hợp để xuất báo cáo.");
  if (snapshot.payments.length > 1_048_576 - FIRST_ROW + 1)
    throw new Error(
      "Danh sách vượt giới hạn Excel. Anh hãy thu hẹp bộ lọc ngày.",
    );
  const amounts = snapshot.payments.map((payment) => {
    const amount = Number(payment.amount);
    if (
      (typeof payment.amount === "string" && !payment.amount.trim()) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isSafeInteger(Math.round(amount * 100))
    ) {
      throw new Error(
        "Dữ liệu số tiền không hợp lệ. Vui lòng tải lại danh sách.",
      );
    }
    if (!paymentStatusLabels[payment.status])
      throw new Error("Trạng thái thanh toán không hợp lệ.");
    return Math.round(amount * 100) / 100;
  });
  const from = dateOnly(snapshot.filters.dateFrom);
  const to = dateOnly(snapshot.filters.dateTo);
  const exportedAt = toPaymentExcelDate(
    snapshot.generatedAt,
    snapshot.timeZone,
  );
  const summary = summarizePayments(snapshot.payments);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kippora";
  workbook.created = new Date(snapshot.generatedAt);
  workbook.modified = new Date(snapshot.generatedAt);
  workbook.title = "Kippora - Báo cáo thanh toán";
  workbook.calcProperties.fullCalcOnLoad = true;

  const overview = workbook.addWorksheet("Tổng quan", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
    },
  });
  const details = workbook.addWorksheet(DETAIL_SHEET, {
    views: [
      {
        state: "frozen",
        xSplit: 3,
        ySplit: FIRST_ROW - 1,
        topLeftCell: "D8",
        activeCell: "D8",
        showGridLines: false,
      },
    ],
  });
  const widths = [8, 18, 16, 32, 21, 18, 40, 17, 22, 24, 23, 36, 25];
  details.columns = widths.map((width) => ({ width }));
  overview.columns = [{ width: 40 }, { width: 23 }, { width: 32 }];

  band(details, "A1:M2", "KIPPORA - CHI TIẾT GIAO DỊCH");
  details.getRow(1).height = 25;
  details.getRow(2).height = 14;
  const metadata = [
    `Khoảng ngày: ${snapshot.filters.dateFrom || "Không giới hạn"} đến ${snapshot.filters.dateTo || "Không giới hạn"}. Chi nhánh: ${snapshot.branchLabel}`,
    `Phương thức: ${paymentMethodLabels[snapshot.filters.method]}. Trạng thái: ${snapshot.filters.status === "ALL" ? "Tất cả trạng thái" : paymentStatusLabels[snapshot.filters.status]}. Từ khóa: ${snapshot.filters.search.trim() || "Không có"}`,
    `Múi giờ: ${snapshot.timeZone}. Thời gian giao dịch = ngày thanh toán; nếu chưa thu thì dùng ngày tạo.`,
  ];
  metadata.forEach((value, index) => {
    details.mergeCells(index + 3, 1, index + 3, 13);
    const cell = details.getCell(index + 3, 1);
    cell.value = text(value);
    cell.font = { name: "Arial", size: 10, color: { argb: colors.muted } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    details.getRow(index + 3).height = Math.min(
      409,
      Math.max(24, Math.ceil(value.length / 220) * 16),
    );
  });
  details.getRow(FIRST_ROW - 1).values = [
    "STT",
    "Mã thanh toán",
    "Mã đơn",
    "Khách hàng",
    "Số điện thoại",
    "Mã chi nhánh",
    "Chi nhánh",
    "Nguồn đơn",
    "Phương thức",
    "Trạng thái",
    "Số tiền (VND)",
    "Mã giao dịch ngân hàng",
    "Thời gian giao dịch",
  ];
  styleHeader(details.getRow(FIRST_ROW - 1), widths.length);

  snapshot.payments.forEach((payment, index) => {
    const values = [
      index + 1,
      String(payment.id),
      String(payment.orderId),
      text(payment.order.receiverName),
      text(payment.order.receiverPhone || ""),
      text(payment.order.branch.code),
      text(payment.order.branch.name),
      payment.order.channel === "POS" ? "Tại quầy" : "Online",
      getPaymentMethodLabel(payment),
      paymentStatusLabels[payment.status],
      amounts[index],
      text(payment.transactionCode || ""),
      toPaymentExcelDate(
        payment.paidAt || payment.createdAt,
        snapshot.timeZone,
      ),
    ];
    const row = details.getRow(FIRST_ROW + index);
    row.values = values;
    const lineCount = Math.max(
      ...values.map((value, col) =>
        typeof value === "string"
          ? value
              .split(/\r?\n/)
              .reduce(
                (total, line) =>
                  total +
                  Math.max(1, Math.ceil(line.length / (widths[col] - 3))),
                0,
              )
          : 1,
      ),
    );
    row.height = Math.min(409, Math.max(32, lineCount * 16 + 8));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: "Arial", size: 11, color: { argb: colors.text } };
      cell.fill = fill(index % 2 ? colors.cream : "FFFFFFFF");
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: col === 1 ? "center" : col === 11 ? "right" : "left",
        indent: col === 1 ? 0 : 1,
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: colors.border } },
      };
      cell.numFmt =
        col === 11
          ? MONEY_FORMAT
          : col === 13
            ? DATE_FORMAT
            : col === 1
              ? "0"
              : "@";
    });
  });
  const lastRow = FIRST_ROW + snapshot.payments.length - 1;
  details.autoFilter = `A${FIRST_ROW - 1}:M${lastRow}`;
  const statusColors = [
    ["PAID", "FFEAF7EF", colors.green],
    ["PENDING", "FFFFF6DD", "FF8A6400"],
    ["FAILED", "FFFDEDED", "FFB13C3C"],
    ["CANCELLED", "FFF1EEEB", colors.muted],
  ] as const;
  statusColors.forEach(([status, bg, fg], index) => {
    details.addConditionalFormatting({
      ref: `J${FIRST_ROW}:J${lastRow}`,
      rules: [
        {
          type: "expression",
          priority: index + 1,
          formulae: [`J${FIRST_ROW}="${paymentStatusLabels[status]}"`],
          style: { fill: fill(bg), font: { color: { argb: fg } } },
        },
      ],
    });
  });

  for (let row = 1; row <= 34; row += 1) {
    overview.getRow(row).height = 25;
    for (let col = 1; col <= 3; col += 1) {
      const cell = overview.getCell(row, col);
      cell.font = { name: "Arial", size: 11, color: { argb: colors.text } };
      cell.alignment = { vertical: "middle", wrapText: true };
    }
  }
  band(overview, "A1:C2", "KIPPORA - BÁO CÁO THANH TOÁN");
  overview.getCell("A1").font = {
    name: "Arial",
    size: 18,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  overview.mergeCells("A3:C3");
  overview.getCell("A3").value =
    "Báo cáo đối soát nội bộ theo bộ lọc tại thời điểm xuất";
  const info: [string, string | Date][] = [
    ["Từ ngày", from || "Không giới hạn"],
    ["Đến ngày", to || "Không giới hạn"],
    ["Chi nhánh", text(snapshot.branchLabel)],
    ["Phương thức", paymentMethodLabels[snapshot.filters.method]],
    [
      "Trạng thái",
      snapshot.filters.status === "ALL"
        ? "Tất cả trạng thái"
        : paymentStatusLabels[snapshot.filters.status],
    ],
    ["Từ khóa tìm kiếm", text(snapshot.filters.search.trim() || "Không có")],
    ["Thời điểm xuất", exportedAt],
    ["Múi giờ", snapshot.timeZone],
  ];
  info.forEach(([label, value], index) => {
    const row = index + 5;
    overview.getCell(row, 1).value = label;
    overview.getCell(row, 1).font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: colors.muted },
    };
    overview.mergeCells(row, 2, row, 3);
    overview.getCell(row, 2).value = value;
    overview.getCell(row, 2).numFmt =
      value instanceof Date ? (index === 6 ? DATE_FORMAT : "dd/mm/yyyy") : "@";
    if (typeof value === "string")
      overview.getRow(row).height = Math.min(
        409,
        Math.max(25, Math.ceil(value.length / 50) * 16 + 6),
      );
  });

  const ref = (col: string) =>
    `'${DETAIL_SHEET}'!$${col}$${FIRST_ROW}:$${col}$${lastRow}`;
  const statuses = ["PAID", "PENDING", "FAILED", "CANCELLED"] as const;
  const sumFor = (predicate: (index: number) => boolean) =>
    amounts.reduce(
      (total, value, index) =>
        total + (predicate(index) ? Math.round(value * 100) : 0),
      0,
    ) / 100;
  const formula = (
    cell: string,
    expression: string,
    result: number,
    currency = false,
  ) => {
    overview.getCell(cell).value = { formula: expression, result };
    overview.getCell(cell).numFmt = currency ? MONEY_FORMAT : "#,##0";
    overview.getCell(cell).alignment = {
      horizontal: "right",
      vertical: "middle",
    };
  };
  band(overview, "A14:C14", "TỔNG QUAN THEO TRẠNG THÁI");
  overview.getRow(15).values = ["Trạng thái", "Số giao dịch", "Số tiền (VND)"];
  styleHeader(overview.getRow(15), 3);
  statuses.forEach((status, index) => {
    const row = index + 16;
    overview.getCell(`A${row}`).value = paymentStatusLabels[status];
    const count = snapshot.payments.filter(
      (payment) => payment.status === status,
    ).length;
    formula(`B${row}`, `COUNTIF(${ref("J")},A${row})`, count);
    formula(
      `C${row}`,
      `ROUND(SUMIF(${ref("J")},A${row},${ref("K")}),2)`,
      sumFor((i) => snapshot.payments[i].status === status),
      true,
    );
  });
  overview.getRow(16).eachCell((cell) => {
    cell.fill = fill("FFEAF7EF");
    cell.font = {
      name: "Arial",
      size: 12,
      bold: true,
      color: { argb: colors.green },
    };
  });
  overview.getCell("A20").value = "Tổng giao dịch (mọi trạng thái)";
  overview.getRow(20).height = 33;
  formula("B20", "SUM(B16:B19)", snapshot.payments.length);
  formula(
    "C20",
    "ROUND(SUM(C16:C19),2)",
    sumFor(() => true),
    true,
  );
  band(overview, "A22:C22", "ĐÃ THU THEO PHƯƠNG THỨC");
  overview.getRow(23).values = ["Phương thức", "Số giao dịch", "Số tiền (VND)"];
  styleHeader(overview.getRow(23), 3);
  (["CASH", "COD", "BANK_TRANSFER"] as const).forEach((method, index) => {
    const row = index + 24;
    overview.getCell(`A${row}`).value = paymentMethodLabels[method];
    const matches = (i: number) =>
      snapshot.payments[i].status === "PAID" &&
      getPaymentMethodKey(snapshot.payments[i]) === method;
    formula(
      `B${row}`,
      `COUNTIFS(${ref("J")},$A$16,${ref("I")},A${row})`,
      snapshot.payments.filter((_, i) => matches(i)).length,
    );
    formula(
      `C${row}`,
      `ROUND(SUMIFS(${ref("K")},${ref("J")},$A$16,${ref("I")},A${row}),2)`,
      sumFor(matches),
      true,
    );
  });
  overview.getCell("A27").value = "TỔNG ĐÃ THU";
  formula("B27", "SUM(B24:B26)", summary.paidCount);
  formula("C27", "ROUND(SUM(C24:C26),2)", summary.collectedAmount, true);
  overview.getRow(27).height = 34;
  overview.getRow(27).eachCell((cell) => {
    cell.fill = fill(colors.cream);
    cell.font = {
      name: "Arial",
      size: 13,
      bold: true,
      color: { argb: colors.brown },
    };
  });
  overview.getCell("A28").value = "Chênh lệch đối soát (cần bằng 0)";
  overview.getRow(28).height = 34;
  formula("C28", "ROUND(C27-C16,2)", 0, true);
  overview.addConditionalFormatting({
    ref: "C28",
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: ["C28<>0"],
        style: {
          fill: fill("FFFDEDED"),
          font: { color: { argb: "FFB13C3C" } },
        },
      },
    ],
  });
  overview.mergeCells("A30:C31");
  overview.getCell("A30").value =
    "Tổng đã thu chỉ tính giao dịch Đã thanh toán. Giao dịch chờ, thất bại và đã hủy không được cộng vào số tiền đã thu.";
  overview.mergeCells("A33:C34");
  overview.getCell("A33").value =
    "Nguồn: Quản lý thanh toán Kippora tại thời điểm xuất. Công thức tính trên toàn bộ dữ liệu đã xuất; lọc thêm trong Excel không thay đổi phạm vi tổng quan. File không tự đồng bộ lại với hệ thống.";
  overview.getCell("A33").font = {
    name: "Arial",
    size: 10,
    color: { argb: colors.muted },
  };
  return workbook;
}

export async function downloadPaymentReportExcel(
  snapshot: PaymentReportSnapshot,
) {
  const workbook = buildPaymentReportExcel(snapshot);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const period =
    [snapshot.filters.dateFrom, snapshot.filters.dateTo]
      .filter(Boolean)
      .join("_") || "tat-ca";
  const link = document.createElement("a");
  link.href = url;
  link.download = `kippora-thanh-toan_${period}_${snapshot.generatedAt.getTime()}.xlsx`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
