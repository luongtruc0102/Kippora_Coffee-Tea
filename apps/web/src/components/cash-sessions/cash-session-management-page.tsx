"use client";

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Eye,
  Landmark,
  LockKeyhole,
  Plus,
  RefreshCw,
  Scale,
  Send,
  UnlockKeyhole,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  approveCashSession,
  closeCashSession,
  getCashSession,
  getCashSessions,
  openCashSession,
  reopenCashSession,
} from "@/services/cash-session.service";
import type {
  CashSession,
  CashSessionList,
  CashSessionStatus,
} from "@/types/cash-session";

type Props = { mode: "ADMIN" | "BRANCH_MANAGER" };

const statusLabels: Record<CashSessionStatus, string> = {
  OPEN: "Đang mở",
  PENDING_REVIEW: "Chờ Admin duyệt",
  APPROVED: "Đã khóa sổ",
};

const statusClasses: Record<CashSessionStatus, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  PENDING_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
};

const eventLabels = {
  OPENED: "Mở sổ quỹ",
  CLOSED: "Kiểm đếm và gửi duyệt",
  APPROVED: "Admin duyệt và khóa sổ",
  REOPENED: "Admin mở lại sổ",
};

function localDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function monthStart() {
  return `${localDate().slice(0, 7)}-01`;
}

function money(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function date(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function CashSessionManagementPage({ mode }: Props) {
  const { showToast } = useAppToast();
  const [data, setData] = useState<CashSessionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchId, setBranchId] = useState(0);
  const [status, setStatus] = useState<CashSessionStatus | "ALL">("ALL");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(localDate);
  const [selected, setSelected] = useState<CashSession | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("1000000");
  const [openingNote, setOpeningNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      const result = await getCashSessions(
        token,
        {
          branchId: branchId || undefined,
          status,
          from: from || undefined,
          to: to || undefined,
        },
        signal,
      );
      setData(result);
      if (mode === "BRANCH_MANAGER" && result.scopedBranchId) {
        setBranchId(result.scopedBranchId);
      }
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách sổ quỹ",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [branchId, from, mode, status, to]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [load]);

  const targetBranchId =
    mode === "ADMIN" ? branchId : data?.scopedBranchId || branchId || 0;
  const todaySession = data?.sessions.find(
    (item) => item.branchId === targetBranchId && item.businessDate.slice(0, 10) === data.today,
  );
  const hasActiveBranch = Boolean(
    data?.branches.some((item) => item.isActive),
  );

  async function viewSession(session: CashSession) {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setBusy(true);
      setSelected(await getCashSession(token, session.id));
    } catch (viewError) {
      showToast(
        viewError instanceof Error ? viewError.message : "Không thể tải sổ quỹ",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runAction(
    action: (token: string) => Promise<CashSession>,
    message: string,
  ) {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setBusy(true);
      const session = await action(token);
      setSelected(session);
      showToast(message, "success");
      await load();
    } catch (actionError) {
      showToast(
        actionError instanceof Error
          ? actionError.message
          : "Không thể xử lý sổ quỹ",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createSession(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(openingFloat);
    if (!targetBranchId || !Number.isFinite(amount) || amount < 0) return;
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;
    try {
      setBusy(true);
      const session = await openCashSession(token, {
        branchId: targetBranchId,
        openingFloat: amount,
        note: openingNote.trim() || undefined,
      });
      setOpenForm(false);
      setOpeningNote("");
      setSelected(session);
      showToast("Đã mở sổ quỹ hôm nay", "success");
      await load();
    } catch (openError) {
      showToast(
        openError instanceof Error ? openError.message : "Không thể mở sổ quỹ",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C2763D]">
            Tài chính · Kiểm soát tiền mặt
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#1F1B18]">
            Đối soát cuối ngày
          </h1>
          <p className="mt-2 text-sm text-[#78866B]">
            {mode === "ADMIN"
              ? "Kiểm tra chênh lệch và khóa sổ quỹ của từng chi nhánh."
              : "Mở quỹ đầu ngày, kiểm đếm thực tế và gửi Admin duyệt."}
          </p>
        </div>
        <button
          type="button"
          disabled={
            mode === "ADMIN"
              ? !hasActiveBranch
              : !targetBranchId || Boolean(todaySession)
          }
          onClick={() => setOpenForm(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plus size={18} /> {mode !== "ADMIN" && todaySession ? "Hôm nay đã mở quỹ" : "Mở quỹ hôm nay"}
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Summary icon={Landmark} label="Tổng sổ quỹ" value={String(data?.summary.total ?? 0)} />
        <Summary icon={Banknote} label="Đang mở" value={String(data?.summary.open ?? 0)} tone="blue" />
        <Summary icon={Scale} label="Chờ duyệt" value={String(data?.summary.pending ?? 0)} tone="amber" />
        <Summary
          icon={CheckCircle2}
          label="Chênh lệch"
          value={money(data?.summary.totalDifference ?? 0)}
          tone={(data?.summary.totalDifference ?? 0) === 0 ? "green" : "red"}
        />
      </section>

      <section className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {mode === "ADMIN" && (
            <select
              value={branchId}
              onChange={(event) => setBranchId(Number(event.target.value))}
              className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none"
            >
              <option value={0}>Tất cả chi nhánh</option>
              {data?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as CashSessionStatus | "ALL")}
            className="h-11 rounded-xl border border-[#E4D8CC] bg-white px-4 text-sm outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <DateInput value={from} max={to} title="Từ ngày" onChange={setFrom} />
          <DateInput value={to} min={from} max={localDate()} title="Đến ngày" onChange={setTo} />
        </div>
      </section>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-[#E9E1D8] bg-[#FCFAF8] text-xs uppercase text-[#78866B]">
              <tr>
                <th className="px-5 py-4">Sổ quỹ</th>
                <th className="px-4 py-4">Chi nhánh</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4 text-right">Dự kiến</th>
                <th className="px-4 py-4 text-right">Thực tế</th>
                <th className="px-4 py-4 text-right">Chênh lệch</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E8E0]">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-[#8A817B]">Đang tải sổ quỹ...</td></tr>
              ) : !data?.sessions.length ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-[#8A817B]">Chưa có sổ quỹ phù hợp với bộ lọc.</td></tr>
              ) : data.sessions.map((session) => (
                <tr key={session.id} className="text-[#5E5650]">
                  <td className="px-5 py-4"><strong className="block text-[#2A211D]">{session.code}</strong><span className="text-xs text-[#8A817B]">{date(session.businessDate)}</span></td>
                  <td className="px-4 py-4">{session.branch.code} · {session.branch.name}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[session.status]}`}>{statusLabels[session.status]}</span></td>
                  <td className="px-4 py-4 text-right font-semibold">{money(session.expectedCash)}</td>
                  <td className="px-4 py-4 text-right">{money(session.actualCash)}</td>
                  <td className={`px-4 py-4 text-right font-bold ${(session.difference ?? 0) === 0 ? "text-emerald-700" : "text-red-600"}`}>{money(session.difference)}</td>
                  <td className="px-5 py-4 text-right"><button type="button" disabled={busy} onClick={() => void viewSession(session)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#F4F7F0] px-3 text-xs font-semibold text-[#637458]"><Eye size={16} /> Chi tiết</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={createSession} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-[#2A211D]">Mở quỹ hôm nay</h2><p className="mt-1 text-sm text-[#78866B]">Nhập số tiền mặt có sẵn trước khi bán hàng.</p></div><button type="button" disabled={busy} onClick={() => setOpenForm(false)}><X size={20} /></button></div>
            {mode === "ADMIN" && <label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">Chi nhánh *</span><select required value={targetBranchId} onChange={(event) => setBranchId(Number(event.target.value))} className="h-12 w-full rounded-xl border border-[#E4D8CC] px-4"><option value={0}>Chọn chi nhánh</option>{data?.branches.filter((item) => item.isActive).map((item) => { const opened = data.sessions.some((session) => session.branchId === item.id && session.businessDate.slice(0, 10) === data.today); return <option key={item.id} value={item.id} disabled={opened}>{item.code} · {item.name}{opened ? " · Đã mở quỹ" : ""}</option>; })}</select></label>}
            <label className="mt-5 block"><span className="mb-2 block text-sm font-semibold">Tiền quỹ đầu ngày *</span><span className="flex h-12 items-center rounded-xl border border-[#E4D8CC] pr-4"><input required type="number" min="0" step="1" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} className="min-w-0 flex-1 px-4 outline-none" /><span className="text-sm text-[#8A817B]">đ</span></span></label>
            <label className="mt-4 block"><span className="mb-2 block text-sm font-semibold">Ghi chú</span><textarea rows={3} maxLength={500} value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} className="w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3 outline-none" /></label>
            <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setOpenForm(false)} className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold">Đóng</button><button disabled={busy} className="rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Đang mở..." : "Xác nhận mở quỹ"}</button></div>
          </form>
        </div>
      )}

      {selected && (
        <CashSessionDetail
          session={selected}
          mode={mode}
          busy={busy}
          onClose={() => !busy && setSelected(null)}
          onCloseSession={(actualCash, note) =>
            void runAction((token) => closeCashSession(token, selected.id, { actualCash, note }), "Đã gửi sổ quỹ cho Admin duyệt")
          }
          onApprove={(note) =>
            void runAction((token) => approveCashSession(token, selected.id, note), "Đã duyệt và khóa sổ quỹ")
          }
          onReopen={(reason) =>
            void runAction((token) => reopenCashSession(token, selected.id, reason), "Đã mở lại sổ quỹ để kiểm đếm")
          }
        />
      )}
    </div>
  );
}

function DateInput({ value, min, max, title, onChange }: { value: string; min?: string; max?: string; title: string; onChange: (value: string) => void }) {
  return <label className="relative min-w-0"><CalendarDays size={16} className="pointer-events-none absolute left-3 top-3.5 text-[#8A817B]" /><input type="date" title={title} value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="h-11 min-w-0 w-full rounded-xl border border-[#E4D8CC] pl-10 pr-3 text-sm outline-none" /></label>;
}

function Summary({ icon: Icon, label, value, tone = "brown" }: { icon: typeof Landmark; label: string; value: string; tone?: "brown" | "blue" | "amber" | "green" | "red" }) {
  const style = tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-red-50 text-red-600" : "bg-[#F3E9DE] text-[#4A2C20]";
  return <div className="rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${style}`}><Icon size={20} /></span><p className="mt-3 text-xs text-[#78866B]">{label}</p><strong className="mt-1 block text-xl text-[#2A211D]">{value}</strong></div>;
}

function CashSessionDetail({ session, mode, busy, onClose, onCloseSession, onApprove, onReopen }: { session: CashSession; mode: Props["mode"]; busy: boolean; onClose: () => void; onCloseSession: (actualCash: number, note?: string) => void; onApprove: (note?: string) => void; onReopen: (reason: string) => void }) {
  const [actualCash, setActualCash] = useState(String(session.actualCash ?? session.expectedCash));
  const [note, setNote] = useState(session.closingNote ?? "");
  const [reviewNote, setReviewNote] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const difference = Number(actualCash) - session.expectedCash;
  const isAdmin = mode === "ADMIN";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#E9E1D8] px-6 py-5"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-[#2A211D]">{session.code}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[session.status]}`}>{statusLabels[session.status]}</span></div><p className="mt-1 text-sm text-[#78866B]">{session.branch.code} · {date(session.businessDate)}</p></div><button type="button" disabled={busy} onClick={onClose}><X size={20} /></button></header>
        <div className="overflow-y-auto p-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Metric label="Quỹ đầu ngày" value={money(session.openingFloat)} /><Metric label="Thu tiền mặt" value={money(session.cashSalesAmount)} /><Metric label="Chi tiền mặt" value={`− ${money(session.cashExpenseAmount)}`} /><Metric label="Hoàn tiền mặt" value={`− ${money(session.cashRefundAmount)}`} danger={session.cashRefundAmount > 0} /><Metric label="Tiền dự kiến" value={money(session.expectedCash)} strong /></section>
          <section className="mt-4 grid gap-3 rounded-2xl border border-[#E9E1D8] bg-[#FCFAF8] p-4 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Thu chuyển khoản" value={money(session.bankSalesAmount)} /><Metric label="Hoàn chuyển khoản" value={money(session.bankRefundAmount)} /><Metric label="Tiền kiểm đếm" value={money(session.actualCash)} /><Metric label="Chênh lệch" value={money(session.difference)} danger={(session.difference ?? 0) !== 0} /><Metric label="Khoản chi chờ duyệt" value={String(session.pendingCashExpenses)} danger={session.pendingCashExpenses > 0} /></section>
          {session.status === "OPEN" && (
            <form onSubmit={(event) => { event.preventDefault(); const amount = Number(actualCash); if (!Number.isFinite(amount) || amount < 0 || (Math.abs(difference) >= 0.01 && !note.trim())) return; onCloseSession(amount, note.trim() || undefined); }} className="mt-5 rounded-2xl border border-[#E9E1D8] p-5"><h3 className="font-bold text-[#2A211D]">Kiểm đếm cuối ngày</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-semibold">Tiền mặt thực tế *</span><input required type="number" min="0" step="1" value={actualCash} onChange={(event) => setActualCash(event.target.value)} className="h-12 w-full rounded-xl border border-[#E4D8CC] px-4" /></label><div className="rounded-xl bg-[#FCFAF8] px-4 py-3"><p className="text-xs text-[#78866B]">Chênh lệch tạm tính</p><p className={`mt-1 font-bold ${Math.abs(difference) < 0.01 ? "text-emerald-700" : "text-red-600"}`}>{money(Number.isFinite(difference) ? difference : 0)}</p></div></div><label className="mt-4 block"><span className="mb-2 block text-sm font-semibold">Giải trình {Math.abs(difference) >= 0.01 ? "*" : ""}</span><textarea rows={3} maxLength={500} required={Math.abs(difference) >= 0.01} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bắt buộc khi quỹ thừa hoặc thiếu" className="w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3" /></label><div className="mt-4 flex justify-end"><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} /> Gửi Admin duyệt</button></div></form>
          )}
          {isAdmin && session.status === "PENDING_REVIEW" && (
            <section className="mt-5 rounded-2xl border border-[#E9E1D8] p-5"><h3 className="font-bold text-[#2A211D]">Admin đối soát</h3>{session.pendingCashExpenses > 0 && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Cần duyệt {session.pendingCashExpenses} khoản chi tiền mặt trước khi khóa sổ.</p>}<textarea rows={3} maxLength={500} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Ghi chú duyệt (không bắt buộc)" className="mt-4 w-full resize-none rounded-xl border border-[#E4D8CC] px-4 py-3" /><textarea rows={2} maxLength={500} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Lý do trả lại kiểm đếm" className="mt-3 w-full resize-none rounded-xl border border-amber-200 px-4 py-3" /><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy || !reopenReason.trim()} onClick={() => onReopen(reopenReason.trim())} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700 disabled:opacity-45"><RefreshCw size={16} /> Trả lại kiểm đếm</button><button type="button" disabled={busy || session.pendingCashExpenses > 0} onClick={() => onApprove(reviewNote.trim() || undefined)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45"><LockKeyhole size={16} /> Duyệt và khóa sổ</button></div></section>
          )}
          {isAdmin && session.status === "APPROVED" && (
            <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/40 p-5"><h3 className="font-bold text-[#2A211D]">Mở khóa sổ quỹ</h3><p className="mt-1 text-sm text-[#78866B]">Chỉ mở lại khi có sai sót; lý do sẽ được lưu vĩnh viễn.</p><textarea rows={3} maxLength={500} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Lý do mở lại *" className="mt-4 w-full resize-none rounded-xl border border-amber-200 bg-white px-4 py-3" /><div className="mt-3 flex justify-end"><button type="button" disabled={busy || !reopenReason.trim()} onClick={() => onReopen(reopenReason.trim())} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 disabled:opacity-45"><UnlockKeyhole size={16} /> Mở lại sổ</button></div></section>
          )}
          <section className="mt-5"><h3 className="font-bold text-[#2A211D]">Lịch sử sổ quỹ</h3><div className="mt-3 space-y-2">{session.events.map((event) => <div key={event.id} className="flex items-start justify-between gap-4 rounded-xl border border-[#E9E1D8] px-4 py-3"><div><p className="text-sm font-semibold text-[#2A211D]">{eventLabels[event.type]}</p><p className="mt-0.5 text-xs text-[#8A817B]">{event.actor?.fullName || event.actor?.email || "Hệ thống"}</p>{event.reason && <p className="mt-1 text-sm text-[#6B625C]">{event.reason}</p>}</div><span className="shrink-0 text-xs text-[#8A817B]">{dateTime(event.createdAt)}</span></div>)}</div></section>
        </div>
        <footer className="flex justify-end border-t border-[#E9E1D8] px-6 py-4"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-[#D9CABE] px-5 py-2.5 text-sm font-semibold">Đóng</button></footer>
      </div>
    </div>
  );
}

function Metric({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div className="min-w-0 rounded-xl bg-white p-3"><p className="text-xs text-[#78866B]">{label}</p><p className={`mt-1 truncate ${strong ? "text-lg font-bold text-[#4A2C20]" : danger ? "font-bold text-red-600" : "font-semibold text-[#2A211D]"}`}>{value}</p></div>;
}
