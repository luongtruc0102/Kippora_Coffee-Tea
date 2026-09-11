import ExcelJS from "exceljs";

import type {
  InventoryCount,
  InventoryCountStatus,
  InventoryVarianceReason,
} from "@/types/inventory";

const colors = {
  brown: "FF4A2C20",
  cream: "FFFAF6F1",
  border: "FFE7DBCF",
  green: "FF22754A",
  red: "FFB13C3C",
  muted: "FF756C64",
};

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

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function buildInventoryCountExcel(count: InventoryCount) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kippora";
  workbook.created = new Date();
  workbook.title = `Phiếu kiểm kê ${count.code}`;

  const sheet = workbook.addWorksheet("Phiếu kiểm kê", {
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
    { width: 7 },
    { width: 29 },
    { width: 13 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 27 },
    { width: 34 },
  ];

  sheet.mergeCells("A1:H2");
  const title = sheet.getCell("A1");
  title.value = "KIPPORA - PHIẾU KIỂM KÊ KHO";
  title.fill = fill(colors.brown);
  title.font = {
    name: "Arial",
    size: 18,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  title.alignment = { vertical: "middle", horizontal: "left" };

  sheet.mergeCells("A3:H3");
  sheet.getCell("A3").value =
    `${count.code} | ${count.branch.code} · ${count.branch.name}`;
  sheet.mergeCells("A4:H4");
  sheet.getCell("A4").value =
    `Kiểm lúc ${formatDate(count.countedAt)} | Người lập: ${count.createdBy.fullName || count.createdBy.email} | ` +
    `Trạng thái: ${statusLabels[count.status]}`;
  sheet.mergeCells("A5:H5");
  sheet.getCell("A5").value = count.note
    ? `Ghi chú: ${count.note}`
    : "Ghi chú: Không có";
  sheet.mergeCells("A6:H6");
  sheet.getCell("A6").value = count.reviewNote
    ? `Phản hồi Admin: ${count.reviewNote}`
    : "Phản hồi Admin: Chưa có";
  for (let row = 3; row <= 6; row += 1) {
    sheet.getCell(row, 1).font = {
      name: "Arial",
      size: 10,
      color: { argb: colors.muted },
    };
    sheet.getCell(row, 1).alignment = { vertical: "middle", wrapText: true };
  }

  const header = sheet.getRow(8);
  header.values = [
    "STT",
    "Nguyên liệu",
    "Đơn vị",
    "Tồn hệ thống",
    "Đếm thực tế",
    "Chênh lệch",
    "Nguyên nhân",
    "Ghi chú",
  ];
  header.height = 30;
  header.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(colors.brown);
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });

  count.items.forEach((item, index) => {
    const row = sheet.addRow([
      index + 1,
      item.ingredient.name,
      unitLabels[item.ingredient.unit],
      item.expectedQuantity,
      item.countedQuantity,
      item.differenceQuantity,
      item.reason ? reasonLabels[item.reason] : "—",
      item.note || "—",
    ]);
    row.height = 28;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: "Arial", size: 10, color: { argb: "FF342B26" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: [1, 3, 4, 5, 6].includes(column) ? "center" : "left",
        wrapText: true,
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: colors.border } },
      };
      if ([4, 5, 6].includes(column)) cell.numFmt = "#,##0.###";
    });
    const differenceCell = row.getCell(6);
    differenceCell.font = {
      name: "Arial",
      size: 10,
      bold: Math.abs(item.differenceQuantity) > 0.0005,
      color: {
        argb:
          item.differenceQuantity < -0.0005
            ? colors.red
            : item.differenceQuantity > 0.0005
              ? colors.green
              : colors.muted,
      },
    };
  });

  const shortageCount = count.items.filter(
    (item) => item.differenceQuantity < -0.0005,
  ).length;
  const surplusCount = count.items.filter(
    (item) => item.differenceQuantity > 0.0005,
  ).length;
  const summaryRow = sheet.addRow([]);
  sheet.mergeCells(summaryRow.number, 1, summaryRow.number, 8);
  summaryRow.getCell(1).value =
    `Tổng ${count.items.length} nguyên liệu · Thiếu ${shortageCount} · Dư ${surplusCount} · Khớp ${count.items.length - shortageCount - surplusCount}`;
  summaryRow.getCell(1).fill = fill(colors.cream);
  summaryRow.getCell(1).font = {
    name: "Arial",
    size: 10,
    bold: true,
    color: { argb: colors.brown },
  };
  summaryRow.getCell(1).alignment = { vertical: "middle" };
  summaryRow.height = 30;

  sheet.autoFilter = {
    from: "A8",
    to: `H${Math.max(8, 8 + count.items.length)}`,
  };
  sheet.headerFooter.oddFooter = "&LKippora&CTrang &P / &N&R" + count.code;
  return workbook;
}

export async function downloadInventoryCountExcel(count: InventoryCount) {
  const workbook = buildInventoryCountExcel(count);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `kippora-kiem-ke_${count.code}.xlsx`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
