-- Cho phép giữ lịch sử nhiều lần mời làm thay khi người được chọn trước đó từ chối.
DROP INDEX "StaffShiftCoverage_leaveRequestId_key";

CREATE INDEX "StaffShiftCoverage_leaveRequestId_createdAt_idx"
ON "StaffShiftCoverage"("leaveRequestId", "createdAt");
