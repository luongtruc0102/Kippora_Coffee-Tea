/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node test harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

process.env.TZ = "Asia/Ho_Chi_Minh";

// Run the actual TypeScript report builder with the project's TypeScript,
// without adding a second runner/bundler or copying production logic.
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
  filterPayments,
  getPaymentMethodKey,
  summarizePayments,
} = require("../src/utils/payment.util.ts");
const { buildPaymentReportPdf } = require("../src/utils/payment-report-pdf.ts");

const allFilters = {
  search: "",
  branchId: "ALL",
  method: "ALL",
  status: "ALL",
  dateFrom: "",
  dateTo: "",
};
const branch = {
  id: 1,
  code: "MAIN",
  name: "Kippora - Chi nhánh Thủ Đức",
  address: null,
  phone: null,
};
function makePayment(id, overrides = {}) {
  const base = {
    id,
    orderId: 1000 + id,
    method: "COD",
    status: "PAID",
    amount: "100000.00",
    transactionCode: null,
    paidAt: "2026-08-29T10:00:00.000Z",
    createdAt: "2026-08-29T09:45:00.000Z",
    updatedAt: "2026-08-29T10:00:00.000Z",
    order: {
      id: 1000 + id,
      channel: "POS",
      receiverName: "Nguyễn Thị Ánh",
      receiverPhone: "0900000000",
      totalPrice: "100000.00",
      status: "COMPLETED",
      createdAt: "2026-08-29T09:45:00.000Z",
      user: {
        id: 1,
        email: "fixture@example.invalid",
        fullName: "Dữ liệu kiểm thử",
      },
      branch,
    },
  };
  return {
    ...base,
    ...overrides,
    order: { ...base.order, ...overrides.order },
  };
}

const payments = [
  makePayment(1),
  makePayment(2, {
    amount: "120000",
    order: { channel: "ONLINE", receiverName: "Đặng Quốc Bảo" },
  }),
  makePayment(3, {
    method: "BANK_TRANSFER",
    amount: "180000",
    transactionCode: "BANK-EXAMPLE-003",
  }),
  makePayment(4, {
    status: "PENDING",
    paidAt: null,
    amount: "60000",
    order: { status: "CONFIRMED" },
  }),
  makePayment(5, {
    status: "CANCELLED",
    paidAt: null,
    amount: "50000",
    order: { status: "CANCELLED" },
  }),
  makePayment(6, { status: "FAILED", paidAt: null, amount: "40000" }),
];
let assertions = 0;
function check(name, run) {
  run();
  assertions += 1;
  console.log(`PASS ${name}`);
}

check("paid totals exclude pending/failed/cancelled and include COD", () => {
  assert.deepEqual(summarizePayments(payments), {
    collectedAmount: 400000,
    cashAmount: 100000,
    codAmount: 120000,
    bankTransferAmount: 180000,
    pendingAmount: 60000,
    paidCount: 3,
    pendingCount: 1,
  });
});
check("decimal amounts add without floating-point drift", () => {
  assert.equal(
    summarizePayments([
      makePayment(1, { amount: "0.1" }),
      makePayment(2, { amount: "0.2" }),
    ]).collectedAmount,
    0.3,
  );
});
check("POS cash is distinct from online COD", () => {
  assert.equal(getPaymentMethodKey(payments[0]), "CASH");
  assert.equal(getPaymentMethodKey(payments[1]), "COD");
});
check(
  "date range uses paid date, with inclusive local midnight boundaries",
  () => {
    const sample = [
      makePayment(10, {
        createdAt: "2026-08-28T00:00:00Z",
        paidAt: "2026-08-28T17:00:00Z",
      }),
      makePayment(11, { paidAt: "2026-08-29T16:59:59Z" }),
      makePayment(12, { paidAt: "2026-08-29T17:00:00Z" }),
      makePayment(13, {
        status: "PENDING",
        paidAt: null,
        createdAt: "2026-08-28T17:00:00Z",
      }),
    ];
    assert.deepEqual(
      filterPayments(sample, {
        ...allFilters,
        dateFrom: "2026-08-29",
        dateTo: "2026-08-29",
      }).map((item) => item.id),
      [10, 11, 13],
    );
  },
);
check(
  "all filters combine and export contains no excluded transactions",
  () => {
    const filters = {
      ...allFilters,
      dateFrom: "2026-08-29",
      dateTo: "2026-08-29",
      method: "BANK_TRANSFER",
      status: "PAID",
      branchId: "1",
      search: "bank-example",
    };
    assert.deepEqual(
      filterPayments(payments, filters).map((item) => item.id),
      [3],
    );
    assert.equal(
      filterPayments(payments, { ...filters, branchId: "2" }).length,
      0,
    );
  },
);
check("invalid and open-ended date ranges", () => {
  assert.equal(
    filterPayments(payments, {
      ...allFilters,
      dateFrom: "2026-08-30",
      dateTo: "2026-08-29",
    }).length,
    0,
  );
  assert.equal(
    filterPayments(payments, { ...allFilters, dateTo: "2026-08-29" }).length,
    6,
  );
  assert.equal(
    filterPayments(payments, { ...allFilters, dateFrom: "2026-08-30" }).length,
    0,
  );
});

const font = fs
  .readFileSync(path.join(__dirname, "../public/fonts/DejaVuSans.ttf"))
  .toString("base64");
function snapshot(rows, filters = allFilters) {
  return {
    payments: rows,
    filters,
    branchLabel: "Tất cả chi nhánh",
    generatedAt: new Date("2026-08-30T03:15:00Z"),
    timeZone: "Asia/Ho_Chi_Minh",
  };
}
check(
  "empty, invalid range and invalid amounts do not produce misleading reports",
  () => {
    assert.throws(
      () => buildPaymentReportPdf(snapshot([]), font),
      /Không có giao dịch/,
    );
    assert.throws(
      () =>
        buildPaymentReportPdf(
          snapshot(payments, {
            ...allFilters,
            dateFrom: "2026-08-30",
            dateTo: "2026-08-29",
          }),
          font,
        ),
      /Ngày bắt đầu/,
    );
    assert.throws(
      () =>
        buildPaymentReportPdf(
          snapshot([makePayment(99, { amount: "bad" })]),
          font,
        ),
      /số tiền không hợp lệ/,
    );
  },
);

const output = path.join(__dirname, "../tmp/pdfs");
fs.mkdirSync(output, { recursive: true });
const cases = [
  {
    name: "payment-report-short",
    data: snapshot(payments.slice(0, 3), {
      ...allFilters,
      dateFrom: "2026-08-29",
      dateTo: "2026-08-29",
    }),
    singlePage: true,
  },
  {
    name: "payment-report-filtered",
    data: snapshot(
      filterPayments(payments, { ...allFilters, method: "BANK_TRANSFER" }),
      { ...allFilters, method: "BANK_TRANSFER" },
    ),
    singlePage: true,
  },
  {
    name: "payment-report-long",
    data: snapshot(
      Array.from({ length: 48 }, (_, i) =>
        makePayment(100 + i, {
          method: i % 2 ? "BANK_TRANSFER" : "COD",
          status: ["PAID", "PENDING", "CANCELLED", "FAILED"][i % 4],
          paidAt: i % 4 ? null : "2026-08-29T10:00:00Z",
          transactionCode:
            i % 2
              ? `REF-${100 + i}-VERYLONGREFERENCE01234567890123456789`
              : null,
          order: {
            receiverName:
              i % 3 ? "Trần Nguyễn Hoàng Phương Thảo" : "Đỗ Thị Ngọc Ánh",
            receiverPhone: i % 5 ? "0900000000" : "",
            branch: {
              ...branch,
              name: "Kippora - Chi nhánh Nguyễn Thị Minh Khai, Thành phố Hồ Chí Minh",
            },
          },
        }),
      ),
    ),
  },
  {
    name: "payment-report-tall-row",
    data: snapshot([
      makePayment(999, {
        order: {
          receiverName:
            "Tên rất dài để thử ngắt dòng an toàn. ".repeat(65) +
            "KẾT THÚC TÊN",
        },
      }),
    ]),
  },
];

for (const item of cases) {
  check(
    `PDF ${item.name}: portrait A4 on every page, Vietnamese font, page count, immutable data`,
    () => {
      const before = JSON.stringify(item.data);
      const doc = buildPaymentReportPdf(item.data, font);
      const bytes = Buffer.from(doc.output("arraybuffer"));
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.ok(bytes.length > 5000);
      for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
        doc.setPage(page);
        assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.1);
        assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 297) < 0.1);
      }
      if (item.singlePage) assert.equal(doc.getNumberOfPages(), 1);
      else assert.ok(doc.getNumberOfPages() > 1);
      assert.equal(JSON.stringify(item.data), before);
      fs.writeFileSync(path.join(output, `${item.name}.pdf`), bytes);
      console.log(
        `  ${doc.getNumberOfPages()} page(s), ${item.data.payments.length} transaction(s)`,
      );
    },
  );
}

console.log(`${assertions} checks passed. Synthetic QA PDFs: ${output}`);
