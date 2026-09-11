import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import {
  DashboardOverviewService,
  DashboardRevenueService,
  DashboardOrdersService,
  DashboardProductsService,
  DashboardPaymentsService,
  DashboardVouchersService,
  DashboardCustomersService,
  DashboardOperationsService,
} from './services/dashboard.index';

function optionalBranchId(value?: string) {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly overviewService: DashboardOverviewService,
    private readonly revenueService: DashboardRevenueService,
    private readonly ordersService: DashboardOrdersService,
    private readonly productsService: DashboardProductsService,
    private readonly paymentsService: DashboardPaymentsService,
    private readonly vouchersService: DashboardVouchersService,
    private readonly customersService: DashboardCustomersService,
    private readonly operationsService: DashboardOperationsService,
  ) {}

  // Trung tâm vận hành: các việc cần Admin chú ý ngay trên toàn hệ thống.
  @Roles('ADMIN')
  @Get('operations')
  getOperations(@Query('branchId') branchId?: string) {
    return this.operationsService.getOperations(optionalBranchId(branchId));
  }

  // Tổng quan KPI theo khoảng thời gian
  @Roles('ADMIN')
  @Get('overview')
  getOverview(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.overviewService.getOverview(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Thống kê trạng thái đơn theo khoảng thời gian
  @Roles('ADMIN')
  @Get('orders/status')
  getOrderStatusStatistics(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.getOrderStatusStatistics(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Đơn hàng gần nhất trong khoảng thời gian
  @Roles('ADMIN')
  @Get('orders/recent')
  getRecentOrders(
    @Query('limit') limit?: string,
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.getRecentOrders(
      limit ? Number(limit) : 5,
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Top sản phẩm theo khoảng thời gian
  @Roles('ADMIN')
  @Get('products/top')
  getTopProducts(
    @Query('limit') limit?: string,
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.productsService.getTopProducts(
      limit ? Number(limit) : 5,
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Top topping theo khoảng thời gian
  @Roles('ADMIN')
  @Get('toppings/top')
  getTopToppings(
    @Query('limit') limit?: string,
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.productsService.getTopToppings(
      limit ? Number(limit) : 5,
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Thống kê thanh toán theo khoảng thời gian
  @Roles('ADMIN')
  @Get('payments/statistics')
  getPaymentStatistics(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.getPaymentStatistics(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Thống kê voucher theo khoảng thời gian
  @Roles('ADMIN')
  @Get('vouchers/statistics')
  getVoucherStatistics(
    @Query('limit') limit?: string,
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.vouchersService.getVoucherStatistics(
      limit ? Number(limit) : 5,
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Khách hàng mới theo khoảng thời gian
  @Roles('ADMIN')
  @Get('customers/new')
  getNewCustomers(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customersService.getNewCustomers(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Top khách hàng theo khoảng thời gian
  @Roles('ADMIN')
  @Get('customers/top')
  getTopCustomers(
    @Query('limit') limit?: string,
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customersService.getTopCustomers(
      limit ? Number(limit) : 5,
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Tỷ lệ khách mới và khách quay lại
  @Roles('ADMIN')
  @Get('customers/retention')
  getCustomerRetention(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customersService.getCustomerRetention(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Doanh thu theo ngày, tháng, năm dùng riêng cho biểu đồ dài hạn
  @Roles('ADMIN')
  @Get('revenue')
  getRevenue(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.revenueService.getRevenue(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // So sánh doanh thu đơn hoàn thành giữa các chi nhánh.
  @Roles('ADMIN')
  @Get('revenue/branches')
  getBranchRevenue(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.revenueService.getBranchRevenue(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }

  // Bảng sức khỏe từng chi nhánh trong khoảng thời gian Dashboard đang chọn.
  @Roles('ADMIN')
  @Get('branches/health')
  getBranchHealth(
    @Query('period') period?: '7D' | '30D' | '1Y' | 'CUSTOM',
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.operationsService.getBranchHealth(
      period ?? '7D',
      optionalBranchId(branchId),
      from,
      to,
    );
  }
}
