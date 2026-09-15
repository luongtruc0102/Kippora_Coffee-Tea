import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { FuzzySearchModule } from './common/fuzzy-search/fuzzy-search.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { ToppingsModule } from './toppings/toppings.module';
import { ProductVariantsModule } from './product-variants/product-variants.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { PaymentsModule } from './payments/payments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AddressesModule } from './addresses/addresses.module';
import { FavoritesModule } from './favorites/favorites.module';
import { StoreSettingsModule } from './store-settings/store-settings.module';
import { InventoryModule } from './inventory/inventory.module';
import { StaffSchedulesModule } from './staff-schedules/staff-schedules.module';
import { StaffLeavesModule } from './staff-leaves/staff-leaves.module';
import { PayrollModule } from './payroll/payroll.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ExpensesModule } from './expenses/expenses.module';
import { CashSessionsModule } from './cash-sessions/cash-sessions.module';
import { ProfitabilityModule } from './profitability/profitability.module';
import { PricingModule } from './pricing/pricing.module';
import { MonthCloseModule } from './month-close/month-close.module';

@Module({
  imports: [
    // Load biến môi trường từ .env và cho phép dùng ở toàn bộ backend
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Fuzzy search dùng chung: hỗ trợ tiếng Việt, sai chính tả và nhiều trường
    FuzzySearchModule,

    // Kết nối database và cung cấp PrismaService cho toàn hệ thống
    PrismaModule,

    // Module kiểm tra trạng thái API và kết nối database
    HealthModule,

    // Module quản lý tài khoản người dùng
    UsersModule,

    // Module xử lý đăng ký, đăng nhập và JWT
    AuthModule,

    // Các module quản lý menu của cửa hàng
    CategoriesModule,
    ProductsModule,
    ToppingsModule,

    ProductVariantsModule,

    // Module xử lý giỏ hàng của người dùng
    CartModule,

    // Module xử lý checkout và đơn hàng
    OrdersModule,

    // Module quản lý mã giảm giá
    VouchersModule,

    // Module xử lý thanh toán đơn hàng
    PaymentsModule,

    // Module thống kê cho ADMIN và STAFF
    DashboardModule,

    // Module uploads hình ảnh
    UploadsModule,

    // Chuông thông báo và trạng thái đã đọc của user
    NotificationsModule,

    // Đánh giá đơn hàng và từng món sau khi đơn hoàn tất
    ReviewsModule,

    // Sổ địa chỉ giao hàng của khách hàng.
    AddressesModule,

    // Danh sách sản phẩm yêu thích của user.
    FavoritesModule,

    // Trạng thái mở cửa và phương thức nhận đơn dùng chung toàn hệ thống.
    StoreSettingsModule,

    // Nguyên liệu, công thức và tồn kho theo chi nhánh.
    InventoryModule,

    // Lịch làm theo tuần và quy tắc mở điểm danh trước ca 5 phút.
    StaffSchedulesModule,

    // Xin nghỉ theo ca, duyệt nghỉ và xử lý nghỉ đột xuất.
    StaffLeavesModule,

    // Tính lương từ bảng công, thưởng/khấu trừ và khóa kỳ lương theo tháng.
    PayrollModule,

    // Nhật ký bất biến cho các thay đổi nhạy cảm trong vận hành.
    AuditLogsModule,

    // Khoản chi vận hành theo chi nhánh và luồng Admin duyệt.
    ExpensesModule,

    // Đối soát tiền mặt theo ngày, trưởng chi nhánh đóng và Admin khóa sổ.
    CashSessionsModule,

    // Giá vốn theo lô và báo cáo lợi nhuận thực tế dành cho Admin.
    ProfitabilityModule,

    // Đề xuất giá theo giá lô FEFO, biên mục tiêu và lịch sử Admin áp dụng giá.
    PricingModule,

    // Chốt sổ kế toán tháng theo chi nhánh và lưu snapshot báo cáo bất biến.
    MonthCloseModule,
  ],

  providers: [
    // Global Guard: mọi API mặc định phải có Access Token,
    // trừ các API được đánh dấu bằng @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Global Guard: kiểm tra quyền truy cập với các API có @Roles(...)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
