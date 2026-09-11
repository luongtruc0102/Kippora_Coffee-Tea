-- Tài liệu nghiệp vụ cho toàn bộ nhóm model từ ProductFavorite đến StockReceiptItem.
-- Migration chỉ thêm PostgreSQL COMMENT, không thay đổi cấu trúc hoặc dữ liệu.

COMMENT ON TABLE "ProductFavorite" IS
'Bảng nối danh sách sản phẩm yêu thích của người dùng; khóa chính kép ngăn một người yêu thích cùng sản phẩm nhiều lần.';
COMMENT ON COLUMN "ProductFavorite"."userId" IS 'Người dùng đã đánh dấu yêu thích sản phẩm.';
COMMENT ON COLUMN "ProductFavorite"."productId" IS 'Sản phẩm được đánh dấu yêu thích.';
COMMENT ON COLUMN "ProductFavorite"."createdAt" IS 'Thời điểm sản phẩm được thêm vào danh sách yêu thích.';
COMMENT ON INDEX "ProductFavorite_productId_idx" IS 'Tối ưu đếm và tra cứu lượt yêu thích theo sản phẩm.';
COMMENT ON INDEX "ProductFavorite_userId_createdAt_idx" IS 'Tối ưu tải danh sách yêu thích mới nhất của người dùng.';

COMMENT ON TABLE "StoreSettings" IS
'Cấu hình vận hành chung của toàn hệ thống; ứng dụng luôn đọc và cập nhật bản ghi singleton có id bằng 1.';
COMMENT ON COLUMN "StoreSettings"."id" IS 'Khóa singleton của cấu hình hệ thống, mặc định bằng 1.';
COMMENT ON COLUMN "StoreSettings"."isAcceptingOrders" IS 'Công tắc tổng cho phép hoặc tạm dừng nhận đơn ở mọi chi nhánh.';
COMMENT ON COLUMN "StoreSettings"."deliveryEnabled" IS 'Cho phép khách chọn hình thức giao tận nơi.';
COMMENT ON COLUMN "StoreSettings"."pickupEnabled" IS 'Cho phép khách chọn hình thức đến cửa hàng nhận món.';
COMMENT ON COLUMN "StoreSettings"."openingTime" IS 'Giờ mở cửa theo giờ Việt Nam ở định dạng HH:mm.';
COMMENT ON COLUMN "StoreSettings"."closingTime" IS 'Giờ đóng cửa theo giờ Việt Nam ở định dạng HH:mm.';
COMMENT ON COLUMN "StoreSettings"."preparationMinutes" IS 'Số phút chuẩn dự kiến để chuẩn bị một đơn hàng.';
COMMENT ON COLUMN "StoreSettings"."maxDeliveryDistanceKm" IS 'Bán kính giao hàng tối đa tính từ chi nhánh đến khách, đơn vị kilomet.';
COMMENT ON COLUMN "StoreSettings"."pauseReason" IS 'Lý do tạm dừng nhận đơn hiển thị cho khách.';
COMMENT ON COLUMN "StoreSettings"."createdAt" IS 'Thời điểm tạo cấu hình.';
COMMENT ON COLUMN "StoreSettings"."updatedAt" IS 'Thời điểm cấu hình được cập nhật gần nhất.';

COMMENT ON TABLE "StoreBranch" IS
'Chi nhánh vật lý của Kippora, là phạm vi quản lý nhân viên, đơn hàng, lịch làm, chấm công, tồn kho và phiếu nhập.';
COMMENT ON COLUMN "StoreBranch"."id" IS 'Khóa chính tự tăng của chi nhánh.';
COMMENT ON COLUMN "StoreBranch"."code" IS 'Mã chi nhánh duy nhất dùng trong quản trị, báo cáo và mã chứng từ.';
COMMENT ON COLUMN "StoreBranch"."name" IS 'Tên chi nhánh hiển thị cho khách và nhân viên.';
COMMENT ON COLUMN "StoreBranch"."address" IS 'Địa chỉ hoạt động của chi nhánh.';
COMMENT ON COLUMN "StoreBranch"."phone" IS 'Số điện thoại liên hệ của chi nhánh.';
COMMENT ON COLUMN "StoreBranch"."openedAt" IS 'Ngày khai trương thực tế, độc lập với ngày tạo bản ghi.';
COMMENT ON COLUMN "StoreBranch"."isActive" IS 'Trạng thái sử dụng của chi nhánh; false ngăn vận hành và phân công mới.';
COMMENT ON COLUMN "StoreBranch"."isAcceptingOrders" IS 'Công tắc nhận đơn riêng của chi nhánh.';
COMMENT ON COLUMN "StoreBranch"."pauseReason" IS 'Lý do chi nhánh tạm dừng nhận đơn.';
COMMENT ON COLUMN "StoreBranch"."managerId" IS 'Trưởng chi nhánh; unique ngăn một tài khoản quản lý nhiều chi nhánh.';
COMMENT ON COLUMN "StoreBranch"."createdAt" IS 'Thời điểm tạo chi nhánh.';
COMMENT ON COLUMN "StoreBranch"."updatedAt" IS 'Thời điểm thông tin chi nhánh được cập nhật gần nhất.';
COMMENT ON INDEX "StoreBranch_code_key" IS 'Bảo đảm mã chi nhánh là duy nhất.';
COMMENT ON INDEX "StoreBranch_managerId_key" IS 'Bảo đảm một trưởng chỉ quản lý tối đa một chi nhánh.';

COMMENT ON TABLE "Ingredient" IS
'Danh mục nguyên liệu chuẩn dùng chung cho tồn kho, công thức sản phẩm, topping và lịch sử nhập xuất.';
COMMENT ON COLUMN "Ingredient"."id" IS 'Khóa chính tự tăng của nguyên liệu.';
COMMENT ON COLUMN "Ingredient"."name" IS 'Tên nguyên liệu duy nhất dùng trong kho và công thức.';
COMMENT ON COLUMN "Ingredient"."unit" IS 'Đơn vị chuẩn: GRAM, MILLILITER hoặc PIECE.';
COMMENT ON COLUMN "Ingredient"."isActive" IS 'False nghĩa là ngừng dùng cho nghiệp vụ mới nhưng vẫn giữ toàn bộ lịch sử.';
COMMENT ON COLUMN "Ingredient"."createdAt" IS 'Thời điểm tạo nguyên liệu.';
COMMENT ON COLUMN "Ingredient"."updatedAt" IS 'Thời điểm nguyên liệu được cập nhật gần nhất.';
COMMENT ON INDEX "Ingredient_name_key" IS 'Bảo đảm không có hai nguyên liệu trùng tên.';

COMMENT ON TABLE "InventoryStock" IS
'Số dư kho hiện tại của một nguyên liệu tại một chi nhánh. Lượng có thể dùng bằng quantity trừ reservedQuantity.';
COMMENT ON COLUMN "InventoryStock"."id" IS 'Khóa chính tự tăng của dòng tồn kho.';
COMMENT ON COLUMN "InventoryStock"."branchId" IS 'Chi nhánh sở hữu số lượng nguyên liệu.';
COMMENT ON COLUMN "InventoryStock"."ingredientId" IS 'Nguyên liệu được theo dõi tồn kho.';
COMMENT ON COLUMN "InventoryStock"."quantity" IS 'Tồn thực tế; tăng khi hoàn tất phiếu nhập và giảm khi đơn tiêu thụ nguyên liệu.';
COMMENT ON COLUMN "InventoryStock"."reservedQuantity" IS 'Số lượng đang giữ cho các đơn chưa hoàn tất.';
COMMENT ON COLUMN "InventoryStock"."minimumLevel" IS 'Ngưỡng cảnh báo nhập thêm dựa trên lượng có thể dùng.';
COMMENT ON COLUMN "InventoryStock"."lowStockNotifiedAt" IS 'Lần gần nhất đã gửi cảnh báo tồn thấp để chống thông báo lặp.';
COMMENT ON COLUMN "InventoryStock"."createdAt" IS 'Thời điểm tạo số dư kho.';
COMMENT ON COLUMN "InventoryStock"."updatedAt" IS 'Thời điểm số dư kho được cập nhật gần nhất.';
COMMENT ON INDEX "InventoryStock_branchId_ingredientId_key" IS 'Bảo đảm mỗi chi nhánh chỉ có một dòng tồn cho mỗi nguyên liệu.';
COMMENT ON INDEX "InventoryStock_ingredientId_idx" IS 'Tối ưu tổng hợp tồn của một nguyên liệu trên nhiều chi nhánh.';

COMMENT ON TABLE "VariantRecipeIngredient" IS
'Công thức nguyên liệu của từng biến thể hoặc size sản phẩm; quantity là lượng dùng cho một sản phẩm.';
COMMENT ON COLUMN "VariantRecipeIngredient"."id" IS 'Khóa chính tự tăng của thành phần công thức biến thể.';
COMMENT ON COLUMN "VariantRecipeIngredient"."variantId" IS 'Biến thể hoặc size sản phẩm sở hữu công thức.';
COMMENT ON COLUMN "VariantRecipeIngredient"."ingredientId" IS 'Nguyên liệu cấu thành sản phẩm.';
COMMENT ON COLUMN "VariantRecipeIngredient"."quantity" IS 'Lượng nguyên liệu dùng cho một sản phẩm của biến thể.';
COMMENT ON INDEX "VariantRecipeIngredient_variantId_ingredientId_key" IS 'Ngăn một nguyên liệu xuất hiện hai lần trong cùng công thức biến thể.';
COMMENT ON INDEX "VariantRecipeIngredient_ingredientId_idx" IS 'Tối ưu tìm các biến thể đang sử dụng nguyên liệu.';

COMMENT ON TABLE "ToppingRecipeIngredient" IS
'Công thức nguyên liệu của topping; quantity là lượng dùng cho một phần topping.';
COMMENT ON COLUMN "ToppingRecipeIngredient"."id" IS 'Khóa chính tự tăng của thành phần công thức topping.';
COMMENT ON COLUMN "ToppingRecipeIngredient"."toppingId" IS 'Topping sở hữu công thức.';
COMMENT ON COLUMN "ToppingRecipeIngredient"."ingredientId" IS 'Nguyên liệu cấu thành topping.';
COMMENT ON COLUMN "ToppingRecipeIngredient"."quantity" IS 'Lượng nguyên liệu dùng cho một phần topping.';
COMMENT ON INDEX "ToppingRecipeIngredient_toppingId_ingredientId_key" IS 'Ngăn một nguyên liệu xuất hiện hai lần trong cùng công thức topping.';
COMMENT ON INDEX "ToppingRecipeIngredient_ingredientId_idx" IS 'Tối ưu tìm các topping đang sử dụng nguyên liệu.';

COMMENT ON TABLE "OrderItemRecipeIngredient" IS
'Snapshot công thức của món tại thời điểm đặt, giúp nhân viên pha chế và đối soát kho không bị thay đổi khi công thức gốc được sửa.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."id" IS 'Khóa chính tự tăng của dòng snapshot công thức.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."orderItemId" IS 'Dòng món trong đơn sở hữu snapshot.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."ingredientId" IS 'Nguyên liệu gốc nếu còn tồn tại; có thể null để bảo toàn hóa đơn cũ.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."ingredientName" IS 'Tên nguyên liệu được chụp tại thời điểm đặt.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."unit" IS 'Đơn vị nguyên liệu được chụp tại thời điểm đặt.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."sourceName" IS 'Nguồn tạo lượng dùng, ví dụ sản phẩm, size hoặc topping.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."quantityPerItem" IS 'Lượng dùng cho một sản phẩm hoặc một phần topping.';
COMMENT ON COLUMN "OrderItemRecipeIngredient"."totalQuantity" IS 'Tổng lượng dùng sau khi nhân số lượng món và topping.';
COMMENT ON INDEX "OrderItemRecipeIngredient_orderItemId_idx" IS 'Tối ưu tải công thức chi tiết của một dòng món.';
COMMENT ON INDEX "OrderItemRecipeIngredient_ingredientId_idx" IS 'Tối ưu truy vết lịch sử sử dụng nguyên liệu.';

COMMENT ON TABLE "OrderIngredientReservation" IS
'Tổng lượng mỗi nguyên liệu được đặt giữ cho một đơn và trạng thái vòng đời giữ, tiêu thụ hoặc hoàn trả.';
COMMENT ON COLUMN "OrderIngredientReservation"."id" IS 'Khóa chính tự tăng của dòng đặt giữ nguyên liệu.';
COMMENT ON COLUMN "OrderIngredientReservation"."orderId" IS 'Đơn hàng phát sinh nhu cầu nguyên liệu.';
COMMENT ON COLUMN "OrderIngredientReservation"."ingredientId" IS 'Nguyên liệu được tổng hợp từ công thức các món và topping.';
COMMENT ON COLUMN "OrderIngredientReservation"."quantity" IS 'Tổng lượng nguyên liệu cần cho đơn.';
COMMENT ON COLUMN "OrderIngredientReservation"."state" IS 'Trạng thái vòng đời nguyên liệu của đơn: RESERVED, CONSUMED hoặc RELEASED.';
COMMENT ON COLUMN "OrderIngredientReservation"."createdAt" IS 'Thời điểm bắt đầu đặt giữ.';
COMMENT ON COLUMN "OrderIngredientReservation"."updatedAt" IS 'Thời điểm trạng thái đặt giữ được cập nhật gần nhất.';
COMMENT ON INDEX "OrderIngredientReservation_orderId_ingredientId_key" IS 'Bảo đảm mỗi đơn chỉ có một dòng tổng hợp cho mỗi nguyên liệu.';
COMMENT ON INDEX "OrderIngredientReservation_ingredientId_idx" IS 'Tối ưu tra cứu các đơn đang dùng hoặc giữ một nguyên liệu.';

COMMENT ON TABLE "InventoryMovement" IS
'Sổ nhật ký bất biến của mọi biến động tồn thực tế và lượng đang giữ; lưu số dư sau biến động để phục vụ đối soát.';
COMMENT ON COLUMN "InventoryMovement"."id" IS 'Khóa chính tự tăng của biến động kho.';
COMMENT ON COLUMN "InventoryMovement"."branchId" IS 'Chi nhánh phát sinh biến động.';
COMMENT ON COLUMN "InventoryMovement"."ingredientId" IS 'Nguyên liệu bị thay đổi số dư hoặc lượng đang giữ.';
COMMENT ON COLUMN "InventoryMovement"."orderId" IS 'Đơn hàng liên quan nếu biến động do giữ, hoàn giữ hoặc tiêu thụ.';
COMMENT ON COLUMN "InventoryMovement"."stockReceiptId" IS 'Phiếu nhập liên quan nếu biến động do nhập kho.';
COMMENT ON COLUMN "InventoryMovement"."actorId" IS 'Tài khoản thực hiện; null với tác vụ tự động hoặc khi tài khoản đã bị xóa.';
COMMENT ON COLUMN "InventoryMovement"."type" IS 'Loại nghiệp vụ: ADJUST, RECEIVE, RESERVE, RELEASE hoặc CONSUME.';
COMMENT ON COLUMN "InventoryMovement"."quantityDelta" IS 'Mức thay đổi tồn thực tế; âm là trừ và dương là cộng.';
COMMENT ON COLUMN "InventoryMovement"."reservedDelta" IS 'Mức thay đổi lượng nguyên liệu đang giữ.';
COMMENT ON COLUMN "InventoryMovement"."quantityAfter" IS 'Tồn thực tế ngay sau khi áp dụng biến động.';
COMMENT ON COLUMN "InventoryMovement"."reservedAfter" IS 'Lượng đang giữ ngay sau khi áp dụng biến động.';
COMMENT ON COLUMN "InventoryMovement"."note" IS 'Diễn giải nghiệp vụ hoặc lý do điều chỉnh thủ công.';
COMMENT ON COLUMN "InventoryMovement"."createdAt" IS 'Thời điểm biến động được ghi nhận.';
COMMENT ON INDEX "InventoryMovement_branchId_createdAt_idx" IS 'Tối ưu sổ kho theo chi nhánh và thời gian.';
COMMENT ON INDEX "InventoryMovement_ingredientId_createdAt_idx" IS 'Tối ưu lịch sử biến động của nguyên liệu.';
COMMENT ON INDEX "InventoryMovement_orderId_idx" IS 'Tối ưu truy vết biến động kho theo đơn hàng.';
COMMENT ON INDEX "InventoryMovement_stockReceiptId_idx" IS 'Tối ưu truy vết biến động kho theo phiếu nhập.';

COMMENT ON TABLE "Supplier" IS
'Hồ sơ nhà cung cấp được dùng khi lập và tra cứu phiếu nhập kho.';
COMMENT ON COLUMN "Supplier"."id" IS 'Khóa chính tự tăng của nhà cung cấp.';
COMMENT ON COLUMN "Supplier"."code" IS 'Mã nhà cung cấp duy nhất dùng trên chứng từ.';
COMMENT ON COLUMN "Supplier"."name" IS 'Tên pháp lý hoặc tên giao dịch của nhà cung cấp.';
COMMENT ON COLUMN "Supplier"."contactName" IS 'Người phụ trách liên hệ phía nhà cung cấp.';
COMMENT ON COLUMN "Supplier"."phone" IS 'Số điện thoại liên hệ.';
COMMENT ON COLUMN "Supplier"."email" IS 'Email liên hệ.';
COMMENT ON COLUMN "Supplier"."address" IS 'Địa chỉ giao dịch hoặc giao hàng.';
COMMENT ON COLUMN "Supplier"."note" IS 'Điều khoản, lịch giao hoặc thông tin cần lưu ý.';
COMMENT ON COLUMN "Supplier"."isActive" IS 'False ngăn chọn cho phiếu mới nhưng vẫn giữ lịch sử.';
COMMENT ON COLUMN "Supplier"."createdAt" IS 'Thời điểm tạo hồ sơ nhà cung cấp.';
COMMENT ON COLUMN "Supplier"."updatedAt" IS 'Thời điểm hồ sơ được cập nhật gần nhất.';
COMMENT ON INDEX "Supplier_code_key" IS 'Bảo đảm mã nhà cung cấp là duy nhất.';
COMMENT ON INDEX "Supplier_name_idx" IS 'Tối ưu tìm kiếm nhà cung cấp theo tên.';
COMMENT ON INDEX "Supplier_isActive_idx" IS 'Tối ưu lọc nhà cung cấp đang hoạt động.';

COMMENT ON TABLE "StockReceipt" IS
'Phiếu nhập nguyên liệu cho một chi nhánh. Chỉ trạng thái COMPLETED mới cộng số lượng vào tồn kho.';
COMMENT ON COLUMN "StockReceipt"."id" IS 'Khóa chính tự tăng của phiếu nhập.';
COMMENT ON COLUMN "StockReceipt"."code" IS 'Mã phiếu nhập duy nhất dùng để đối soát.';
COMMENT ON COLUMN "StockReceipt"."branchId" IS 'Chi nhánh nhận hàng.';
COMMENT ON COLUMN "StockReceipt"."supplierId" IS 'Nhà cung cấp giao hàng cho phiếu.';
COMMENT ON COLUMN "StockReceipt"."createdById" IS 'Tài khoản Admin lập phiếu nhập.';
COMMENT ON COLUMN "StockReceipt"."status" IS 'DRAFT chưa cộng kho; COMPLETED đã cộng kho; CANCELLED đã hủy.';
COMMENT ON COLUMN "StockReceipt"."receivedAt" IS 'Thời điểm hàng thực tế được xác nhận nhập kho.';
COMMENT ON COLUMN "StockReceipt"."note" IS 'Ghi chú giao nhận hoặc nội dung đối soát.';
COMMENT ON COLUMN "StockReceipt"."totalCost" IS 'Tổng giá trị phiếu bằng tổng thành tiền các dòng nguyên liệu.';
COMMENT ON COLUMN "StockReceipt"."createdAt" IS 'Thời điểm lập phiếu.';
COMMENT ON COLUMN "StockReceipt"."updatedAt" IS 'Thời điểm phiếu được cập nhật gần nhất.';
COMMENT ON INDEX "StockReceipt_code_key" IS 'Bảo đảm mã phiếu nhập là duy nhất.';
COMMENT ON INDEX "StockReceipt_branchId_createdAt_idx" IS 'Tối ưu lịch sử nhập hàng theo chi nhánh.';
COMMENT ON INDEX "StockReceipt_supplierId_createdAt_idx" IS 'Tối ưu lịch sử nhập hàng theo nhà cung cấp.';
COMMENT ON INDEX "StockReceipt_status_createdAt_idx" IS 'Tối ưu lọc phiếu nhập theo trạng thái và thời gian.';

COMMENT ON TABLE "StockReceiptItem" IS
'Chi tiết nguyên liệu của phiếu nhập, lưu số lượng, đơn giá và thành tiền tại thời điểm lập phiếu.';
COMMENT ON COLUMN "StockReceiptItem"."id" IS 'Khóa chính tự tăng của dòng phiếu nhập.';
COMMENT ON COLUMN "StockReceiptItem"."receiptId" IS 'Phiếu nhập sở hữu dòng chi tiết.';
COMMENT ON COLUMN "StockReceiptItem"."ingredientId" IS 'Nguyên liệu được nhập.';
COMMENT ON COLUMN "StockReceiptItem"."quantity" IS 'Số lượng nhập theo đơn vị chuẩn của nguyên liệu.';
COMMENT ON COLUMN "StockReceiptItem"."unitCost" IS 'Đơn giá nhập cho một đơn vị nguyên liệu.';
COMMENT ON COLUMN "StockReceiptItem"."lineTotal" IS 'Thành tiền của dòng bằng quantity nhân unitCost.';
COMMENT ON COLUMN "StockReceiptItem"."createdAt" IS 'Thời điểm tạo dòng phiếu.';
COMMENT ON COLUMN "StockReceiptItem"."updatedAt" IS 'Thời điểm dòng phiếu được cập nhật gần nhất.';
COMMENT ON INDEX "StockReceiptItem_receiptId_ingredientId_key" IS 'Ngăn một nguyên liệu xuất hiện nhiều lần trên cùng phiếu.';
COMMENT ON INDEX "StockReceiptItem_ingredientId_idx" IS 'Tối ưu lịch sử nhập theo nguyên liệu.';
