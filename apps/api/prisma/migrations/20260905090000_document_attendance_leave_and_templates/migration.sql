-- Chỉ bổ sung tài liệu trực tiếp trong PostgreSQL; không thay đổi cấu trúc hay dữ liệu.
COMMENT ON TYPE "StaffShiftPeriod" IS
'Phân loại ba khung ca chuẩn: MORNING (sáng), AFTERNOON (chiều), EVENING (tối).';

COMMENT ON TYPE "StaffLeaveType" IS
'Hình thức nghỉ: PLANNED phải báo trước tối thiểu 48 giờ; EMERGENCY dành cho tình huống đột xuất sát giờ hoặc trong ngày.';

COMMENT ON TYPE "StaffLeaveStatus" IS
'Trạng thái đơn nghỉ: PENDING chờ duyệt, NEEDS_INFO cần bổ sung, APPROVED đã duyệt, REJECTED từ chối, CANCELLED nhân viên đã hủy.';

COMMENT ON TABLE "StaffAttendance" IS
'Ca làm thực tế của nhân viên. Một bản ghi có thể nối StaffShift qua scheduledShiftId để hệ thống tính đi trễ, về sớm, tăng ca và vắng mặt.';
COMMENT ON COLUMN "StaffAttendance"."id" IS
'Khóa chính tự tăng của lần chấm công.';
COMMENT ON COLUMN "StaffAttendance"."employeeId" IS
'Nhân viên được ghi nhận giờ làm; dữ liệu lịch sử vẫn được giữ khi tài khoản bị khóa.';
COMMENT ON COLUMN "StaffAttendance"."branchId" IS
'Chi nhánh phát sinh lần chấm công và phạm vi quản lý của trưởng chi nhánh.';
COMMENT ON COLUMN "StaffAttendance"."recordedById" IS
'Người tạo hoặc điều chỉnh bản ghi gần nhất; có thể là nhân viên tự điểm danh hoặc trưởng chi nhánh.';
COMMENT ON COLUMN "StaffAttendance"."scheduledShiftId" IS
'Ca dự kiến dùng làm mốc đối chiếu. Null với dữ liệu ngoài lịch hoặc dữ liệu cũ chưa được ghép ca.';
COMMENT ON COLUMN "StaffAttendance"."clockIn" IS
'Thời điểm bắt đầu làm thực tế, lưu theo timestamp UTC.';
COMMENT ON COLUMN "StaffAttendance"."clockOut" IS
'Thời điểm kết thúc làm thực tế; null nghĩa là ca vẫn đang mở.';
COMMENT ON COLUMN "StaffAttendance"."note" IS
'Lý do điều chỉnh do trưởng chi nhánh nhập. Nội dung này không tự quyết định trạng thái đi trễ hoặc về sớm.';
COMMENT ON COLUMN "StaffAttendance"."openKey" IS
'Khóa duy nhất dạng employee:{id}, chỉ có khi ca đang mở để ngăn một nhân viên bắt đầu nhiều ca cùng lúc.';
COMMENT ON COLUMN "StaffAttendance"."createdAt" IS
'Thời điểm bản ghi chấm công được tạo.';
COMMENT ON COLUMN "StaffAttendance"."updatedAt" IS
'Thời điểm bản ghi chấm công được cập nhật gần nhất.';

COMMENT ON TABLE "StaffLeaveRequest" IS
'Đơn xin nghỉ gắn với một ca cụ thể. Đơn APPROVED được tính là nghỉ có phép thay vì vắng mặt trong bảng công.';
COMMENT ON COLUMN "StaffLeaveRequest"."id" IS
'Khóa chính tự tăng của đơn xin nghỉ.';
COMMENT ON COLUMN "StaffLeaveRequest"."employeeId" IS
'Nhân viên gửi đơn; kết hợp staffShiftId để ngăn gửi hai đơn cho cùng một ca.';
COMMENT ON COLUMN "StaffLeaveRequest"."branchId" IS
'Chi nhánh tiếp nhận và chịu trách nhiệm xét duyệt đơn.';
COMMENT ON COLUMN "StaffLeaveRequest"."staffShiftId" IS
'Ca làm cụ thể mà nhân viên xin nghỉ; không được xóa ca khi đã có đơn để giữ lịch sử.';
COMMENT ON COLUMN "StaffLeaveRequest"."type" IS
'PLANNED là nghỉ báo trước tối thiểu 48 giờ; EMERGENCY là nghỉ đột xuất.';
COMMENT ON COLUMN "StaffLeaveRequest"."status" IS
'Trạng thái xử lý hiện tại của đơn xin nghỉ.';
COMMENT ON COLUMN "StaffLeaveRequest"."reason" IS
'Lý do do nhân viên cung cấp, có thể cập nhật khi đơn ở trạng thái NEEDS_INFO.';
COMMENT ON COLUMN "StaffLeaveRequest"."evidenceUrl" IS
'URL ảnh hoặc PDF minh chứng tùy chọn; API giới hạn loại file và dung lượng tối đa 5 MB.';
COMMENT ON COLUMN "StaffLeaveRequest"."reviewNote" IS
'Phản hồi gần nhất của trưởng chi nhánh; bắt buộc khi REJECTED hoặc NEEDS_INFO.';
COMMENT ON COLUMN "StaffLeaveRequest"."reviewedById" IS
'Trưởng chi nhánh thực hiện quyết định gần nhất; có thể null trước khi xử lý hoặc nếu tài khoản người duyệt bị xóa.';
COMMENT ON COLUMN "StaffLeaveRequest"."reviewedAt" IS
'Thời điểm trưởng chi nhánh đưa ra quyết định gần nhất.';
COMMENT ON COLUMN "StaffLeaveRequest"."createdAt" IS
'Thời điểm nhân viên gửi đơn.';
COMMENT ON COLUMN "StaffLeaveRequest"."updatedAt" IS
'Thời điểm đơn được cập nhật gần nhất.';

COMMENT ON TABLE "StaffShiftTemplate" IS
'Ba khung giờ chuẩn theo từng chi nhánh do Admin cấu hình; chỉ dùng làm mặc định khi xếp lịch và không sửa ngược các StaffShift đã tạo.';
COMMENT ON COLUMN "StaffShiftTemplate"."id" IS
'Khóa chính tự tăng của mẫu ca.';
COMMENT ON COLUMN "StaffShiftTemplate"."branchId" IS
'Chi nhánh áp dụng mẫu ca; xóa chi nhánh sẽ xóa các mẫu tương ứng.';
COMMENT ON COLUMN "StaffShiftTemplate"."period" IS
'Buổi của ca chuẩn: MORNING, AFTERNOON hoặc EVENING; duy nhất trong từng chi nhánh.';
COMMENT ON COLUMN "StaffShiftTemplate"."startTime" IS
'Giờ bắt đầu theo giờ Việt Nam ở định dạng HH:mm.';
COMMENT ON COLUMN "StaffShiftTemplate"."endTime" IS
'Giờ kết thúc theo giờ Việt Nam ở định dạng HH:mm; phải sau startTime và không chồng lấn mẫu ca kế tiếp.';
COMMENT ON COLUMN "StaffShiftTemplate"."createdAt" IS
'Thời điểm cấu hình mẫu ca được tạo.';
COMMENT ON COLUMN "StaffShiftTemplate"."updatedAt" IS
'Thời điểm cấu hình mẫu ca được cập nhật gần nhất.';

COMMENT ON INDEX "StaffAttendance_openKey_key" IS
'Bảo đảm mỗi nhân viên chỉ có tối đa một ca đang mở.';
COMMENT ON INDEX "StaffAttendance_branchId_clockIn_idx" IS
'Tối ưu báo cáo chấm công theo chi nhánh và khoảng ngày.';
COMMENT ON INDEX "StaffAttendance_employeeId_clockIn_idx" IS
'Tối ưu lịch sử giờ làm của từng nhân viên.';
COMMENT ON INDEX "StaffLeaveRequest_employeeId_staffShiftId_key" IS
'Ngăn một nhân viên gửi nhiều đơn xin nghỉ cho cùng một ca.';
COMMENT ON INDEX "StaffLeaveRequest_branchId_status_createdAt_idx" IS
'Tối ưu danh sách duyệt đơn nghỉ theo chi nhánh và trạng thái.';
COMMENT ON INDEX "StaffLeaveRequest_employeeId_createdAt_idx" IS
'Tối ưu lịch sử đơn nghỉ của nhân viên.';
COMMENT ON INDEX "StaffLeaveRequest_staffShiftId_idx" IS
'Tối ưu tra cứu đơn nghỉ gắn với ca làm.';
COMMENT ON INDEX "StaffShiftTemplate_branchId_period_key" IS
'Bảo đảm mỗi chi nhánh chỉ có một mẫu cho mỗi buổi.';
COMMENT ON INDEX "StaffShiftTemplate_branchId_idx" IS
'Tối ưu tải toàn bộ mẫu ca của một chi nhánh.';
