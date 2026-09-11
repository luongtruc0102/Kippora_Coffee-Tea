import type {
  DashboardOverview,
  RevenueStatistic,
  BranchRevenueStatistic,
  OrderStatusStatistic,
  TopProduct,
  RecentOrder,
  TopTopping,
  PaymentStatistics,
  VoucherStatistics,
  DashboardPeriod,
  DashboardDateRange,
  NewCustomerStatistic,
  TopCustomer,
  CustomerRetentionSummary,
  DashboardOperations,
  BranchHealth,
} from '@/types/dashboard';
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  
  function getApiUrl() {
    if (!API_URL) {
      throw new Error('Thiếu NEXT_PUBLIC_API_URL');
    }
  
    return API_URL;
  }

  function withDashboardFilters(
    path: string,
    branchId?: number,
    dateRange?: DashboardDateRange,
  ) {
    const url = new URL(path);
    if (branchId) url.searchParams.set('branchId', String(branchId));
    if (dateRange) {
      url.searchParams.set('from', dateRange.from);
      url.searchParams.set('to', dateRange.to);
    }
    return url.toString();
  }
  
  // Lấy KPI tổng quan của Dashboard
  export async function getDashboardOverview(
    accessToken: string,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<DashboardOverview> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/overview?period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải tổng quan dashboard',
      );
    }
  
    return data;
  }
  
  // Lấy doanh thu theo ngày để vẽ biểu đồ
  export async function getRevenue(
    accessToken: string,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<RevenueStatistic[]> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/revenue?period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải doanh thu',
      );
    }
  
    return data;
  }

  // Lấy doanh thu đơn hoàn thành của từng chi nhánh trong khoảng đang chọn.
  export async function getBranchRevenue(
    accessToken: string,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<BranchRevenueStatistic[]> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/revenue/branches?period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải doanh thu chi nhánh',
      );
    }

    return data;
  }

  // Lấy thống kê số lượng đơn theo trạng thái
  export async function getOrderStatusStatistics(
    accessToken: string,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<OrderStatusStatistic[]> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/orders/status?period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải trạng thái đơn hàng',
      );
    }
  
    return data;
  }

  // Lấy top sản phẩm bán chạy
  export async function getTopProducts(
    accessToken: string,
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<TopProduct[]> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/products/top?limit=${limit}&period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải top sản phẩm',
      );
    }
  
    return data;
  }

  // Lấy các đơn hàng mới nhất
  export async function getRecentOrders(
    accessToken: string,
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<RecentOrder[]> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/orders/recent?limit=${limit}&period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải đơn hàng gần nhất',
      );
    }

    return data;
  }

  // Lấy topping được chọn nhiều nhất
  export async function getTopToppings(
    accessToken: string,
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<TopTopping[]> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/toppings/top?limit=${limit}&period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải top topping',
      );
    }

    return data;
  }

  // Lấy thống kê thanh toán
  export async function getPaymentStatistics(
    accessToken: string,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<PaymentStatistics> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/payments/statistics?period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải thống kê thanh toán',
      );
    }

    return data;
  }

  // Lấy thống kê voucher
  export async function getVoucherStatistics(
    accessToken: string,
    limit = 5,
    period: DashboardPeriod = '7D',
    branchId?: number,
    dateRange?: DashboardDateRange,
  ): Promise<VoucherStatistics> {
    const response = await fetch(
      withDashboardFilters(`${getApiUrl()}/dashboard/vouchers/statistics?limit=${limit}&period=${period}`, branchId, dateRange),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || 'Không thể tải thống kê voucher',
      );
    }

    return data;
  }

// Lấy thống kê khách hàng mới
export async function getNewCustomers(
  accessToken: string,
  period: DashboardPeriod = '7D',
  branchId?: number,
  dateRange?: DashboardDateRange,
): Promise<NewCustomerStatistic[]> {
  const response = await fetch(
    withDashboardFilters(`${getApiUrl()}/dashboard/customers/new?period=${period}`, branchId, dateRange),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Không thể tải khách hàng mới',
    );
  }

  return data;
}

// Lấy các cảnh báo và việc cần xử lý hiện tại trên toàn hệ thống.
export async function getDashboardOperations(
  accessToken: string,
  branchId?: number,
): Promise<DashboardOperations> {
  const response = await fetch(withDashboardFilters(`${getApiUrl()}/dashboard/operations`, branchId), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Không thể tải trung tâm vận hành');
  }

  return data;
}

// Lấy top khách hàng chi tiêu nhiều nhất
export async function getTopCustomers(
  accessToken: string,
  limit = 5,
  period: DashboardPeriod = '7D',
  branchId?: number,
  dateRange?: DashboardDateRange,
): Promise<TopCustomer[]> {
  const response = await fetch(
    withDashboardFilters(`${getApiUrl()}/dashboard/customers/top?limit=${limit}&period=${period}`, branchId, dateRange),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Không thể tải top khách hàng',
    );
  }

  return data;
}

export async function getCustomerRetention(
  accessToken: string,
  period: DashboardPeriod = '7D',
  branchId?: number,
  dateRange?: DashboardDateRange,
): Promise<CustomerRetentionSummary> {
  const response = await fetch(
    withDashboardFilters(`${getApiUrl()}/dashboard/customers/retention?period=${period}`, branchId, dateRange),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || 'Không thể tải thống kê khách hàng',
    );
  }

  return data;
}

// So sánh sức khỏe kinh doanh và vận hành của từng chi nhánh.
export async function getBranchHealth(
  accessToken: string,
  period: DashboardPeriod = '7D',
  branchId?: number,
  dateRange?: DashboardDateRange,
): Promise<BranchHealth[]> {
  const response = await fetch(
    withDashboardFilters(
      `${getApiUrl()}/dashboard/branches/health?period=${period}`,
      branchId,
      dateRange,
    ),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Không thể tải sức khỏe chi nhánh');
  }

  return data;
}
