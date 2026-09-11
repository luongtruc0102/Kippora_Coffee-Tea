/* eslint-disable @typescript-eslint/no-require-imports -- Standalone render checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

require.extensions[".tsx"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
const UserDetailModal =
  require("../src/components/admin/user-detail-modal.tsx").default;
const employee = {
  id: 20,
  email: "employee@example.invalid",
  fullName: "Nhân viên kiểm thử",
  avatarUrl: null,
  phone: "0123456789",
  address: null,
  loyaltyPoints: 0,
  isActive: true,
  role: { name: "STAFF" },
  createdAt: "2026-08-29T01:00:00Z",
  updatedAt: "2026-08-29T01:00:00Z",
  totalWorkedSeconds: 34225,
};
const render = (overrides = {}, open = true) =>
  renderToStaticMarkup(
    React.createElement(UserDetailModal, {
      open,
      user: { ...employee, ...overrides },
      onClose() {},
    }),
  );
let checks = 0;
function check(name, run) {
  run();
  checks += 1;
  console.log(`PASS ${name}`);
}
check(
  "staff detail displays hours, minutes and seconds with the counting rule",
  () => {
    const html = render();
    assert.ok(html.includes("Tổng thời gian làm"));
    assert.ok(html.includes("9 giờ 30 phút 25 giây"));
    assert.ok(html.includes("Tổng các ca đã kết thúc ở tất cả chi nhánh"));
    assert.ok(html.includes("Thông tin mua hàng"));
  },
);
check("manager detail also displays completed work time", () => {
  assert.ok(
    render({ role: { name: "BRANCH_MANAGER" } }).includes(
      "9 giờ 30 phút 25 giây",
    ),
  );
});
check("a new employee shows zero, not missing data", () => {
  assert.ok(render({ totalWorkedSeconds: 0 }).includes("0 giờ 0 phút 0 giây"));
});
check("large totals do not reset after 24 hours", () => {
  assert.ok(
    render({ totalWorkedSeconds: 100 * 3600 + 125.8 }).includes(
      "100 giờ 2 phút 5 giây",
    ),
  );
});
check("missing or invalid data is not presented as zero work time", () => {
  for (const totalWorkedSeconds of [undefined, NaN, Infinity]) {
    assert.ok(render({ totalWorkedSeconds }).includes("Chưa có dữ liệu"));
  }
});
check("negative time cannot be displayed", () => {
  assert.ok(
    render({ totalWorkedSeconds: -30 }).includes("0 giờ 0 phút 0 giây"),
  );
});
check("customer and admin detail do not show employee work information", () => {
  for (const name of ["USER", "ADMIN"]) {
    assert.ok(!render({ role: { name } }).includes("Thông tin làm việc"));
  }
});
check("closed modal has no content", () => {
  assert.equal(render({}, false), "");
});
console.log(`${checks} employee-detail render checks passed.`);
