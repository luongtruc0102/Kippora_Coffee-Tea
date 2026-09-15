"use client";

import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  Landmark,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings2,
  Unlink,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAppToast } from "@/components/ui/app-toast-provider";
import ToastMessage from "@/components/ui/toast-message";
import {
  getBankAccounts,
  getBankReconciliation,
  ignoreBankTransaction,
  matchBankTransaction,
  recordBankTransaction,
  saveBankAccount,
} from "@/services/bank-reconciliation.service";
import type {
  BankAccountBranch,
  BankAccountInput,
  BankReconciliationResult,
  BankTransaction,
  BankTransactionStatus,
} from "@/types/bank-reconciliation";

const statusLabels: Record<BankTransactionStatus, string> = {
  MATCHED: "Đã khớp",
  UNMATCHED: "Chưa tìm thấy đơn",
  AMOUNT_MISMATCH: "Lệch số tiền",
  DUPLICATE: "Có dấu hiệu trùng",
  IGNORED: "Đã bỏ qua",
};

const statusClasses: Record<BankTransactionStatus, string> = {
  MATCHED: "bg-emerald-50 text-emerald-700",
  UNMATCHED: "bg-amber-50 text-amber-700",
  AMOUNT_MISMATCH: "bg-red-50 text-red-600",
  DUPLICATE: "bg-violet-50 text-violet-700",
  IGNORED: "bg-slate-100 text-slate-600",
};

function dateKey() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function localDateTimeValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function money(value: number | string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const emptyAccount: BankAccountInput = {
  bankBin: "",
  bankCode: "",
  bankName: "",
  accountNumber: "",
  accountName: "",
  isActive: true,
};

const inputClass =
  "h-11 w-full rounded-xl border border-[#E9E1D8] bg-white px-3 text-sm font-normal text-[#2A211D] outline-none focus:border-[#C9894B]";

export default function BankReconciliationPage() {
  const { showToast } = useAppToast();
  const [today] = useState(dateKey);
  const [accounts, setAccounts] = useState<BankAccountBranch[]>([]);
  const [result, setResult] = useState<BankReconciliationResult | null>(null);
  const [branchId, setBranchId] = useState("ALL");
  const [status, setStatus] = useState<BankTransactionStatus | "ALL">("ALL");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountBranchId, setAccountBranchId] = useState("");
  const [accountForm, setAccountForm] =
    useState<BankAccountInput>(emptyAccount);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordBranchId, setRecordBranchId] = useState("");
  const [recordPaymentId, setRecordPaymentId] = useState("");
  const [recordAmount, setRecordAmount] = useState("");
  const [recordDescription, setRecordDescription] = useState("");
  const [recordReference, setRecordReference] = useState("");
  const [recordOccurredAt, setRecordOccurredAt] = useState(localDateTimeValue);
  const [resolveModal, setResolveModal] = useState<{
    type: "MATCH" | "IGNORE";
    transaction: BankTransaction;
  } | null>(null);
  const [resolvePaymentId, setResolvePaymentId] = useState("");
  const [resolveReason, setResolveReason] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      if (from > to)
        throw new Error("Ngày bắt đầu không được sau ngày kết thúc.");
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      const [accountRows, reconciliation] = await Promise.all([
        getBankAccounts(accessToken),
        getBankReconciliation(accessToken, {
          branchId: branchId === "ALL" ? undefined : Number(branchId),
          from,
          to,
          status,
        }),
      ]);
      setAccounts(accountRows);
      setResult(reconciliation);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải dữ liệu đối soát",
      );
    } finally {
      setLoading(false);
    }
  }, [branchId, from, status, to]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const configuredCount = accounts.filter(
    (branch) => branch.bankAccount?.isActive,
  ).length;
  const activeAccounts = accounts.filter(
    (branch) => branch.isActive && branch.bankAccount?.isActive,
  );
  const pendingForRecord = (result?.pendingPayments ?? []).filter(
    (payment) =>
      !recordBranchId || payment.order.branchId === Number(recordBranchId),
  );
  const pendingForResolve = (result?.pendingPayments ?? []).filter(
    (payment) =>
      !resolveModal ||
      payment.order.branchId === resolveModal.transaction.bankAccount.branch.id,
  );

  function openAccountModal() {
    const selected =
      accounts.find((branch) => branch.id === Number(branchId)) ?? accounts[0];
    setAccountBranchId(selected ? String(selected.id) : "");
    setAccountForm(
      selected?.bankAccount
        ? {
            bankBin: selected.bankAccount.bankBin,
            bankCode: selected.bankAccount.bankCode,
            bankName: selected.bankAccount.bankName,
            accountNumber: selected.bankAccount.accountNumber,
            accountName: selected.bankAccount.accountName,
            isActive: selected.bankAccount.isActive,
          }
        : emptyAccount,
    );
    setAccountModalOpen(true);
  }

  function selectAccountBranch(value: string) {
    setAccountBranchId(value);
    const account = accounts.find(
      (branch) => branch.id === Number(value),
    )?.bankAccount;
    setAccountForm(
      account
        ? {
            bankBin: account.bankBin,
            bankCode: account.bankCode,
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            accountName: account.accountName,
            isActive: account.isActive,
          }
        : emptyAccount,
    );
  }

  async function submitAccount(event: FormEvent) {
    event.preventDefault();
    try {
      setWorking(true);
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      await saveBankAccount(accessToken, Number(accountBranchId), accountForm);
      setAccountModalOpen(false);
      showToast("Đã lưu tài khoản nhận chuyển khoản", "success");
      await load();
    } catch (saveError) {
      showToast(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu tài khoản",
        "error",
      );
    } finally {
      setWorking(false);
    }
  }

  function openRecordModal() {
    const selected =
      activeAccounts.find((branch) => branch.id === Number(branchId)) ??
      activeAccounts[0];
    setRecordBranchId(selected ? String(selected.id) : "");
    setRecordPaymentId("");
    setRecordAmount("");
    setRecordDescription("");
    setRecordReference(`TEST-${Date.now()}`);
    setRecordOccurredAt(localDateTimeValue());
    setRecordModalOpen(true);
  }

  function selectRecordPayment(value: string) {
    setRecordPaymentId(value);
    const payment = result?.pendingPayments.find(
      (item) => item.id === Number(value),
    );
    if (payment) {
      setRecordBranchId(String(payment.order.branchId));
      setRecordAmount(String(payment.amount));
      setRecordDescription(payment.referenceCode ?? "");
    }
  }

  async function submitRecord(event: FormEvent) {
    event.preventDefault();
    try {
      setWorking(true);
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      const branch = activeAccounts.find(
        (item) => item.id === Number(recordBranchId),
      );
      if (!branch?.bankAccount) {
        throw new Error(
          "Chi nhánh chưa có tài khoản nhận tiền đang hoạt động.",
        );
      }
      const response = await recordBankTransaction(accessToken, {
        bankBin: branch.bankAccount.bankBin,
        accountNumber: branch.bankAccount.accountNumber,
        providerReference: recordReference.trim(),
        amount: Number(recordAmount),
        description: recordDescription.trim(),
        occurredAt: new Date(recordOccurredAt).toISOString(),
      });
      setRecordModalOpen(false);
      showToast(
        response.transaction.status === "MATCHED"
          ? "Giao dịch đã tự động khớp và đơn đã được xác nhận thanh toán"
          : `Đã ghi nhận giao dịch: ${statusLabels[response.transaction.status]}`,
        response.transaction.status === "MATCHED" ? "success" : "info",
      );
      await load();
    } catch (recordError) {
      showToast(
        recordError instanceof Error
          ? recordError.message
          : "Không thể ghi nhận giao dịch",
        "error",
      );
    } finally {
      setWorking(false);
    }
  }

  function openResolve(type: "MATCH" | "IGNORE", transaction: BankTransaction) {
    setResolveModal({ type, transaction });
    setResolvePaymentId(
      transaction.suggestedPayment
        ? String(transaction.suggestedPayment.id)
        : "",
    );
    setResolveReason("");
  }

  async function submitResolve(event: FormEvent) {
    event.preventDefault();
    if (!resolveModal) return;
    try {
      setWorking(true);
      const accessToken = sessionStorage.getItem("accessToken");
      if (!accessToken) throw new Error("Không tìm thấy phiên đăng nhập.");
      if (resolveModal.type === "MATCH") {
        await matchBankTransaction(
          accessToken,
          resolveModal.transaction.id,
          Number(resolvePaymentId),
          resolveReason,
        );
        showToast("Đã ghép giao dịch với đơn hàng", "success");
      } else {
        await ignoreBankTransaction(
          accessToken,
          resolveModal.transaction.id,
          resolveReason,
        );
        showToast("Đã ghi nhận bỏ qua giao dịch", "success");
      }
      setResolveModal(null);
      await load();
    } catch (resolveError) {
      showToast(
        resolveError instanceof Error
          ? resolveError.message
          : "Không thể xử lý giao dịch",
        "error",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9894B]">
            Dòng tiền ngân hàng
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">
            Đối soát chuyển khoản
          </h1>
          <p className="mt-1 text-sm text-[#78866B]">
            Tự ghép sao kê với đơn theo mã thanh toán và số tiền chính xác.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openAccountModal}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D9CABE] bg-white px-4 text-sm font-semibold text-[#4A2C20]"
          >
            <Settings2 size={17} /> Cấu hình tài khoản
          </button>
          <button
            type="button"
            disabled={activeAccounts.length === 0}
            onClick={openRecordModal}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4A2C20] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus size={17} /> Giao dịch thử
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm font-semibold text-[#5E5650] disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      <ToastMessage message={error} />

      <section className="flex flex-col gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F7EFE6] text-[#C9894B]">
            <Landmark size={21} />
          </span>
          <div>
            <p className="font-semibold text-[#2A211D]">Tài khoản nhận tiền</p>
            <p className="text-sm text-[#78866B]">
              {configuredCount}/
              {accounts.filter((item) => item.isActive).length} chi nhánh đang
              hoạt động đã cấu hình
            </p>
          </div>
        </div>
        {configuredCount === 0 && (
          <p className="text-sm font-medium text-amber-700">
            Cần cấu hình ít nhất một tài khoản trước khi tạo VietQR.
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FileSearch}
          label="Tổng giao dịch"
          value={String(result?.summary.totalCount ?? 0)}
          hint={money(result?.summary.totalAmount ?? 0)}
          tone="brown"
        />
        <Metric
          icon={CheckCircle2}
          label="Đã tự/ghép khớp"
          value={String(result?.summary.matchedCount ?? 0)}
          hint={money(result?.summary.matchedAmount ?? 0)}
          tone="green"
        />
        <Metric
          icon={AlertTriangle}
          label="Cần xử lý"
          value={String(result?.summary.unresolvedCount ?? 0)}
          hint={money(result?.summary.unresolvedAmount ?? 0)}
          tone="red"
        />
        <Metric
          icon={Banknote}
          label="Đơn chờ chuyển khoản"
          value={String(result?.pendingPayments.length ?? 0)}
          hint="Chưa có giao dịch khớp"
          tone="blue"
        />
      </div>

      <section className="grid gap-3 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr]">
        <Filter label="Chi nhánh">
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className={inputClass}
          >
            <option value="ALL">Tất cả chi nhánh</option>
            {accounts.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Trạng thái">
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as BankTransactionStatus | "ALL")
            }
            className={inputClass}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Từ ngày">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
        </Filter>
        <Filter label="Đến ngày">
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
        </Filter>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-[#FAF8F5] text-xs uppercase tracking-wide text-[#78866B]">
              <tr>
                <th className="px-5 py-4">Giao dịch ngân hàng</th>
                <th className="px-4 py-4">Chi nhánh</th>
                <th className="px-4 py-4">Nội dung</th>
                <th className="px-4 py-4 text-right">Số tiền</th>
                <th className="px-4 py-4">Đơn được nhận diện</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E8E0]">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-[#78866B]"
                  >
                    <LoaderCircle
                      className="mr-2 inline animate-spin"
                      size={18}
                    />
                    Đang tải sao kê...
                  </td>
                </tr>
              ) : !result?.transactions.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-[#78866B]"
                  >
                    Chưa có giao dịch ngân hàng trong khoảng ngày này.
                  </td>
                </tr>
              ) : (
                result.transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="align-top hover:bg-[#FCFAF7]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#2A211D]">
                        {transaction.providerReference}
                      </p>
                      <p className="mt-1 text-xs text-[#8A817B]">
                        {formatDate(transaction.occurredAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">
                        {transaction.bankAccount.branch.code}
                      </p>
                      <p className="mt-1 text-xs text-[#8A817B]">
                        {transaction.bankAccount.bankCode} ·{" "}
                        {transaction.bankAccount.accountNumber}
                      </p>
                    </td>
                    <td className="max-w-[260px] px-4 py-4">
                      <p className="break-words text-[#5E5650]">
                        {transaction.description}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-[#4A2C20]">
                      {money(transaction.amount)}
                    </td>
                    <td className="px-4 py-4">
                      {transaction.suggestedPayment ? (
                        <>
                          <p className="font-semibold text-[#2A211D]">
                            Đơn #{transaction.suggestedPayment.orderId}
                          </p>
                          <p className="mt-1 text-xs text-[#8A817B]">
                            {transaction.suggestedPayment.order.receiverName} ·{" "}
                            {money(transaction.suggestedPayment.amount)}
                          </p>
                        </>
                      ) : (
                        <span className="text-[#A0968F]">Chưa nhận diện</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${statusClasses[transaction.status]}`}
                      >
                        {statusLabels[transaction.status]}
                      </span>
                      {transaction.resolutionNote ? (
                        <p className="mt-2 max-w-[190px] text-xs leading-5 text-[#8A817B]">
                          {transaction.resolutionNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {!["MATCHED", "IGNORED"].includes(
                          transaction.status,
                        ) ? (
                          <>
                            <button
                              type="button"
                              title="Ghép với đơn"
                              onClick={() => openResolve("MATCH", transaction)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"
                            >
                              <Link2 size={16} />
                            </button>
                            <button
                              type="button"
                              title="Bỏ qua có lý do"
                              onClick={() => openResolve("IGNORE", transaction)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
                            >
                              <Unlink size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-[#A0968F]">
                            Đã xử lý
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {accountModalOpen && (
        <Modal
          title="Cấu hình tài khoản nhận tiền"
          icon={Building2}
          onClose={() => setAccountModalOpen(false)}
        >
          <form onSubmit={submitAccount} className="space-y-4">
            <Filter label="Chi nhánh">
              <select
                required
                value={accountBranchId}
                onChange={(event) => selectAccountBranch(event.target.value)}
                className={inputClass}
              >
                <option value="">Chọn chi nhánh</option>
                {accounts.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
              </select>
            </Filter>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="BIN ngân hàng"
                value={accountForm.bankBin}
                maxLength={6}
                placeholder="Ví dụ: 970415"
                onChange={(value) =>
                  setAccountForm((current) => ({
                    ...current,
                    bankBin: value.replace(/\D/g, ""),
                  }))
                }
              />
              <TextField
                label="Mã ngân hàng"
                value={accountForm.bankCode}
                placeholder="Ví dụ: VCB"
                onChange={(value) =>
                  setAccountForm((current) => ({ ...current, bankCode: value }))
                }
              />
              <TextField
                label="Tên ngân hàng"
                value={accountForm.bankName}
                placeholder="Ngân hàng TMCP..."
                onChange={(value) =>
                  setAccountForm((current) => ({ ...current, bankName: value }))
                }
              />
              <TextField
                label="Số tài khoản"
                value={accountForm.accountNumber}
                placeholder="Số tài khoản nhận tiền"
                onChange={(value) =>
                  setAccountForm((current) => ({
                    ...current,
                    accountNumber: value.replace(/\s/g, ""),
                  }))
                }
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Tên chủ tài khoản"
                  value={accountForm.accountName}
                  placeholder="NGUYEN VAN A"
                  onChange={(value) =>
                    setAccountForm((current) => ({
                      ...current,
                      accountName: value,
                    }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-xl bg-[#FAF8F5] p-3 text-sm font-semibold text-[#4A2C20]">
              <input
                type="checkbox"
                checked={accountForm.isActive}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />{" "}
              Cho phép tạo QR nhận tiền
            </label>
            <ModalActions
              working={working}
              onCancel={() => setAccountModalOpen(false)}
              submitLabel="Lưu tài khoản"
            />
          </form>
        </Modal>
      )}

      {recordModalOpen && (
        <Modal
          title="Ghi nhận giao dịch thử"
          icon={CircleDollarSign}
          onClose={() => setRecordModalOpen(false)}
        >
          <form onSubmit={submitRecord} className="space-y-4">
            <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700">
              Màn hình này mô phỏng đúng dữ liệu webhook ngân hàng. Khi kết nối
              nhà cung cấp thật, giao dịch sẽ tự chạy vào đây.
            </p>
            <Filter label="Đơn đang chờ (không bắt buộc)">
              <select
                value={recordPaymentId}
                onChange={(event) => selectRecordPayment(event.target.value)}
                className={inputClass}
              >
                <option value="">Tự nhập nội dung giao dịch</option>
                {pendingForRecord.map((payment) => (
                  <option key={payment.id} value={payment.id}>
                    Đơn #{payment.orderId} · {payment.order.receiverName} ·{" "}
                    {money(payment.amount)}
                  </option>
                ))}
              </select>
            </Filter>
            <Filter label="Tài khoản chi nhánh">
              <select
                required
                value={recordBranchId}
                onChange={(event) => {
                  setRecordBranchId(event.target.value);
                  setRecordPaymentId("");
                }}
                className={inputClass}
              >
                <option value="">Chọn chi nhánh</option>
                {activeAccounts.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.bankAccount?.bankCode} ·{" "}
                    {branch.bankAccount?.accountNumber}
                  </option>
                ))}
              </select>
            </Filter>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Mã từ ngân hàng"
                value={recordReference}
                onChange={setRecordReference}
              />
              <TextField
                label="Số tiền"
                type="number"
                value={recordAmount}
                onChange={setRecordAmount}
              />
            </div>
            <TextField
              label="Nội dung chuyển khoản"
              value={recordDescription}
              onChange={setRecordDescription}
            />
            <Filter label="Thời gian giao dịch">
              <input
                required
                type="datetime-local"
                value={recordOccurredAt}
                onChange={(event) => setRecordOccurredAt(event.target.value)}
                className={inputClass}
              />
            </Filter>
            <ModalActions
              working={working}
              onCancel={() => setRecordModalOpen(false)}
              submitLabel="Ghi nhận & đối soát"
            />
          </form>
        </Modal>
      )}

      {resolveModal && (
        <Modal
          title={
            resolveModal.type === "MATCH"
              ? "Ghép giao dịch với đơn"
              : "Bỏ qua giao dịch"
          }
          icon={resolveModal.type === "MATCH" ? Link2 : Unlink}
          onClose={() => setResolveModal(null)}
        >
          <form onSubmit={submitResolve} className="space-y-4">
            <div className="rounded-xl bg-[#FAF8F5] p-4 text-sm">
              <p className="font-semibold text-[#2A211D]">
                {resolveModal.transaction.providerReference}
              </p>
              <p className="mt-1 text-[#78866B]">
                {money(resolveModal.transaction.amount)} ·{" "}
                {resolveModal.transaction.description}
              </p>
            </div>
            {resolveModal.type === "MATCH" && (
              <Filter label="Thanh toán cần ghép">
                <select
                  required
                  value={resolvePaymentId}
                  onChange={(event) => setResolvePaymentId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Chọn đơn cùng chi nhánh</option>
                  {pendingForResolve.map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      Đơn #{payment.orderId} · {payment.order.receiverName} ·{" "}
                      {money(payment.amount)}
                    </option>
                  ))}
                </select>
              </Filter>
            )}
            <label className="block text-sm font-semibold text-[#4A2C20]">
              {resolveModal.type === "MATCH"
                ? "Ghi chú đối soát"
                : "Lý do bỏ qua"}
              <textarea
                required
                minLength={5}
                rows={3}
                value={resolveReason}
                onChange={(event) => setResolveReason(event.target.value)}
                className="mt-2 w-full resize-none rounded-xl border border-[#E9E1D8] px-3 py-2.5 font-normal outline-none focus:border-[#C9894B]"
                placeholder="Nhập ít nhất 5 ký tự..."
              />
            </label>
            <ModalActions
              working={working}
              onCancel={() => setResolveModal(null)}
              submitLabel={
                resolveModal.type === "MATCH"
                  ? "Xác nhận ghép"
                  : "Xác nhận bỏ qua"
              }
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  hint: string;
  tone: "brown" | "green" | "red" | "blue";
}) {
  const tones = {
    brown: "bg-[#F7EFE6] text-[#9A5C2F]",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#78866B]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#1F1B18]">{value}</p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={21} />
        </span>
      </div>
      <p className="mt-3 text-xs text-[#8A817B]">{hint}</p>
    </div>
  );
}

function Filter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-[#78866B]">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-semibold text-[#4A2C20]">
      {label}
      <input
        required
        type={type}
        min={type === "number" ? 1 : undefined}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border border-[#E9E1D8] px-3 font-normal outline-none focus:border-[#C9894B]"
      />
    </label>
  );
}

function Modal({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: typeof Landmark;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F7EFE6] text-[#C9894B]">
              <Icon size={21} />
            </span>
            <h2 className="text-xl font-bold text-[#2A211D]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F2EC] text-[#6E625B]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  working,
  onCancel,
  submitLabel,
}: {
  working: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 border-t border-[#F0E8E0] pt-5">
      <button
        type="button"
        disabled={working}
        onClick={onCancel}
        className="rounded-xl border border-[#D9CABE] px-4 py-2.5 text-sm font-semibold text-[#5E5650]"
      >
        Hủy
      </button>
      <button
        type="submit"
        disabled={working}
        className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {working ? <LoaderCircle size={16} className="animate-spin" /> : null}
        {working ? "Đang xử lý..." : submitLabel}
      </button>
    </div>
  );
}
