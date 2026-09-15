import ExcelJS from "exceljs";
import type { ProfitabilityReport } from "@/types/profitability";

const MONEY_FORMAT = '#,##0 "₫"';
const colors = {
  brown: "FF4A2C20",
  cream: "FFFAF6F1",
  border: "FFE7DBCF",
  green: "FF207A55",
  red: "FFB13C3C",
  muted: "FF756C64",
};

function safeText(value: string) {
  const clean = value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return /^[=+\-@]/.test(clean) ? `'${clean}` : clean;
}

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function title(sheet: ExcelJS.Worksheet, range: string, value: string) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  cell.value = value;
  cell.fill = fill(colors.brown);
  cell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  cell.alignment = { vertical: "middle" };
}

function header(row: ExcelJS.Row, columnCount: number) {
  row.height = 30;
  for (let index = 1; index <= columnCount; index += 1) {
    const cell = row.getCell(index);
    cell.fill = fill(colors.brown);
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

function styleRows(sheet: ExcelJS.Worksheet, from: number, to: number) {
  for (let rowIndex = from; rowIndex <= to; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(rowIndex % 2 ? "FFFFFFFF" : colors.cream);
      cell.font = { name: "Arial", size: 10, color: { argb: "FF2A211D" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: colors.border } } };
    });
  }
}

export function buildProfitabilityReportExcel(
  report: ProfitabilityReport,
  branchLabel: string,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kippora";
  workbook.created = new Date(report.generatedAt);
  workbook.title = "Kippora - Báo cáo lợi nhuận";

  const overview = workbook.addWorksheet("Tổng quan", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  overview.columns = [{ width: 34 }, { width: 23 }, { width: 50 }];
  title(overview, "A1:C2", "KIPPORA - BÁO CÁO GIÁ VỐN & LỢI NHUẬN");
  overview.getCell("A4").value = "Phạm vi";
  overview.getCell("B4").value = `${report.filters.from} đến ${report.filters.to}`;
  overview.getCell("A5").value = "Chi nhánh";
  overview.getCell("B5").value = safeText(branchLabel);
  overview.getCell("A6").value = "Xuất lúc";
  overview.getCell("B6").value = new Date(report.generatedAt);
  overview.getCell("B6").numFmt = "dd/mm/yyyy hh:mm";
  overview.getRow(8).values = ["Chỉ tiêu", "Số tiền", "Diễn giải"];
  header(overview.getRow(8), 3);
  const metrics = [
    ["Doanh thu đã thu", report.summary.grossRevenue, report.accountingBasis.revenue],
    ["Hoàn tiền", -report.summary.refunds, report.accountingBasis.refunds],
    ["Doanh thu thuần", report.summary.netRevenue, "Doanh thu đã thu trừ hoàn tiền"],
    ["Giá vốn nguyên liệu", -report.summary.cogs, report.accountingBasis.cogs],
    ["Lợi nhuận gộp", report.summary.grossProfit, `Biên gộp ${report.summary.grossMarginPercent}%`],
    ["Chi phí đã duyệt", -report.summary.approvedExpenses, report.accountingBasis.expenses],
    ["Chi phí lương", -report.summary.payroll, report.accountingBasis.payroll],
    ["Hao hụt kho", -report.summary.inventoryLoss, "Giá trị lô đã hủy/hư hỏng"],
    ["Lợi nhuận ròng", report.summary.netProfit, `Biên ròng ${report.summary.netMarginPercent}%`],
  ];
  metrics.forEach((item, index) => {
    const row = overview.getRow(9 + index);
    row.values = [safeText(String(item[0])), item[1], safeText(String(item[2]))];
    row.getCell(2).numFmt = MONEY_FORMAT;
    if (index === metrics.length - 1) {
      row.font = { name: "Arial", bold: true, color: { argb: report.summary.netProfit >= 0 ? colors.green : colors.red } };
    }
  });
  styleRows(overview, 9, 9 + metrics.length - 1);
  overview.getCell("A20").value = "Cảnh báo dữ liệu";
  overview.getCell("A20").font = { name: "Arial", bold: true, color: { argb: colors.brown } };
  overview.getCell("A21").value = `Phân bổ có giá 0: ${report.dataQuality.zeroCostAllocations}`;
  overview.getCell("A22").value = `Đơn đã thu nhưng chưa tiêu hao kho: ${report.dataQuality.paidOrdersWithoutConsumedInventory}`;
  overview.getCell("A23").value = `Kỳ lương nháp chưa tính: ${report.dataQuality.pendingPayrollPeriods}`;
  overview.getCell("A24").value = `Đơn cũ dùng giá ước tính: ${report.dataQuality.estimatedCostOrders}`;

  const branchSheet = workbook.addWorksheet("Theo chi nhánh", { views: [{ state: "frozen", ySplit: 1 }] });
  branchSheet.columns = [18, 32, 14, 20, 20, 20, 20, 20, 20, 20];
  branchSheet.addRow(["Mã", "Chi nhánh", "Đơn đã thu", "Doanh thu thuần", "Giá vốn", "Lãi gộp", "Chi phí", "Lương", "Hao hụt", "Lợi nhuận ròng"]);
  header(branchSheet.getRow(1), 10);
  report.branches.forEach((branch) => {
    branchSheet.addRow([
      safeText(branch.branchCode), safeText(branch.branchName), branch.paidOrders,
      branch.netRevenue, branch.cogs, branch.grossProfit, branch.approvedExpenses,
      branch.payroll, branch.inventoryLoss, branch.netProfit,
    ]);
  });
  styleRows(branchSheet, 2, report.branches.length + 1);
  for (let column = 4; column <= 10; column += 1) branchSheet.getColumn(column).numFmt = MONEY_FORMAT;

  const timeline = workbook.addWorksheet("Theo ngày", { views: [{ state: "frozen", ySplit: 1 }] });
  timeline.columns = [16, 20, 20, 20, 20, 20, 20, 20, 20];
  timeline.addRow(["Ngày", "Doanh thu", "Hoàn tiền", "Doanh thu thuần", "Giá vốn", "Lãi gộp", "Chi phí", "Lương + hao hụt", "Lợi nhuận ròng"]);
  header(timeline.getRow(1), 9);
  report.timeline.forEach((item) => {
    timeline.addRow([
      new Date(`${item.date}T00:00:00.000Z`), item.grossRevenue, item.refunds,
      item.netRevenue, item.cogs, item.grossProfit, item.approvedExpenses,
      item.payroll + item.inventoryLoss, item.netProfit,
    ]);
  });
  styleRows(timeline, 2, report.timeline.length + 1);
  timeline.getColumn(1).numFmt = "dd/mm/yyyy";
  for (let column = 2; column <= 9; column += 1) timeline.getColumn(column).numFmt = MONEY_FORMAT;

  const products = workbook.addWorksheet("Lợi nhuận từng món", { views: [{ state: "frozen", ySplit: 1 }] });
  products.columns = [12, 32, 14, 14, 20, 20, 20, 16, 20, 22];
  products.addRow(["Mã món", "Tên món", "Số ly bán", "Số đơn", "Doanh thu thuần", "Giá vốn", "Lãi gộp", "Biên lãi", "Nguồn giá vốn", "Đánh giá"]);
  header(products.getRow(1), 10);
  report.products.forEach((product) => {
    products.addRow([
      product.productId,
      safeText(product.productName),
      product.quantitySold,
      product.orderCount,
      product.netRevenue,
      product.cogs,
      product.grossProfit,
      product.grossMarginPercent / 100,
      product.costSource === "LOT"
        ? "Theo lô thực tế"
        : product.costSource === "ESTIMATED"
          ? "Giá lô ước tính"
          : product.costSource === "MIXED"
            ? "Thực tế và ước tính"
            : "Thiếu dữ liệu",
      product.status === "HEALTHY"
        ? "Lãi tốt"
        : product.status === "LOW_MARGIN"
          ? "Lãi thấp"
          : product.status === "LOSS"
            ? "Đang lỗ"
            : "Thiếu giá vốn",
    ]);
  });
  styleRows(products, 2, report.products.length + 1);
  for (let column = 5; column <= 7; column += 1) products.getColumn(column).numFmt = MONEY_FORMAT;
  products.getColumn(8).numFmt = "0.00%";

  const productIngredients = workbook.addWorksheet("Giá vốn nguyên liệu món", { views: [{ state: "frozen", ySplit: 1 }] });
  productIngredients.columns = [12, 30, 28, 14, 18, 20, 16];
  productIngredients.addRow(["Mã món", "Tên món", "Nguyên liệu", "Đơn vị", "Lượng đã dùng", "Thành tiền", "Tỷ trọng"]);
  header(productIngredients.getRow(1), 7);
  report.products.forEach((product) => {
    product.ingredients.forEach((ingredient) => {
      productIngredients.addRow([
        product.productId,
        safeText(product.productName),
        safeText(ingredient.ingredientName),
        ingredient.unit === "GRAM" ? "g" : ingredient.unit === "MILLILITER" ? "ml" : ingredient.unit === "PIECE" ? "cái" : safeText(ingredient.unit),
        ingredient.quantity,
        ingredient.costAmount,
        ingredient.costSharePercent / 100,
      ]);
    });
  });
  styleRows(productIngredients, 2, Math.max(1, productIngredients.rowCount));
  productIngredients.getColumn(5).numFmt = "#,##0.000";
  productIngredients.getColumn(6).numFmt = MONEY_FORMAT;
  productIngredients.getColumn(7).numFmt = "0.00%";

  const orders = workbook.addWorksheet("Chi tiết đơn", { views: [{ state: "frozen", ySplit: 1 }] });
  orders.columns = [12, 15, 30, 15, 21, 20, 20, 20, 17, 22];
  orders.addRow(["Mã đơn", "Mã CN", "Chi nhánh", "Nguồn", "Ngày thu", "Doanh thu", "Hoàn tiền", "Giá vốn", "Lãi sau hoàn", "Cảnh báo"]);
  header(orders.getRow(1), 10);
  report.orders.forEach((order) => {
    orders.addRow([
      order.orderId, safeText(order.branchCode), safeText(order.branchName),
      order.channel === "POS" ? "Tại quầy" : "Online", new Date(order.paidAt),
      order.grossRevenue, order.refundedAmount, order.cogs, order.grossProfit,
      order.unpricedAllocations
        ? `${order.unpricedAllocations} nguyên liệu giá 0`
        : order.costSource === "ESTIMATED"
          ? "Giá vốn ước tính từ lô gần nhất"
          : order.costSource === "MISSING"
            ? "Thiếu dữ liệu giá vốn"
            : "Theo lô thực tế",
    ]);
  });
  styleRows(orders, 2, report.orders.length + 1);
  orders.getColumn(5).numFmt = "dd/mm/yyyy hh:mm";
  for (let column = 6; column <= 9; column += 1) orders.getColumn(column).numFmt = MONEY_FORMAT;
  return workbook;
}

export async function downloadProfitabilityReportExcel(
  report: ProfitabilityReport,
  branchLabel: string,
) {
  const workbook = buildProfitabilityReportExcel(report, branchLabel);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const url = URL.createObjectURL(new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `kippora-loi-nhuan_${report.filters.from}_${report.filters.to}.xlsx`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
