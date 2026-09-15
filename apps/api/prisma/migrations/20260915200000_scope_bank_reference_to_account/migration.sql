-- Một mã giao dịch chỉ cần duy nhất trong đúng tài khoản nhận.
-- Hai ngân hàng/chi nhánh khác nhau có thể phát sinh cùng chuỗi mã.
DROP INDEX "BankTransaction_providerReference_key";

CREATE UNIQUE INDEX "BankTransaction_bankAccountId_providerReference_key"
ON "BankTransaction"("bankAccountId", "providerReference");
