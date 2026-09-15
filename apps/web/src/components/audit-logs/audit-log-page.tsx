"use client";

import {
  Boxes,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LoaderCircle,
  Landmark,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAuditLogs } from "@/services/audit-log.service";
import type {
  AuditLogItem,
  AuditLogsResponse,
  AuditModule,
} from "@/types/audit-log";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

const moduleView: Record<AuditModule, { label: string; className: string }> = {
  STAFF_SCHEDULE: {
    label: "Lịch làm",
    className: "bg-orange-50 text-orange-700",
  },
  ATTENDANCE: {
    label: "Bảng công",
    className: "bg-blue-50 text-blue-700",
  },
  LEAVE: { label: "Xin phép", className: "bg-cyan-50 text-cyan-700" },
  PAYROLL: { label: "Bảng lương", className: "bg-violet-50 text-violet-700" },
  INVENTORY: { label: "Kho hàng", className: "bg-emerald-50 text-emerald-700" },
  EXPENSE: { label: "Chi phí", className: "bg-rose-50 text-rose-700" },
  CASH_RECONCILIATION: {
    label: "Chốt quỹ",
    className: "bg-amber-50 text-amber-700",
  },
  ORDER: { label: "Đơn hàng", className: "bg-orange-50 text-orange-700" },
  PAYMENT: {
    label: "Thanh toán",
    className: "bg-fuchsia-50 text-fuchsia-700",
  },
  PRICING: {
    label: "Định giá món",
    className: "bg-lime-50 text-lime-700",
  },
  MONTH_CLOSE: {
    label: "Chốt sổ tháng",
    className: "bg-teal-50 text-teal-700",
  },
};

const actionLabels: Record<string, string> = {
  CREATE_SHIFT: "Xếp ca",
  UPDATE_SHIFT: "Sửa ca",
  DELETE_SHIFT: "Xóa ca",
  UPDATE_SHIFT_TEMPLATES: "Đổi khung giờ ca",
  UPDATE_ATTENDANCE: "Sửa chấm công",
  SUBMIT_PERIOD: "Gửi bảng công",
  APPROVE_PERIOD: "Duyệt bảng công",
  RETURN_PERIOD: "Trả lại bảng công",
  REOPEN_PERIOD: "Mở lại bảng công",
  APPROVE_LEAVE: "Duyệt xin phép",
  REJECT_LEAVE: "Từ chối xin phép",
  REQUEST_LEAVE_INFO: "Yêu cầu bổ sung",
  UPDATE_EMPLOYEE_RATE: "Đổi lương nhân viên",
  UPDATE_ROLE_RATES: "Đổi lương chung",
  CREATE_ADJUSTMENT: "Thêm thưởng/phạt",
  DELETE_ADJUSTMENT: "Xóa thưởng/phạt",
  FINALIZE_PAYROLL: "Chốt bảng lương",
  MARK_PAYROLL_PAID: "Xác nhận trả lương",
  CREATE_INGREDIENT: "Thêm nguyên liệu",
  UPDATE_VARIANT_RECIPE: "Sửa công thức món",
  UPDATE_TOPPING_RECIPE: "Sửa công thức topping",
  UPDATE_MINIMUM_LEVEL: "Đổi ngưỡng tồn kho",
  CREATE_STOCK_RECEIPT: "Tạo phiếu nhập",
  UPDATE_STOCK_RECEIPT: "Sửa phiếu nhập",
  COMPLETE_STOCK_RECEIPT: "Hoàn tất nhập kho",
  CANCEL_STOCK_RECEIPT: "Hủy phiếu nhập",
  CREATE_INVENTORY_COUNT: "Lập phiếu kiểm kê",
  UPDATE_INVENTORY_COUNT: "Sửa phiếu kiểm kê",
  SUBMIT_INVENTORY_COUNT: "Gửi duyệt kiểm kê",
  APPROVE_INVENTORY_COUNT: "Duyệt kiểm kê",
  REJECT_INVENTORY_COUNT: "Từ chối kiểm kê",
  CANCEL_INVENTORY_COUNT: "Hủy phiếu kiểm kê",
  CREATE_PURCHASE_ORDER: "Lập đề xuất nhập hàng",
  UPDATE_PURCHASE_ORDER: "Sửa đề xuất nhập hàng",
  SUBMIT_PURCHASE_ORDER: "Gửi duyệt đề xuất nhập hàng",
  APPROVE_PURCHASE_ORDER: "Duyệt đề xuất nhập hàng",
  REJECT_PURCHASE_ORDER: "Từ chối đề xuất nhập hàng",
  MARK_PURCHASE_ORDERED: "Xác nhận đã đặt hàng",
  RECEIVE_PURCHASE_ORDER: "Nhận hàng theo đơn đặt",
  CANCEL_PURCHASE_ORDER: "Hủy đơn đặt hàng",
  DISPOSE_INVENTORY_LOT: "Hủy nguyên liệu theo lô",
  CREATE_EXPENSE: "Lập khoản chi",
  UPDATE_EXPENSE: "Sửa khoản chi",
  SUBMIT_EXPENSE: "Gửi duyệt khoản chi",
  APPROVE_EXPENSE: "Duyệt khoản chi",
  REJECT_EXPENSE: "Từ chối khoản chi",
  CANCEL_EXPENSE: "Hủy khoản chi",
  OPEN_CASH_SESSION: "Mở sổ quỹ",
  CLOSE_CASH_SESSION: "Gửi duyệt sổ quỹ",
  APPROVE_CASH_SESSION: "Duyệt và khóa sổ quỹ",
  REOPEN_CASH_SESSION: "Mở lại sổ quỹ",
  CANCEL_ORDER: "Hủy đơn hàng",
  REFUND_AND_CANCEL_ORDER: "Hủy đơn và hoàn tiền",
  UPDATE_POLICY: "Đổi chính sách định giá",
  APPLY_PRICE: "Áp dụng giá bán mới",
  CLOSE_MONTH: "Chốt sổ tháng",
  REOPEN_MONTH: "Mở lại kỳ kế toán",
  CREATE_BANK_ACCOUNT: "Cấu hình tài khoản nhận tiền",
  UPDATE_BANK_ACCOUNT: "Cập nhật tài khoản nhận tiền",
  RECEIVE_BANK_TRANSACTION: "Nhận giao dịch chuyển khoản",
  AUTO_MATCH: "Tự động đối soát chuyển khoản",
  MANUAL_MATCH: "Ghép giao dịch thủ công",
  IGNORE_BANK_TRANSACTION: "Bỏ qua giao dịch chuyển khoản",
};

const fieldLabels: Record<string, string> = {
  status: "Trạng thái",
  employee: "Nhân viên",
  ingredient: "Nguyên liệu",
  supplier: "Nhà cung cấp",
  branch: "Chi nhánh",
  fullName: "Họ và tên",
  email: "Email",
  phone: "Số điện thoại",
  role: "Vai trò",
  isActive: "Đang hoạt động",
  name: "Tên",
  code: "Mã",
  unit: "Đơn vị",
  startAt: "Giờ bắt đầu",
  endAt: "Giờ kết thúc",
  clockIn: "Giờ vào",
  clockOut: "Giờ ra",
  employeeId: "Mã nhân viên",
  scheduledShiftId: "Mã ca làm",
  hourlyRate: "Lương một giờ",
  overtimeMultiplier: "Hệ số tăng ca",
  amount: "Số tiền",
  reason: "Lý do",
  note: "Ghi chú",
  reviewNote: "Phản hồi",
  paymentMethod: "Phương thức thanh toán",
  paymentReference: "Mã tham chiếu",
  minimumLevel: "Ngưỡng cảnh báo",
  quantity: "Tồn thực tế",
  reservedQuantity: "Đang giữ",
  batchCode: "Mã lô nhà cung cấp",
  manufacturedAt: "Ngày sản xuất",
  expiresAt: "Hạn dùng",
  inventoryValue: "Giá trị tồn",
  totalCost: "Tổng tiền",
  supplierId: "Mã nhà cung cấp",
  items: "Chi tiết nguyên liệu",
  revision: "Lần gửi",
  employees: "Số nhân viên",
  deleted: "Kết quả",
  type: "Loại điều chỉnh",
  rates: "Mức lương áp dụng",
  updated: "Số tài khoản cập nhật",
  coveringEmployeeId: "Nhân viên làm thay",
  finalizedAt: "Thời gian chốt",
  paidAt: "Thời gian thanh toán",
  category: "Nhóm chi phí",
  description: "Nội dung",
  incurredOn: "Ngày phát sinh",
  submittedAt: "Thời gian gửi duyệt",
  reviewedAt: "Thời gian xử lý",
  expectedAt: "Ngày dự kiến giao",
  orderedAt: "Thời gian đặt hàng",
  completedAt: "Thời gian nhận đủ",
  cancelledAt: "Thời gian hủy",
  availableSnapshot: "Tồn có thể dùng lúc lập",
  minimumLevelSnapshot: "Ngưỡng cảnh báo lúc lập",
  averageDailyUsage: "Mức dùng trung bình mỗi ngày",
  incomingSnapshot: "Số lượng đang về lúc lập",
  suggestedQuantity: "Số lượng hệ thống đề xuất",
  orderedQuantity: "Số lượng đặt",
  receivedQuantity: "Số lượng đã nhận",
  unitCost: "Đơn giá",
  lineTotal: "Thành tiền",
  receiptCode: "Mã phiếu nhập",
  businessDate: "Ngày bán hàng",
  openingFloat: "Quỹ đầu ngày",
  openingNote: "Ghi chú mở quỹ",
  cashSalesAmount: "Thu tiền mặt",
  bankSalesAmount: "Thu chuyển khoản",
  cashExpenseAmount: "Chi tiền mặt",
  expectedCash: "Tiền mặt dự kiến",
  actualCash: "Tiền mặt kiểm đếm",
  difference: "Chênh lệch",
  closingNote: "Giải trình chênh lệch",
  reopenReason: "Lý do mở lại",
  closedAt: "Thời gian gửi duyệt",
  approvedAt: "Thời gian khóa sổ",
  reopenedAt: "Thời gian mở lại",
  orderStatus: "Trạng thái đơn hàng",
  paymentStatus: "Trạng thái thanh toán",
  method: "Phương thức hoàn tiền",
  processedAt: "Thời gian hoàn tiền",
  processedBy: "Người xử lý",
  countedAt: "Thời gian kiểm kê",
  expectedQuantity: "Tồn hệ thống",
  countedQuantity: "Số đếm thực tế",
  differenceQuantity: "Chênh lệch",
  reviewedBy: "Người duyệt",
  cashRefundAmount: "Hoàn bằng tiền mặt",
  bankRefundAmount: "Hoàn bằng chuyển khoản",
  bankAccount: "Tài khoản nhận tiền",
  bankBin: "Mã BIN ngân hàng",
  bankCode: "Mã ngân hàng",
  bankName: "Tên ngân hàng",
  accountNumber: "Số tài khoản",
  accountName: "Tên chủ tài khoản",
  providerReference: "Mã giao dịch ngân hàng",
  occurredAt: "Thời gian giao dịch",
  referenceCode: "Nội dung chuyển khoản",
  matchedPayment: "Thanh toán đã ghép",
  matchedAt: "Thời gian đối soát",
  resolvedBy: "Người xử lý",
  resolutionNote: "Ghi chú xử lý",
  duplicateOfId: "Giao dịch gốc",
};

const hiddenFields = new Set([
  "id",
  "branchId",
  "employeeId",
  "scheduledShiftId",
  "payrollEntryId",
  "payrollPeriodId",
  "ingredientId",
  "productVariantId",
  "toppingId",
  "supplierId",
  "userId",
  "actorUserId",
  "avatarUrl",
  "createdAt",
  "updatedAt",
  "_count",
  "rawPayload",
  "bankAccountId",
  "matchedPaymentId",
  "resolvedById",
]);

const fieldPriority: Record<string, number> = {
  employee: 1,
  fullName: 2,
  email: 3,
  phone: 4,
  branch: 5,
  name: 6,
  code: 7,
  startAt: 8,
  endAt: 9,
  clockIn: 10,
  clockOut: 11,
  status: 12,
  type: 13,
  amount: 14,
  quantity: 15,
  minimumLevel: 16,
  reason: 90,
  note: 91,
  reviewNote: 92,
};

const valueLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  PENDING_REVIEW: "Chờ Admin duyệt",
  OPEN: "Đang mở",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  RETURNED: "Cần chỉnh sửa",
  FINALIZED: "Đã chốt",
  PAID: "Đã thanh toán",
  COMPLETED: "Hoàn tất",
  ORDERED: "Đã đặt nhà cung cấp",
  PARTIALLY_RECEIVED: "Đã nhận một phần",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
  BONUS: "Thưởng",
  DEDUCTION: "Khấu trừ",
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  STAFF: "Nhân viên",
  BRANCH_MANAGER: "Nhân viên trưởng",
  ADMIN: "Quản trị viên",
  RENT: "Thuê mặt bằng",
  UTILITIES: "Điện, nước và dịch vụ",
  MAINTENANCE: "Bảo trì và sửa chữa",
  MARKETING: "Marketing",
  SUPPLIES: "Vật tư vận hành",
  TRANSPORT: "Vận chuyển",
  OTHER: "Chi phí khác",
  BREAKAGE: "Đổ vỡ",
  SPOILAGE: "Hư hỏng",
  EXPIRED: "Hết hạn",
  LOSS: "Thất thoát",
  COUNTING_ERROR: "Sai lệch lần đếm trước",
  UNMATCHED: "Chưa tìm thấy thanh toán",
  MATCHED: "Đã khớp",
  AMOUNT_MISMATCH: "Sai số tiền",
  DUPLICATE: "Giao dịch trùng",
  IGNORED: "Đã bỏ qua",
};

const moneyFields = new Set([
  "amount",
  "hourlyRate",
  "totalCost",
  "unitCost",
  "lineTotal",
  "openingFloat",
  "cashSalesAmount",
  "bankSalesAmount",
  "cashExpenseAmount",
  "expectedCash",
  "actualCash",
  "difference",
  "cashRefundAmount",
  "bankRefundAmount",
]);

function localDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function firstDayOfMonth() {
  return `${localDate().slice(0, 7)}-01`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function looksLikeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "deleted" && value === true) return "Đã xóa";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "string" && looksLikeDate(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return formatDateTime(value);
  }
  if (key === "reason" && value === "OTHER") return "Khác";
  if (typeof value === "string" && valueLabels[value])
    return valueLabels[value];
  if (typeof value === "number" && moneyFields.has(key)) {
    return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
  }
  if (key === "overtimeMultiplier" && typeof value === "number") {
    return `${new Intl.NumberFormat("vi-VN").format(value)} lần`;
  }
  return String(value);
}

function humanizeFieldName(key: string) {
  if (fieldLabels[key]) return fieldLabels[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function visibleEntries(value: Record<string, unknown>) {
  return Object.entries(value)
    .filter(([key]) => !hiddenFields.has(key) && !key.endsWith("Id"))
    .sort(
      ([firstKey], [secondKey]) =>
        (fieldPriority[firstKey] ?? 50) - (fieldPriority[secondKey] ?? 50),
    );
}

function FriendlyValue({
  fieldKey,
  value,
}: {
  fieldKey: string;
  value: unknown;
}) {
  if (Array.isArray(value)) {
    if (!value.length) return <p className="mt-1 text-[#9A9089]">Không có</p>;
    return (
      <div className="mt-2 space-y-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-[#EEE5DC] bg-white p-3"
          >
            <p className="mb-2 text-xs font-semibold text-[#9F642F]">
              Mục {index + 1}
            </p>
            <FriendlyValue fieldKey={fieldKey} value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === "object") {
    const entries = visibleEntries(value as Record<string, unknown>);
    if (!entries.length) {
      return <p className="mt-1 text-[#9A9089]">Không có thông tin</p>;
    }
    return (
      <div className="mt-2 space-y-2 rounded-xl border border-[#EEE5DC] bg-white p-3">
        {entries.map(([key, nestedValue]) => (
          <div key={key}>
            <p className="text-[11px] font-semibold text-[#78866B]">
              {humanizeFieldName(key)}
            </p>
            <FriendlyValue fieldKey={key} value={nestedValue} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="mt-1 break-words text-sm text-[#2A211D]">
      {formatValue(fieldKey, value)}
    </p>
  );
}

function employeeNameFrom(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const employee = (data as Record<string, unknown>).employee;
  if (!employee || typeof employee !== "object" || Array.isArray(employee)) {
    return null;
  }
  const record = employee as Record<string, unknown>;
  return typeof record.fullName === "string" && record.fullName.trim()
    ? record.fullName
    : typeof record.email === "string"
      ? record.email
      : null;
}

function friendlyDescription(item: AuditLogItem) {
  const employeeName =
    employeeNameFrom(item.afterData) || employeeNameFrom(item.beforeData);
  switch (item.action) {
    case "CREATE_SHIFT":
      return employeeName
        ? `Xếp ca cho ${employeeName}`
        : "Xếp ca cho nhân viên";
    case "UPDATE_SHIFT":
      return employeeName
        ? `Điều chỉnh ca làm của ${employeeName}`
        : "Điều chỉnh ca làm";
    case "DELETE_SHIFT":
      return employeeName ? `Xóa ca làm của ${employeeName}` : "Xóa ca làm";
    case "UPDATE_ATTENDANCE":
      return employeeName
        ? `Điều chỉnh chấm công của ${employeeName}`
        : "Điều chỉnh chấm công nhân viên";
    case "APPROVE_LEAVE":
      return "Duyệt yêu cầu xin phép của nhân viên";
    case "REJECT_LEAVE":
      return "Từ chối yêu cầu xin phép của nhân viên";
    case "REQUEST_LEAVE_INFO":
      return "Yêu cầu nhân viên bổ sung thông tin xin phép";
    case "UPDATE_EMPLOYEE_RATE":
      return "Cập nhật mức lương nhân viên";
    case "CREATE_ADJUSTMENT":
      return "Thêm khoản thưởng hoặc khấu trừ lương";
    case "DELETE_ADJUSTMENT":
      return "Xóa khoản thưởng hoặc khấu trừ lương";
    case "OPEN_CASH_SESSION":
      return "Mở sổ quỹ đầu ngày";
    case "CLOSE_CASH_SESSION":
      return "Kiểm đếm và gửi sổ quỹ cho Admin duyệt";
    case "APPROVE_CASH_SESSION":
      return "Duyệt đối soát và khóa sổ quỹ";
    case "REOPEN_CASH_SESSION":
      return "Mở lại sổ quỹ để kiểm đếm lại";
    case "CANCEL_ORDER":
      return "Hủy đơn hàng chưa thanh toán";
    case "REFUND_AND_CANCEL_ORDER":
      return "Hủy đơn hàng và hoàn lại toàn bộ số tiền đã thu";
    case "CREATE_BANK_ACCOUNT":
      return "Cấu hình tài khoản nhận chuyển khoản cho chi nhánh";
    case "UPDATE_BANK_ACCOUNT":
      return "Cập nhật tài khoản nhận chuyển khoản của chi nhánh";
    case "RECEIVE_BANK_TRANSACTION":
      return "Nhận giao dịch chuyển khoản cần kiểm tra";
    case "AUTO_MATCH":
      return "Tự động khớp đúng nội dung và số tiền thanh toán";
    case "MANUAL_MATCH":
      return "Admin ghép giao dịch với một thanh toán đang chờ";
    case "IGNORE_BANK_TRANSACTION":
      return "Admin xác nhận bỏ qua giao dịch không dùng để thanh toán";
    default:
      return item.description;
  }
}

function ChangePanel({
  title,
  data,
  emptyMessage = "Không có dữ liệu.",
}: {
  title: string;
  data: unknown;
  emptyMessage?: string;
}) {
  const entries =
    data && typeof data === "object" && !Array.isArray(data)
      ? visibleEntries(data as Record<string, unknown>)
      : [];
  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-[#FCFAF7] p-4">
      <h3 className="font-bold text-[#2A211D]">{title}</h3>
      {!data ? (
        <p className="mt-3 text-sm leading-6 text-[#9A9089]">{emptyMessage}</p>
      ) : entries.length ? (
        <div className="mt-3 space-y-3">
          {entries.map(([key, value]) => (
            <div key={key} className="text-sm">
              <p className="text-xs font-semibold text-[#78866B]">
                {humanizeFieldName(key)}
              </p>
              <FriendlyValue fieldKey={key} value={value} />
            </div>
          ))}
        </div>
      ) : Array.isArray(data) ? (
        <FriendlyValue fieldKey="items" value={data} />
      ) : (
        <div className="mt-3">
          <FriendlyValue fieldKey="value" value={data} />
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage({ mode }: Props) {
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(localDate);
  const [module, setModule] = useState<AuditModule | "">("");
  const [branchId, setBranchId] = useState(0);
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) return;
      try {
        setLoading(true);
        const result = await getAuditLogs(
          accessToken,
          {
            branchId: branchId || undefined,
            module: module || undefined,
            from,
            to,
            q: keyword || undefined,
            page,
            limit: 30,
          },
          signal,
        );
        setData(result);
        setError("");
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError")
          return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải nhật ký hoạt động.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branchId, from, keyword, module, page, to],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => void loadData(controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadData]);

  const cards = useMemo(
    () => [
      {
        label: "Tổng thao tác",
        value: data?.summary.total ?? 0,
        icon: ShieldCheck,
        className: "bg-[#F3E9DE] text-[#9F642F]",
      },
      {
        label: "Lịch & bảng công",
        value:
          (data?.summary.byModule.STAFF_SCHEDULE ?? 0) +
          (data?.summary.byModule.ATTENDANCE ?? 0) +
          (data?.summary.byModule.LEAVE ?? 0),
        icon: CalendarClock,
        className: "bg-blue-50 text-blue-700",
      },
      {
        label: "Tài chính",
        value:
          (data?.summary.byModule.PAYROLL ?? 0) +
          (data?.summary.byModule.EXPENSE ?? 0) +
          (data?.summary.byModule.CASH_RECONCILIATION ?? 0) +
          (data?.summary.byModule.PAYMENT ?? 0) +
          (data?.summary.byModule.PRICING ?? 0) +
          (data?.summary.byModule.MONTH_CLOSE ?? 0),
        icon: Landmark,
        className: "bg-violet-50 text-violet-700",
      },
      {
        label: "Kho hàng",
        value: data?.summary.byModule.INVENTORY ?? 0,
        icon: Boxes,
        className: "bg-emerald-50 text-emerald-700",
      },
    ],
    [data],
  );

  function applySearch() {
    setPage(1);
    setKeyword(search.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
          Kiểm soát hệ thống
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#2A211D]">
          Nhật ký hoạt động
        </h1>
        <p className="mt-2 text-sm text-[#78866B]">
          {mode === "ADMIN"
            ? "Theo dõi thay đổi quan trọng trên toàn hệ thống. Nhật ký không thể sửa hoặc xóa."
            : "Theo dõi thay đổi trong chi nhánh của bạn. Nhật ký không thể sửa hoặc xóa."}
        </p>
      </div>

      <section className="rounded-3xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_170px_170px_190px_auto]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9089]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applySearch();
              }}
              placeholder="Tìm nội dung, mã hoặc người thao tác..."
              className="h-11 w-full rounded-xl border border-[#DCCFC3] pl-10 pr-3 text-sm outline-none focus:border-[#C9894B]"
            />
          </div>
          <select
            value={module}
            onChange={(event) => {
              setPage(1);
              setModule(event.target.value as AuditModule | "");
            }}
            className="h-11 rounded-xl border border-[#DCCFC3] bg-white px-3 text-sm text-[#4F4741] outline-none focus:border-[#C9894B]"
          >
            <option value="">Tất cả nghiệp vụ</option>
            {Object.entries(moduleView).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setPage(1);
              setFrom(event.target.value);
            }}
            className="h-11 rounded-xl border border-[#DCCFC3] px-3 text-sm outline-none focus:border-[#C9894B]"
            title="Từ ngày"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setPage(1);
              setTo(event.target.value);
            }}
            className="h-11 rounded-xl border border-[#DCCFC3] px-3 text-sm outline-none focus:border-[#C9894B]"
            title="Đến ngày"
          />
          <button
            type="button"
            onClick={applySearch}
            className="h-11 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white hover:bg-[#382118]"
          >
            Tìm kiếm
          </button>
        </div>

        {mode === "ADMIN" && (data?.branches.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setBranchId(0);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${branchId === 0 ? "bg-[#4A2C20] text-white" : "bg-[#F7F2EC] text-[#6B625C]"}`}
            >
              Toàn hệ thống
            </button>
            {data?.branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => {
                  setPage(1);
                  setBranchId(branch.id);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${branchId === branch.id ? "bg-[#4A2C20] text-white" : "bg-[#F7F2EC] text-[#6B625C]"}`}
              >
                {branch.code} · {branch.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm"
            >
              <div>
                <p className="text-xs text-[#78866B]">{card.label}</p>
                <p className="mt-1 text-xl font-bold text-[#2A211D]">
                  {card.value}
                </p>
              </div>
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.className}`}
              >
                <Icon size={20} />
              </span>
            </div>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#78866B]">
            <LoaderCircle size={20} className="animate-spin" /> Đang tải nhật
            ký...
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-red-600">
            {error}
            <button
              type="button"
              onClick={() => void loadData()}
              className="mx-auto mt-3 block rounded-xl bg-[#4A2C20] px-4 py-2 font-semibold text-white"
            >
              Tải lại
            </button>
          </div>
        ) : data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-[#FAF8F5] text-xs uppercase text-[#78866B]">
                <tr>
                  <th className="px-5 py-4">Thời gian</th>
                  <th className="px-5 py-4">Người thao tác</th>
                  <th className="px-5 py-4">Chi nhánh</th>
                  <th className="px-5 py-4">Nghiệp vụ</th>
                  <th className="px-5 py-4">Nội dung</th>
                  <th className="px-5 py-4 text-right">Đối soát</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE5DC]">
                {data.items.map((item) => (
                  <tr key={item.id} className="text-[#4F4741]">
                    <td className="whitespace-nowrap px-5 py-4 text-xs">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#2A211D]">
                        {item.actor?.fullName ||
                          item.actor?.email ||
                          "Tài khoản đã xóa"}
                      </p>
                      {item.actor?.fullName && (
                        <p className="mt-0.5 text-xs text-[#8A817B]">
                          {item.actor.email}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs">
                      {item.branch
                        ? `${item.branch.code} · ${item.branch.name}`
                        : "Toàn hệ thống"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${moduleView[item.module]?.className || "bg-slate-100 text-slate-600"}`}
                      >
                        {moduleView[item.module]?.label || item.module}
                      </span>
                      <p className="mt-1.5 text-xs text-[#8A817B]">
                        {actionLabels[item.action] || item.action}
                      </p>
                    </td>
                    <td className="max-w-[400px] px-5 py-4">
                      <p className="font-medium text-[#2A211D]">
                        {friendlyDescription(item)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCCFC3] px-3 py-2 text-xs font-semibold text-[#9F642F] hover:bg-[#FFF8F0]"
                      >
                        <ClipboardCheck size={15} /> Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center text-sm text-[#8A817B]">
            Chưa có thao tác nào trong khoảng thời gian đã chọn.
          </div>
        )}

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#EEE5DC] px-5 py-4 text-sm text-[#6B625C]">
            <span>
              Trang {data.pagination.page}/{data.pagination.totalPages} ·{" "}
              {data.pagination.total} bản ghi
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCCFC3] disabled:opacity-40"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCCFC3] disabled:opacity-40"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#E9E1D8] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#EEE5DC] px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#C9894B]">
                  {moduleView[selected.module]?.label || selected.module} ·{" "}
                  {actionLabels[selected.action] || selected.action}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#2A211D]">
                  {friendlyDescription(selected)}
                </h2>
                <p className="mt-2 text-sm text-[#78866B]">
                  {formatDateTime(selected.createdAt)} ·{" "}
                  {selected.actor?.fullName ||
                    selected.actor?.email ||
                    "Tài khoản đã xóa"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8A817B] hover:bg-[#F7F2EC]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid items-start gap-4 overflow-y-auto p-6 md:grid-cols-2">
              <ChangePanel
                title="Thông tin trước đó"
                data={selected.beforeData}
                emptyMessage={
                  selected.action.startsWith("CREATE_")
                    ? "Đây là thao tác tạo mới nên chưa có thông tin trước đó."
                    : "Không có thông tin trước khi thay đổi."
                }
              />
              <ChangePanel
                title={
                  selected.action.startsWith("CREATE_")
                    ? "Thông tin đã tạo"
                    : "Thông tin sau thay đổi"
                }
                data={selected.afterData}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
