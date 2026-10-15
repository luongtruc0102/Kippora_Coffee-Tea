-- CreateTable
CREATE TABLE "ContentPage" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(500),
    "content" TEXT NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "showInHeader" BOOLEAN NOT NULL DEFAULT false,
    "showInFooter" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");
CREATE INDEX "ContentPage_isPublished_category_sortOrder_idx" ON "ContentPage"("isPublished", "category", "sortOrder");
CREATE INDEX "ContentPage_showInHeader_isPublished_sortOrder_idx" ON "ContentPage"("showInHeader", "isPublished", "sortOrder");
CREATE INDEX "ContentPage_showInFooter_isPublished_sortOrder_idx" ON "ContentPage"("showInFooter", "isPublished", "sortOrder");

-- AddForeignKey
ALTER TABLE "ContentPage"
ADD CONSTRAINT "ContentPage_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Nội dung khởi tạo để website có thể dùng ngay; Admin được phép sửa toàn bộ sau migration.
INSERT INTO "ContentPage"
    ("slug", "title", "summary", "content", "category", "isPublished", "showInHeader", "showInFooter", "sortOrder")
VALUES
    (
        'uu-dai',
        'Ưu đãi',
        'Cập nhật chương trình ưu đãi và quyền lợi mới nhất tại Kippora.',
        $$## Ưu đãi tại Kippora
Kippora thường xuyên mang đến các chương trình ưu đãi theo mùa, theo sản phẩm và theo từng chi nhánh.

## Cách sử dụng ưu đãi
- Chọn mã ưu đãi hợp lệ tại bước thanh toán.
- Kiểm tra điều kiện đơn hàng tối thiểu và thời hạn áp dụng.
- Mỗi đơn hàng chỉ áp dụng một mã ưu đãi, trừ khi chương trình có quy định khác.

Ưu đãi đang khả dụng sẽ được hiển thị trực tiếp khi bạn đặt món. Nội dung và thời gian áp dụng có thể được cập nhật theo từng chương trình.$$,
        'ABOUT', true, true, true, 10
    ),
    (
        've-kippora',
        'Về Kippora',
        'Câu chuyện về những ly cà phê, trà và trải nghiệm mỗi ngày một vị vui.',
        $$## Mỗi ngày một vị vui
Kippora Coffee & Tea được xây dựng với mong muốn biến việc thưởng thức cà phê và trà thành một khoảng nghỉ dễ chịu trong ngày.

## Điều Kippora theo đuổi
- Nguyên liệu được quản lý rõ ràng từ nhập kho đến khi pha chế.
- Mỗi món có công thức thống nhất để giữ hương vị ổn định.
- Đặt món thuận tiện, minh bạch trạng thái và dễ dàng liên hệ hỗ trợ.

Kippora luôn lắng nghe góp ý để hoàn thiện sản phẩm và trải nghiệm phục vụ tại từng chi nhánh.$$,
        'ABOUT', true, true, true, 20
    ),
    (
        'thanh-vien-kippora',
        'Thành viên Kippora',
        'Tích điểm từ đơn hàng và nhận thêm quyền lợi dành riêng cho thành viên.',
        $$## Quyền lợi thành viên
Khi đăng nhập và đặt món, điểm thưởng từ đơn hàng hợp lệ sẽ được ghi nhận vào tài khoản của bạn.

## Sử dụng điểm
- Theo dõi điểm hiện có trong trang tài khoản.
- Dùng điểm theo điều kiện hiển thị tại bước thanh toán.
- Điểm không được quy đổi trực tiếp thành tiền mặt.

Nếu điểm chưa được cập nhật sau khi đơn hoàn tất, vui lòng liên hệ Kippora và cung cấp mã đơn hàng để được kiểm tra.$$,
        'ABOUT', true, true, true, 30
    ),
    (
        'tuyen-dung',
        'Tuyển dụng',
        'Cùng Kippora tạo nên trải nghiệm phục vụ chỉn chu và thân thiện.',
        $$## Làm việc tại Kippora
Kippora tìm kiếm những đồng đội yêu thích ngành đồ uống, có tinh thần trách nhiệm và sẵn sàng học hỏi.

## Các vị trí thường tuyển
- Nhân viên phục vụ và pha chế.
- Nhân viên trưởng theo chi nhánh.
- Các vị trí hỗ trợ vận hành khi có nhu cầu.

Ứng viên vui lòng gửi thông tin qua địa chỉ liên hệ của Kippora. Vị trí tuyển dụng cụ thể phụ thuộc vào nhu cầu từng thời điểm.$$,
        'ABOUT', true, false, true, 40
    ),
    (
        'huong-dan-dat-hang',
        'Hướng dẫn đặt hàng',
        'Các bước chọn món, tùy chỉnh và theo dõi đơn hàng trên Kippora.',
        $$## Đặt món nhanh chóng
- Chọn sản phẩm trong Menu.
- Chọn kích cỡ, topping và ghi chú nếu cần.
- Kiểm tra giỏ hàng, hình thức nhận món và thông tin liên hệ.
- Chọn phương thức thanh toán rồi xác nhận đơn.

Sau khi đặt thành công, bạn có thể theo dõi trạng thái trong mục Đơn hàng. Hãy kiểm tra kỹ thông tin trước khi xác nhận để cửa hàng chuẩn bị chính xác.$$,
        'SUPPORT', true, false, true, 50
    ),
    (
        'giao-nhan-va-nhan-tai-quan',
        'Giao nhận và nhận tại quán',
        'Thông tin về phương thức nhận món, thời gian chuẩn bị và giao hàng.',
        $$## Nhận tại quán
Bạn có thể chọn chi nhánh và nhận món sau khi đơn được xác nhận đã sẵn sàng.

## Giao hàng
- Thời gian dự kiến phụ thuộc khoảng cách, tình trạng đơn và đối tác giao nhận.
- Vui lòng cung cấp địa chỉ và số điện thoại chính xác.
- Phí giao hàng được hiển thị trước khi xác nhận thanh toán.

Trong trường hợp giao hàng chậm bất thường, bạn có thể mở chi tiết đơn để kiểm tra hoặc liên hệ cửa hàng.$$,
        'SUPPORT', true, false, true, 60
    ),
    (
        'huy-don-va-hoan-tien',
        'Hủy đơn và hoàn tiền',
        'Điều kiện hủy đơn và quy trình xử lý khoản thanh toán cần hoàn.',
        $$## Hủy đơn
Đơn chỉ có thể hủy khi cửa hàng chưa bắt đầu chuẩn bị món hoặc khi có sự cố được cửa hàng xác nhận.

## Hoàn tiền
- Khoản hoàn được ghi nhận theo đúng phương thức và số tiền đủ điều kiện.
- Thời gian tiền về phụ thuộc ngân hàng hoặc đơn vị thanh toán.
- Kippora có thể yêu cầu mã đơn và thông tin giao dịch để đối soát.

Nếu đơn đã được chuẩn bị, yêu cầu hủy có thể không được chấp nhận do nguyên liệu đã được sử dụng.$$,
        'SUPPORT', true, false, true, 70
    ),
    (
        'cau-hoi-thuong-gap',
        'Câu hỏi thường gặp',
        'Giải đáp nhanh các vấn đề thường gặp khi đặt món và sử dụng tài khoản.',
        $$## Tôi có cần đăng nhập để xem Menu không?
Không. Bạn có thể xem Menu mà không cần đăng nhập, nhưng cần tài khoản để lưu giỏ hàng, theo dõi đơn và tích điểm.

## Vì sao mã ưu đãi không áp dụng được?
Hãy kiểm tra thời hạn, giá trị đơn tối thiểu, sản phẩm áp dụng và số lượt sử dụng còn lại.

## Làm sao cập nhật thông tin cá nhân?
Đăng nhập, mở trang tài khoản và chỉnh sửa hồ sơ của bạn.

Nếu chưa tìm thấy câu trả lời, vui lòng liên hệ Kippora để được hỗ trợ.$$,
        'SUPPORT', true, false, true, 80
    ),
    (
        'chinh-sach-bao-mat',
        'Chính sách bảo mật',
        'Cách Kippora thu thập, sử dụng và bảo vệ thông tin của khách hàng.',
        $$## Thông tin được thu thập
Kippora chỉ thu thập thông tin cần thiết để tạo tài khoản, xử lý đơn hàng, thanh toán, giao nhận và hỗ trợ khách hàng.

## Mục đích sử dụng
- Xác nhận và thực hiện đơn hàng.
- Bảo vệ tài khoản và ngăn ngừa hành vi bất thường.
- Chăm sóc khách hàng và cải thiện chất lượng dịch vụ.

Kippora không bán thông tin cá nhân. Thông tin chỉ được chia sẻ với bên liên quan khi cần hoàn thành dịch vụ hoặc theo yêu cầu hợp pháp.$$,
        'POLICY', true, false, true, 90
    ),
    (
        'dieu-khoan-su-dung',
        'Điều khoản sử dụng',
        'Các nguyên tắc khi sử dụng tài khoản và dịch vụ đặt món của Kippora.',
        $$## Phạm vi áp dụng
Khi sử dụng website Kippora, bạn đồng ý cung cấp thông tin chính xác và chịu trách nhiệm bảo mật tài khoản của mình.

## Trách nhiệm người dùng
- Không sử dụng dịch vụ cho mục đích gian lận hoặc gây ảnh hưởng hệ thống.
- Kiểm tra thông tin món, chi nhánh, địa chỉ và thanh toán trước khi đặt.
- Liên hệ ngay khi phát hiện giao dịch hoặc hoạt động bất thường.

Kippora có quyền tạm khóa tài khoản vi phạm để bảo vệ khách hàng và hoạt động cửa hàng.$$,
        'POLICY', true, false, true, 100
    ),
    (
        'chinh-sach-thanh-toan',
        'Chính sách thanh toán',
        'Phương thức thanh toán, xác nhận giao dịch và nguyên tắc đối soát.',
        $$## Phương thức thanh toán
Các phương thức đang được hỗ trợ sẽ hiển thị tại bước thanh toán và có thể khác nhau theo chi nhánh.

## Xác nhận giao dịch
- Chỉ thanh toán khi nội dung đơn hàng và số tiền đã chính xác.
- Không chia sẻ mã xác nhận ngân hàng hoặc thông tin bảo mật tài khoản.
- Lưu lại mã đơn hàng để Kippora hỗ trợ đối soát khi cần.

Nếu giao dịch đã trừ tiền nhưng đơn chưa được ghi nhận, vui lòng không thanh toán lại ngay và liên hệ hỗ trợ.$$,
        'POLICY', true, false, true, 110
    );
