import ExcelJS from "exceljs";

import type { PurchaseOrder } from "@/types/inventory";
import { purchaseOrderStatusLabels } from "@/components/inventory/purchase-order-detail-modal";

const units = { GRAM: "g", MILLILITER: "ml", PIECE: "cái" } as const;

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}

export function buildPurchaseOrderExcel(order: PurchaseOrder) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kippora";
  workbook.created = new Date();
  workbook.title = `Đơn nhập hàng ${order.code}`;
  const sheet = workbook.addWorksheet("Đơn nhập hàng", {
    views: [{ state: "frozen", ySplit: 8, showGridLines: false }],
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  });
  sheet.columns = [
    { width: 6 },
    { width: 28 },
    { width: 11 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 16 },
    { width: 18 },
  ];
  sheet.mergeCells("A1:H2");
  const title = sheet.getCell("A1");
  title.value = "KIPPORA - ĐƠN ĐẶT NHÀ CUNG CẤP";
  title.fill = fill("FF4A2C20");
  title.font = {
    name: "Arial",
    size: 18,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  title.alignment = { vertical: "middle" };
  const info = [
    `${order.code} | ${order.branch.code} · ${order.branch.name}`,
    `Nhà cung cấp: ${order.supplier.name} | Dự kiến giao: ${formatDate(order.expectedAt)}`,
    `Người lập: ${order.createdBy.fullName || order.createdBy.email} | Trạng thái: ${purchaseOrderStatusLabels[order.status]}`,
    `Ghi chú: ${order.note || "Không có"}${order.reviewNote ? ` | Phản hồi Admin: ${order.reviewNote}` : ""}`,
  ];
  info.forEach((value, index) => {
    const row = index + 3;
    sheet.mergeCells(row, 1, row, 8);
    sheet.getCell(row, 1).value = value;
    sheet.getCell(row, 1).font = {
      name: "Arial",
      size: 10,
      color: { argb: "FF756C64" },
    };
    sheet.getCell(row, 1).alignment = { vertical: "middle", wrapText: true };
  });
  const header = sheet.getRow(8);
  header.values = [
    "STT",
    "Nguyên liệu",
    "Đơn vị",
    "Đề xuất",
    "Đã đặt",
    "Đã nhận",
    "Đơn giá",
    "Thành tiền",
  ];
  header.height = 30;
  header.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill("FF4A2C20");
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });
  order.items.forEach((item, index) => {
    const row = sheet.addRow([
      index + 1,
      item.ingredient.name,
      units[item.ingredient.unit],
      item.suggestedQuantity,
      item.orderedQuantity,
      item.receivedQuantity,
      item.unitCost,
      item.lineTotal,
    ]);
    row.height = 28;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF342B26" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: [1, 3, 4, 5, 6, 7, 8].includes(column) ? "center" : "left",
        wrapText: true,
      };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE7DBCF" } } };
      if ([4, 5, 6].includes(column)) cell.numFmt = "#,##0.###";
      if ([7, 8].includes(column)) cell.numFmt = "#,##0 [$₫-vi-VN]";
    });
  });
  const totalRow = sheet.addRow([
    null,
    "TỔNG GIÁ TRỊ DỰ KIẾN",
    null,
    null,
    null,
    null,
    null,
    order.totalCost,
  ]);
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill("FFFAF6F1");
    cell.font = { name: "Arial", bold: true, color: { argb: "FF4A2C20" } };
  });
  totalRow.getCell(8).numFmt = "#,##0 [$₫-vi-VN]";
  sheet.autoFilter = {
    from: "A8",
    to: `H${Math.max(8, 8 + order.items.length)}`,
  };
  sheet.headerFooter.oddFooter = `&LKippora&CTrang &P / &N&R${order.code}`;
  return workbook;
}

export async function downloadPurchaseOrderExcel(order: PurchaseOrder) {
  const workbook = buildPurchaseOrderExcel(order);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `kippora-don-nhap_${order.code}.xlsx`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
