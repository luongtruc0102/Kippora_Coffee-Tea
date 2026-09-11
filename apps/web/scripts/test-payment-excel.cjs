/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const ExcelJS = require("exceljs");

process.env.TZ = "Asia/Ho_Chi_Minh";
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const {
  buildPaymentReportExcel,
  downloadPaymentReportExcel,
  toPaymentExcelDate,
} = require("../src/utils/payment-report-excel.ts");
const {
  filterPayments,
  summarizePayments,
} = require("../src/utils/payment.util.ts");

const filters = {
  search: "",
  branchId: "ALL",
  method: "ALL",
  status: "ALL",
  dateFrom: "2026-08-29",
  dateTo: "2026-08-29",
};
function payment(id, overrides = {}) {
  const base = {
    id,
    orderId: 1000 + id,
    amount: "100000.25",
    method: "COD",
    status: "PAID",
    transactionCode: null,
    createdAt: "2026-08-29T09:00:00Z",
    paidAt: "2026-08-29T10:00:00Z",
    updatedAt: "2026-08-29T10:00:00Z",
    order: {
      id: 1000 + id,
      channel: "POS",
      receiverName: "Nguyễn Thị Ánh",
      receiverPhone: "0123456789",
      totalPrice: "100000.25",
      status: "COMPLETED",
      createdAt: "2026-08-29T09:00:00Z",
      user: {
        id: 1,
        fullName: "Khách kiểm thử",
        email: "fixture@example.invalid",
      },
      branch: {
        id: 1,
        code: "MAIN",
        name: "Kippora - Chi nhánh Thủ Đức",
        address: null,
        phone: null,
      },
    },
  };
  return {
    ...base,
    ...overrides,
    order: { ...base.order, ...overrides.order },
  };
}
const rows = [
  payment(1),
  payment(2, {
    amount: "120000.25",
    order: { channel: "ONLINE", receiverName: "Đặng Quốc Bảo" },
  }),
  payment(3, {
    amount: "180000",
    method: "BANK_TRANSFER",
    transactionCode: "0000123456",
    order: {
      receiverName: "Trần Phương Thảo",
      branch: {
        id: 2,
        code: "Q1",
        name: "Kippora - Quận 1",
        address: null,
        phone: null,
      },
    },
  }),
  payment(4, { amount: "60000", status: "PENDING", paidAt: null }),
  payment(5, { amount: "50000", status: "CANCELLED", paidAt: null }),
  payment(6, { amount: "40000", status: "FAILED", paidAt: null }),
];
function snapshot(payments = rows, selected = filters) {
  return {
    payments,
    filters: selected,
    branchLabel: "Tất cả chi nhánh",
    generatedAt: new Date("2026-08-30T03:15:00Z"),
    timeZone: "Asia/Ho_Chi_Minh",
  };
}
const tests = [];
const test = (name, run) => tests.push({ name, run });
const data = snapshot();
const before = JSON.stringify(data);
const workbook = buildPaymentReportExcel(data);
const summary = workbook.getWorksheet("Tổng quan");
const details = workbook.getWorksheet("Chi tiết giao dịch");

test("two sheets, full data, and immutable input", () => {
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Tổng quan", "Chi tiết giao dịch"],
  );
  assert.equal(details.rowCount, rows.length + 7);
  assert.equal(JSON.stringify(data), before);
});
test("currency is numeric; phone, IDs and bank references preserve leading zeros", () => {
  assert.equal(details.getCell("K8").value, 100000.25);
  assert.equal(details.getCell("E8").value, "0123456789");
  assert.equal(details.getCell("B8").value, "1");
  assert.equal(details.getCell("L10").value, "0000123456");
  assert.equal(details.getCell("E8").numFmt, "@");
  assert.match(details.getCell("K8").numFmt, /#,##0\.00/);
});
test("summary matches the web totals and excludes unpaid states from collected money", () => {
  const expected = summarizePayments(rows);
  assert.equal(summary.getCell("C16").result, expected.collectedAmount);
  assert.equal(summary.getCell("C17").result, expected.pendingAmount);
  assert.equal(summary.getCell("C18").result, 40000);
  assert.equal(summary.getCell("C19").result, 50000);
  assert.equal(summary.getCell("C24").result, expected.cashAmount);
  assert.equal(summary.getCell("C25").result, expected.codAmount);
  assert.equal(summary.getCell("C26").result, expected.bankTransferAmount);
  assert.equal(summary.getCell("C27").result, 400000.5);
  assert.equal(summary.getCell("C28").result, 0);
  assert.equal(summary.getCell("B20").result, rows.length);
});
test("summary formulas reference visible criteria and bounded detail ranges", () => {
  assert.equal(
    summary.getCell("C16").formula,
    "ROUND(SUMIF('Chi tiết giao dịch'!$J$8:$J$13,A16,'Chi tiết giao dịch'!$K$8:$K$13),2)",
  );
  assert.match(summary.getCell("C24").formula, /SUMIFS\(.*\$A\$16.*A24/);
  assert.equal(workbook.calcProperties.fullCalcOnLoad, true);
  assert.equal(summary.getCell("C27").formula, "ROUND(SUM(C24:C26),2)");
});
test("filters export only matching rows and record selected criteria", () => {
  const selected = {
    ...filters,
    branchId: "2",
    method: "BANK_TRANSFER",
    status: "PAID",
    search: "000012",
  };
  const filtered = filterPayments(rows, selected);
  const report = buildPaymentReportExcel({
    ...snapshot(filtered, selected),
    branchLabel: "Q1 - Kippora - Quận 1",
  });
  const sheet = report.getWorksheet("Chi tiết giao dịch");
  assert.equal(sheet.rowCount, 8);
  assert.equal(sheet.getCell("B8").value, "3");
  assert.equal(report.getWorksheet("Tổng quan").getCell("B10").value, "000012");
  assert.equal(report.getWorksheet("Tổng quan").getCell("C27").result, 180000);
});
test("paid time is used, with creation time as fallback and real date cells", () => {
  assert.ok(details.getCell("M8").value instanceof Date);
  assert.equal(
    details.getCell("M8").value.toISOString(),
    "2026-08-29T17:00:00.000Z",
  );
  assert.equal(
    details.getCell("M11").value.toISOString(),
    "2026-08-29T16:00:00.000Z",
  );
  assert.equal(
    summary.getCell("B5").value.toISOString(),
    "2026-08-29T00:00:00.000Z",
  );
  assert.equal(
    summary.getCell("B11").value.toISOString(),
    "2026-08-30T10:15:00.000Z",
  );
  assert.equal(summary.getCell("B12").value, "Asia/Ho_Chi_Minh");
});
test("dates remain correct across local midnight and negative UTC offsets", () => {
  assert.equal(
    toPaymentExcelDate(
      "2026-08-28T17:00:00Z",
      "Asia/Ho_Chi_Minh",
    ).toISOString(),
    "2026-08-29T00:00:00.000Z",
  );
  assert.equal(
    toPaymentExcelDate(
      "2026-08-29T01:00:00Z",
      "America/New_York",
    ).toISOString(),
    "2026-08-28T21:00:00.000Z",
  );
});
test("formula-like user text is literal and never becomes a spreadsheet formula", () => {
  for (const value of [
    '=HYPERLINK("https://example.invalid","test")',
    "+SUM(1,2)",
    "-1+2",
    "@SUM(1,2)",
    "\t=1+1",
  ]) {
    const book = buildPaymentReportExcel(
      snapshot([
        payment(1, { transactionCode: value, order: { receiverName: value } }),
      ]),
    );
    const sheet = book.getWorksheet("Chi tiết giao dịch");
    for (const address of ["D8", "L8"]) {
      assert.equal(sheet.getCell(address).value, value);
      assert.equal(sheet.getCell(address).type, ExcelJS.ValueType.String);
      assert.equal(sheet.getCell(address).formula, undefined);
    }
  }
});
test("frozen headings, filters and dynamic status formatting cover all rows", () => {
  assert.equal(details.autoFilter, "A7:M13");
  assert.equal(details.views[0].ySplit, 7);
  assert.equal(details.views[0].xSplit, 3);
  assert.equal(details.conditionalFormattings.length, 4);
  assert.ok(
    details.conditionalFormattings.every((item) => item.ref === "J8:J13"),
  );
});
test("empty data, invalid ranges/dates, and invalid money fail explicitly", () => {
  assert.throws(
    () => buildPaymentReportExcel(snapshot([])),
    /Không có giao dịch/,
  );
  assert.throws(
    () =>
      buildPaymentReportExcel(
        snapshot(rows, { ...filters, dateFrom: "2026-08-30" }),
      ),
    /Ngày bắt đầu/,
  );
  assert.throws(
    () =>
      buildPaymentReportExcel(
        snapshot(rows, { ...filters, dateFrom: "2026-02-31", dateTo: "" }),
      ),
    /Ngày lọc/,
  );
  assert.throws(
    () =>
      buildPaymentReportExcel(snapshot([payment(1, { paidAt: "invalid" })])),
    /thời gian không hợp lệ/,
  );
  for (const amount of ["", " ", "bad", -1, Infinity, 1e30]) {
    assert.throws(
      () => buildPaymentReportExcel(snapshot([payment(1, { amount })])),
      /số tiền không hợp lệ/,
    );
  }
});
test("zero and fractional money remain accurate", () => {
  const book = buildPaymentReportExcel(
    snapshot([
      payment(1, { amount: "0.1" }),
      payment(2, { amount: "0.2" }),
      payment(3, { amount: "0" }),
    ]),
  );
  assert.equal(book.getWorksheet("Tổng quan").getCell("C27").result, 0.3);
});
test("long customer names wrap without altering content", () => {
  const value = "Nguyễn Thị Ánh và Trần Phương Thảo ".repeat(5);
  const book = buildPaymentReportExcel(
    snapshot([payment(1, { order: { receiverName: value } })]),
  );
  const sheet = book.getWorksheet("Chi tiết giao dịch");
  assert.equal(sheet.getCell("D8").value, value);
  assert.ok(sheet.getRow(8).height > 50);
  assert.throws(
    () =>
      buildPaymentReportExcel(
        snapshot([payment(1, { order: { receiverName: "x".repeat(32768) } })]),
      ),
    /giới hạn ô Excel/,
  );
});
test("large exports include their first and last records in formulas and filters", async () => {
  const large = buildPaymentReportExcel(
    snapshot(Array.from({ length: 1200 }, (_, i) => payment(i + 1))),
  );
  const sheet = large.getWorksheet("Chi tiết giao dịch");
  assert.equal(sheet.getCell("B1207").value, "1200");
  assert.equal(sheet.autoFilter, "A7:M1207");
  assert.match(
    large.getWorksheet("Tổng quan").getCell("C16").formula,
    /\$K\$1207/,
  );
  const bytes = await large.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  assert.equal(
    reopened.getWorksheet("Chi tiết giao dịch").getCell("B1207").value,
    "1200",
  );
});
test("xlsx roundtrip preserves dates, currency, IDs, formulas and cached totals", async () => {
  const bytes = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  const sheet = reopened.getWorksheet("Chi tiết giao dịch");
  assert.equal(sheet.getCell("E8").value, "0123456789");
  assert.equal(sheet.getCell("L10").value, "0000123456");
  assert.equal(sheet.getCell("K8").value, 100000.25);
  assert.equal(
    sheet.getCell("M8").value.toISOString(),
    "2026-08-29T17:00:00.000Z",
  );
  assert.equal(
    reopened.getWorksheet("Tổng quan").getCell("C27").result,
    400000.5,
  );
  const output = path.join(__dirname, "../tmp/spreadsheets");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, "payment-report-qa.xlsx"),
    Buffer.from(bytes),
  );
});
test("the browser ExcelJS bundle serializes the same report successfully", async () => {
  const BrowserExcelJS = require("exceljs/dist/exceljs.min.js");
  const browserWorkbook = new BrowserExcelJS.Workbook();
  browserWorkbook.model = workbook.model;
  const bytes = await browserWorkbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  assert.equal(reopened.worksheets.length, 2);
  assert.equal(
    reopened.getWorksheet("Tổng quan").getCell("C27").result,
    400000.5,
  );
  assert.equal(
    reopened.getWorksheet("Chi tiết giao dịch").getCell("E8").value,
    "0123456789",
  );
});

test("download creates a real xlsx, then removes its link and releases the URL", async () => {
  const original = {
    document: global.document,
    window: global.window,
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  };
  let blob;
  let cleanup;
  let clicks = 0;
  let removed = false;
  let revoked = false;
  const link = {
    href: "",
    download: "",
    click() {
      clicks += 1;
    },
    remove() {
      removed = true;
    },
  };
  global.document = {
    createElement: () => link,
    body: { appendChild: (item) => assert.equal(item, link) },
  };
  global.window = {
    setTimeout: (callback) => {
      cleanup = callback;
    },
  };
  URL.createObjectURL = (value) => {
    blob = value;
    return "blob:test-export";
  };
  URL.revokeObjectURL = (value) => {
    assert.equal(value, "blob:test-export");
    revoked = true;
  };
  try {
    await downloadPaymentReportExcel(data);
    assert.equal(clicks, 1);
    assert.equal(removed, true);
    assert.match(
      link.download,
      /^kippora-thanh-toan_2026-08-29_2026-08-29_\d+\.xlsx$/,
    );
    assert.equal(
      blob.type,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(Buffer.from(await blob.arrayBuffer()));
    assert.equal(reopened.worksheets.length, 2);
    cleanup();
    assert.equal(revoked, true);
  } finally {
    global.document = original.document;
    global.window = original.window;
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  }
});

(async () => {
  for (const item of tests) {
    await item.run();
    console.log(`PASS ${item.name}`);
  }
  console.log(
    `${tests.length} checks passed. Synthetic workbook: tmp/spreadsheets/payment-report-qa.xlsx`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
