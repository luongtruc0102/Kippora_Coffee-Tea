-- Ghi chú nghiệp vụ cho lịch làm; không thay đổi dữ liệu hay cấu trúc bảng.
COMMENT ON TABLE "StaffShift" IS
'Ca làm dự kiến do trưởng chi nhánh xếp cho nhân viên. Nhân viên được mở điểm danh từ 5 phút trước startAt và ca thực tế được nối qua StaffAttendance.scheduledShiftId.';

COMMENT ON COLUMN "StaffShift"."id" IS
'Khóa chính tự tăng của ca làm dự kiến.';

COMMENT ON COLUMN "StaffShift"."employeeId" IS
'Nhân viên thường (role STAFF) được phân công vào ca.';

COMMENT ON COLUMN "StaffShift"."branchId" IS
'Chi nhánh nơi nhân viên thực hiện ca; phải trùng chi nhánh hiện tại của nhân viên.';

COMMENT ON COLUMN "StaffShift"."startAt" IS
'Thời điểm dự kiến bắt đầu ca. Ứng dụng quy đổi từ giờ Việt Nam sang mốc thời gian ISO/UTC trước khi lưu.';

COMMENT ON COLUMN "StaffShift"."endAt" IS
'Thời điểm dự kiến kết thúc ca; phải sau startAt và một ca không dài quá 24 giờ.';

COMMENT ON COLUMN "StaffShift"."note" IS
'Ghi chú phân công không bắt buộc, ví dụ khu vực quầy hoặc nhiệm vụ trong ca.';

COMMENT ON COLUMN "StaffShift"."createdById" IS
'Tài khoản trưởng chi nhánh đã xếp ca. Có thể null nếu tài khoản người tạo bị xóa.';

COMMENT ON COLUMN "StaffShift"."createdAt" IS
'Thời điểm bản ghi lịch làm được tạo.';

COMMENT ON COLUMN "StaffShift"."updatedAt" IS
'Thời điểm bản ghi lịch làm được cập nhật gần nhất.';

COMMENT ON COLUMN "StaffAttendance"."scheduledShiftId" IS
'Ca dự kiến tương ứng với lần chấm công thực tế; có thể null đối với dữ liệu chấm công trước khi có chức năng lịch làm.';

COMMENT ON INDEX "StaffShift_employeeId_startAt_key" IS
'Ngăn một nhân viên có hai ca bắt đầu tại cùng một thời điểm.';

COMMENT ON INDEX "StaffShift_branchId_startAt_idx" IS
'Tối ưu truy vấn lịch tuần theo chi nhánh.';

COMMENT ON INDEX "StaffShift_employeeId_startAt_endAt_idx" IS
'Tối ưu kiểm tra ca trùng và tìm ca đủ điều kiện điểm danh của nhân viên.';

COMMENT ON INDEX "StaffAttendance_scheduledShiftId_idx" IS
'Tối ưu tra cứu các lần chấm công thực tế của một ca đã xếp.';
