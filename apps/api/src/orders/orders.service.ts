import type { OrderStatus } from '../../generated/prisma/enums';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';
import { DeliveryLocationQuoteDto } from './dto/delivery-location-quote.dto';
import { DeliveryQuoteDto } from './dto/delivery-quote.dto';
import { VouchersService } from '../vouchers/vouchers.service';
import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';
import { CreatePosOrderDto } from './dto/create-pos-order.dto';
import { InventoryService } from '../inventory/inventory.service';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { CancelManagedOrderDto } from './dto/cancel-managed-order.dto';
import { createBankTransferMetadata } from '../payments/payment-reference.util';

const refundInclude = {
  processedBy: {
    select: { id: true, email: true, ...personProfileSelect },
  },
} as const;

function serializeRefund<
  T extends {
    amount: { toString(): string } | number;
    processedBy: Parameters<typeof flattenPersonProfile>[0];
  },
>(refund: T | null) {
  return refund
    ? {
        ...refund,
        amount: Number(refund.amount.toString()),
        processedBy: flattenPersonProfile(refund.processedBy),
      }
    : null;
}

// Cấu trúc chung cho CartItem và OrderItem nguồn sau khi đã nạp dữ liệu hiện tại.
type CheckoutSourceItem = {
  id: number;
  productId: number;
  variantId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    category: { isActive: boolean };
  };
  variant: {
    id: number;
    productId: number;
    size: string;
    price: number;
    isActive: boolean;
  };
  toppings: Array<{
    toppingId: number;
    topping: {
      id: number;
      name: string;
      price: number;
      isActive: boolean;
    };
  }>;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vouchersService: VouchersService,
    private readonly fuzzySearch: FuzzySearchService,
    private readonly storeSettingsService: StoreSettingsService,
    private readonly inventoryService: InventoryService,
  ) {}

  private async getStaffBranchId(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { staffProfile: { select: { branchId: true } } },
    });

    if (!user?.staffProfile?.branchId) {
      throw new NotFoundException('Nhân viên chưa được gán chi nhánh');
    }

    return user.staffProfile.branchId;
  }

  // Nội dung tập trung tại backend để chuông, toast và lịch sử luôn đồng nhất.
  private buildOrderStatusNotification(order: {
    id: number;
    status: OrderStatus;
    fulfillmentMethod: 'DELIVERY' | 'PICKUP';
  }) {
    const content: Partial<
      Record<OrderStatus, { title: string; message: string }>
    > = {
      CONFIRMED: {
        title: 'Đơn hàng đã được xác nhận',
        message: `Cửa hàng đã xác nhận đơn #${order.id}.`,
      },
      PREPARING: {
        title: 'Cửa hàng đang chuẩn bị món',
        message: `Đơn #${order.id} đang được pha chế và đóng gói.`,
      },
      DELIVERING: {
        title: 'Đơn hàng đang được giao',
        message: `Đơn #${order.id} đang trên đường giao đến bạn.`,
      },
      COMPLETED: {
        title: 'Đơn hàng đã hoàn tất',
        message: `Đơn #${order.id} đã hoàn tất. Cảm ơn bạn đã chọn Kippora!`,
      },
      CANCELLED: {
        title: 'Đơn hàng đã bị hủy',
        message: `Đơn #${order.id} đã bị hủy. Xem chi tiết để biết thêm thông tin.`,
      },
      READY_FOR_PICKUP: {
        title: 'Đơn hàng đã sẵn sàng nhận',
        message: `Đơn #${order.id} đã chuẩn bị xong. Bạn có thể đến quán nhận món.`,
      },
    };

    const selected = content[order.status];
    if (!selected) {
      return null;
    }

    return {
      orderId: order.id,
      type: 'ORDER_STATUS',
      ...selected,
    };
  }

  private getStoreCoordinates() {
    const latitude = Number(process.env.STORE_LATITUDE ?? '10.8569371');
    const longitude = Number(process.env.STORE_LONGITUDE ?? '106.7465042');

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Tọa độ cửa hàng chưa được cấu hình');
    }

    return { latitude, longitude };
  }

  private getStoreAddress() {
    return (
      process.env.STORE_ADDRESS ??
      '78 Đường Số 29, phường Hiệp Bình, TP. Hồ Chí Minh'
    );
  }

  private calculateDeliveryPricing(distanceKm: number, subtotal: number) {
    const deliveryBaseFee =
      15000 + Math.max(0, Math.ceil(distanceKm - 3)) * 5000;
    const requestedDiscount =
      subtotal >= 500000 ? 40000 : subtotal >= 300000 ? 20000 : 0;
    const deliveryDiscountAmount = Math.min(requestedDiscount, deliveryBaseFee);

    return {
      deliveryBaseFee,
      deliveryDiscountAmount,
      deliveryFee: deliveryBaseFee - deliveryDiscountAmount,
    };
  }

  private async getDrivingRoute(
    destinationLatitude: number,
    destinationLongitude: number,
    includeGeometry = false,
    reverseRoute = false,
  ) {
    const store = this.getStoreCoordinates();
    const routeOptions = includeGeometry
      ? 'overview=full&geometries=geojson'
      : 'overview=false';
    const routePoints = reverseRoute
      ? `${destinationLongitude},${destinationLatitude};${store.longitude},${store.latitude}`
      : `${store.longitude},${store.latitude};${destinationLongitude},${destinationLatitude}`;
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${routePoints}?${routeOptions}`,
    );
    const data = (await response.json()) as {
      code: string;
      routes?: Array<{
        distance: number;
        geometry?: {
          type: 'LineString';
          coordinates: Array<[number, number]>;
        };
      }>;
    };

    if (!response.ok || data.code !== 'Ok' || !data.routes?.[0]) {
      throw new BadRequestException('Không thể tính tuyến đường giao hàng');
    }

    const route = data.routes[0];

    return {
      distanceKm: Math.ceil((route.distance / 1000) * 10) / 10,
      routeCoordinates:
        route.geometry?.coordinates.map(([longitude, latitude]) => ({
          latitude,
          longitude,
        })) ?? [],
    };
  }

  private getMapRequestHeaders() {
    return {
      'User-Agent': 'Kippora/1.0',
      'Accept-Language': 'vi',
    };
  }

  private formatPhotonAddress(properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  }) {
    const streetAddress = [properties.housenumber, properties.street]
      .filter(Boolean)
      .join(' ');
    const parts = [
      streetAddress,
      properties.name,
      properties.district,
      properties.city,
      properties.county,
      properties.state,
      properties.postcode,
      properties.country,
    ].filter((part): part is string => Boolean(part?.trim()));

    return parts
      .filter(
        (part, index) =>
          parts.findIndex(
            (candidate) => candidate.toLowerCase() === part.toLowerCase(),
          ) === index,
      )
      .join(', ');
  }

  private async reverseGeocode(latitude: number, longitude: number) {
    const response = await fetch(
      `https://photon.komoot.io/reverse?limit=1&lat=${latitude}&lon=${longitude}`,
      {
        headers: this.getMapRequestHeaders(),
      },
    );
    const data = (await response.json()) as {
      features?: Array<{
        properties: Parameters<OrdersService['formatPhotonAddress']>[0];
      }>;
    };
    const normalizedAddress = data.features?.[0]
      ? this.formatPhotonAddress(data.features[0].properties)
      : '';

    if (!response.ok || !normalizedAddress) {
      throw new BadRequestException(
        'Không tìm thấy địa chỉ tại vị trí đã chọn',
      );
    }

    return normalizedAddress;
  }

  private async buildDeliveryQuote(
    latitude: number,
    longitude: number,
    normalizedAddress: string,
    subtotal: number,
    fulfillmentMethod?: 'DELIVERY' | 'PICKUP',
  ) {
    const isPickupRoute = fulfillmentMethod === 'PICKUP';
    const route = await this.getDrivingRoute(
      latitude,
      longitude,
      true,
      isPickupRoute,
    );
    const deliveryPricing = isPickupRoute
      ? {
          deliveryBaseFee: 0,
          deliveryDiscountAmount: 0,
          deliveryFee: 0,
        }
      : this.calculateDeliveryPricing(route.distanceKm, subtotal);

    return {
      latitude,
      longitude,
      normalizedAddress,
      distanceKm: route.distanceKm,
      routeCoordinates: route.routeCoordinates,
      ...deliveryPricing,
    };
  }

  async searchAddressSuggestions(query: string) {
    const store = this.getStoreCoordinates();
    const response = await fetch(
      `https://photon.komoot.io/api/?limit=5&countrycode=VN&lat=${store.latitude}&lon=${store.longitude}&q=${encodeURIComponent(query.trim())}`,
      { headers: this.getMapRequestHeaders() },
    );
    const data = (await response.json()) as {
      features?: Array<{
        geometry: {
          coordinates: [number, number];
        };
        properties: Parameters<OrdersService['formatPhotonAddress']>[0] & {
          osm_id?: number;
          osm_type?: string;
          countrycode?: string;
        };
      }>;
    };

    if (!response.ok) {
      throw new BadRequestException('Không thể tải gợi ý địa chỉ');
    }

    return (data.features ?? [])
      .map((feature, index) => ({
        id: `${feature.properties.osm_type ?? 'place'}-${feature.properties.osm_id ?? index}`,
        displayName: this.formatPhotonAddress(feature.properties),
        latitude: Number(feature.geometry.coordinates[1]),
        longitude: Number(feature.geometry.coordinates[0]),
        countryCode: feature.properties.countrycode?.toLowerCase(),
      }))
      .filter(
        (result) =>
          result.displayName &&
          Number.isFinite(result.latitude) &&
          Number.isFinite(result.longitude) &&
          (!result.countryCode || result.countryCode === 'vn'),
      )
      .map((result) => ({
        id: result.id,
        displayName: result.displayName,
        latitude: result.latitude,
        longitude: result.longitude,
      }));
  }

  async quoteDelivery(deliveryQuoteDto: DeliveryQuoteDto) {
    const geocodeResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(deliveryQuoteDto.deliveryAddress.trim())}`,
      { headers: this.getMapRequestHeaders() },
    );
    const geocodeData = (await geocodeResponse.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!geocodeResponse.ok || geocodeData.length === 0) {
      throw new BadRequestException('Không tìm thấy địa chỉ trên bản đồ');
    }

    return this.buildDeliveryQuote(
      Number(geocodeData[0].lat),
      Number(geocodeData[0].lon),
      geocodeData[0].display_name,
      deliveryQuoteDto.subtotal,
      deliveryQuoteDto.fulfillmentMethod,
    );
  }

  async quoteDeliveryLocation(
    deliveryLocationQuoteDto: DeliveryLocationQuoteDto,
  ) {
    const normalizedAddress =
      deliveryLocationQuoteDto.deliveryAddress?.trim() ||
      (await this.reverseGeocode(
        deliveryLocationQuoteDto.latitude,
        deliveryLocationQuoteDto.longitude,
      ));

    return this.buildDeliveryQuote(
      deliveryLocationQuoteDto.latitude,
      deliveryLocationQuoteDto.longitude,
      normalizedAddress,
      deliveryLocationQuoteDto.subtotal,
      deliveryLocationQuoteDto.fulfillmentMethod,
    );
  }

  /**
   * Tạo nguồn checkout tạm từ đơn cũ bằng dữ liệu sản phẩm hiện tại.
   * Hàm chỉ đọc OrderItem, tuyệt đối không tạo hoặc cập nhật CartItem.
   */
  private async getReorderCheckoutItems(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            product: { include: { category: true } },
            variant: true,
            toppings: {
              include: {
                topping: { include: { products: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const items: CheckoutSourceItem[] = [];
    const skippedItems: Array<{
      orderItemId: number;
      productName: string;
      reason: string;
    }> = [];

    for (const item of order.items) {
      let reason = '';

      if (!item.product.isActive || !item.product.category.isActive) {
        reason = 'Sản phẩm hiện không còn khả dụng';
      } else if (
        !item.variant.isActive ||
        item.variant.productId !== item.productId
      ) {
        reason = 'Size hiện không còn khả dụng';
      } else {
        const invalidTopping = item.toppings.find(
          (itemTopping) =>
            !itemTopping.topping.isActive ||
            !itemTopping.topping.products.some(
              (productTopping) => productTopping.productId === item.productId,
            ),
        );

        if (invalidTopping) {
          reason = `Topping "${invalidTopping.topping.name}" hiện không còn khả dụng`;
        }
      }

      if (reason) {
        skippedItems.push({
          orderItemId: item.id,
          productName: item.productName,
          reason,
        });
        continue;
      }

      items.push({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          imageUrl: item.product.imageUrl,
          isActive: item.product.isActive,
          category: { isActive: item.product.category.isActive },
        },
        variant: {
          id: item.variant.id,
          productId: item.variant.productId,
          size: item.variant.size,
          price: Number(item.variant.price),
          isActive: item.variant.isActive,
        },
        toppings: item.toppings.map((itemTopping) => ({
          toppingId: itemTopping.toppingId,
          topping: {
            id: itemTopping.topping.id,
            name: itemTopping.topping.name,
            price: Number(itemTopping.topping.price),
            isActive: itemTopping.topping.isActive,
          },
        })),
      });
    }

    return {
      order,
      items,
      skippedItems,
    };
  }

  // Checkout các món được chọn trong giỏ hàng và tạo Order
  async checkout(userId: number, checkoutDto: CheckoutDto) {
    // Kiểm tra sớm để không xử lý giỏ hàng khi cửa hàng đang đóng/tạm nghỉ.
    const initialStoreStatus =
      await this.storeSettingsService.assertCanCheckout(
        checkoutDto.fulfillmentMethod,
      );

    const hasCartSource = Boolean(checkoutDto.cartItemIds?.length);
    const hasReorderSource = Boolean(
      checkoutDto.reorderOrderId && checkoutDto.reorderOrderItemIds?.length,
    );

    // Chỉ chấp nhận đúng một nguồn để không thể trộn CartItem và OrderItem.
    if (hasCartSource === hasReorderSource) {
      throw new BadRequestException(
        'Vui lòng chọn sản phẩm từ giỏ hàng hoặc từ đơn mua lại',
      );
    }

    // Giữ nguyên một chi nhánh từ lúc bắt đầu đến lúc tạo Order.
    const branchId = initialStoreStatus.branch.id;

    let selectedItems: CheckoutSourceItem[];

    if (hasReorderSource) {
      const reorderOrderId = checkoutDto.reorderOrderId!;
      const requestedItemIds = checkoutDto.reorderOrderItemIds!;
      const reorderSource = await this.getReorderCheckoutItems(
        userId,
        reorderOrderId,
      );

      selectedItems = reorderSource.items.filter((item) =>
        requestedItemIds.includes(item.id),
      );

      if (selectedItems.length !== requestedItemIds.length) {
        const unavailable = reorderSource.skippedItems.find((item) =>
          requestedItemIds.includes(item.orderItemId),
        );
        throw new BadRequestException(
          unavailable
            ? `${unavailable.productName}: ${unavailable.reason}`
            : 'Có món mua lại không thuộc đơn hàng hoặc không còn khả dụng',
        );
      }
    } else {
      const cartItemIds = checkoutDto.cartItemIds!;

      // Checkout thường vẫn lấy và xác minh CartItem thuộc đúng user.
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: { category: true },
              },
              variant: true,
              toppings: {
                include: { topping: true },
              },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Giỏ hàng đang trống');
      }

      selectedItems = cart.items
        .filter((item) => cartItemIds.includes(item.id))
        .map((item) => ({
          ...item,
          variant: {
            ...item.variant,
            price: Number(item.variant.price),
          },
          toppings: item.toppings.map((itemTopping) => ({
            toppingId: itemTopping.toppingId,
            topping: {
              ...itemTopping.topping,
              price: Number(itemTopping.topping.price),
            },
          })),
        }));

      if (selectedItems.length !== cartItemIds.length) {
        throw new BadRequestException(
          'Có sản phẩm được chọn không tồn tại trong giỏ hàng',
        );
      }
    }

    if (selectedItems.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất một sản phẩm để thanh toán',
      );
    }

    // Kiểm tra lại trạng thái sản phẩm ngay trước khi tạo Order
    for (const item of selectedItems) {
      if (!item.product.isActive || !item.product.category.isActive) {
        throw new BadRequestException(
          `Sản phẩm "${item.product.name}" hiện không còn khả dụng`,
        );
      }

      if (!item.variant.isActive) {
        throw new BadRequestException(
          `Size "${item.variant.size}" của sản phẩm "${item.product.name}" hiện không còn khả dụng`,
        );
      }

      const invalidTopping = item.toppings.find(
        (itemTopping) => !itemTopping.topping.isActive,
      );

      if (invalidTopping) {
        throw new BadRequestException(
          `Topping "${invalidTopping.topping.name}" hiện không còn khả dụng`,
        );
      }
    }

    // Backend luôn tính lại giá từ database
    const calculatedItems = selectedItems.map((item) => {
      const variantPrice = Number(item.variant.price);

      const toppingTotal = item.toppings.reduce(
        (total, itemTopping) => total + Number(itemTopping.topping.price),
        0,
      );

      const unitPrice = variantPrice + toppingTotal;

      const lineTotal = unitPrice * item.quantity;

      return {
        item,
        variantPrice,
        unitPrice,
        lineTotal,
      };
    });

    // Tổng tiền các món được chọn trước khi giảm giá
    const subtotal = calculatedItems.reduce(
      (total, current) => total + current.lineTotal,
      0,
    );

    // Backend tự quyết định phí dựa trên cách khách nhận món.
    const isPickup = checkoutDto.fulfillmentMethod === 'PICKUP';
    const storeCoordinates = this.getStoreCoordinates();
    const deliveryAddress = isPickup
      ? this.getStoreAddress()
      : checkoutDto.deliveryAddress.trim();
    const deliveryLatitude = isPickup
      ? storeCoordinates.latitude
      : Number(checkoutDto.deliveryLatitude);
    const deliveryLongitude = isPickup
      ? storeCoordinates.longitude
      : Number(checkoutDto.deliveryLongitude);
    const deliveryDistanceKm = isPickup
      ? 0
      : (await this.getDrivingRoute(deliveryLatitude, deliveryLongitude))
          .distanceKm;

    // Backend chặn lần cuối nếu địa chỉ vượt quá bán kính giao hàng.
    await this.storeSettingsService.assertCanCheckout(
      checkoutDto.fulfillmentMethod,
      deliveryDistanceKm,
      branchId,
    );
    const { deliveryBaseFee, deliveryDiscountAmount, deliveryFee } = isPickup
      ? {
          deliveryBaseFee: 0,
          deliveryDiscountAmount: 0,
          deliveryFee: 0,
        }
      : this.calculateDeliveryPricing(deliveryDistanceKm, subtotal);

    // =========================
    // VOUCHER
    // =========================

    let discountAmount = 0;

    const voucherIds: number[] = [];
    const appliedVouchers: Array<{
      voucherId: number;
      code: string;
      discountAmount: number;
    }> = [];

    let voucherCode: string | undefined;

    const requestedVoucherCodes = [
      ...(checkoutDto.voucherCodes ?? []),
      ...(checkoutDto.voucherCode ? [checkoutDto.voucherCode] : []),
    ].map((code) => code.trim().toUpperCase());

    if (new Set(requestedVoucherCodes).size !== requestedVoucherCodes.length) {
      throw new BadRequestException('Không thể áp dụng một voucher nhiều lần');
    }

    if (requestedVoucherCodes.length > 2) {
      throw new BadRequestException(
        'Mỗi đơn hàng chỉ được dùng tối đa 2 voucher',
      );
    }

    if (requestedVoucherCodes.length > 0) {
      const appliedVoucherCodes: string[] = [];

      for (const code of requestedVoucherCodes) {
        // Mỗi voucher được kiểm tra độc lập theo tổng tiền hàng gốc.
        const voucherResult = await this.vouchersService.validateForCheckout(
          code,
          subtotal,
          userId,
        );

        if (voucherResult.voucher) {
          voucherIds.push(voucherResult.voucher.id);
          appliedVouchers.push({
            voucherId: voucherResult.voucher.id,
            code: voucherResult.voucherCode,
            discountAmount: voucherResult.discountAmount,
          });
        }

        appliedVoucherCodes.push(voucherResult.voucherCode);
        discountAmount += voucherResult.discountAmount;
      }

      discountAmount = Math.min(discountAmount, subtotal);
      voucherCode = appliedVoucherCodes.join(', ');
    }

    // Giữ relation cũ trỏ tới voucher đầu tiên; voucherCode lưu snapshot đủ các mã.
    const voucherId = voucherIds[0];

    // =========================
    // LOYALTY POINTS
    // =========================

    let loyaltyPointsUsed = 0;
    let loyaltyDiscountAmount = 0;

    const requestedPoints = checkoutDto.loyaltyPointsToUse ?? 0;

    if (requestedPoints > 0) {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        include: {
          role: true,
          customerProfile: true,
        },
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      // Chỉ khách hàng USER được dùng điểm
      if (user.role.name !== 'USER') {
        throw new BadRequestException(
          'Chỉ khách hàng mới được sử dụng điểm tích lũy',
        );
      }

      // Có từ 1.000 điểm là được mở khóa đổi điểm.
      const currentPoints = user.customerProfile?.loyaltyPoints ?? 0;
      if (currentPoints < 1000) {
        throw new BadRequestException(
          'Bạn cần đạt ít nhất 1.000 điểm để sử dụng điểm tích lũy',
        );
      }

      // Chỉ cho sử dụng theo bội số 1.000 điểm
      if (requestedPoints % 1000 !== 0) {
        throw new BadRequestException(
          'Số điểm sử dụng phải là bội số của 1.000',
        );
      }

      if (requestedPoints > currentPoints) {
        throw new BadRequestException(
          'Số điểm sử dụng vượt quá số điểm hiện có',
        );
      }

      loyaltyPointsUsed = requestedPoints;

      // 1.000 điểm = giảm 1.000đ
      loyaltyDiscountAmount = requestedPoints;
    }

    // =========================
    // TOTAL
    // =========================

    const priceAfterVoucher = subtotal - discountAmount;

    // Không cho điểm giảm nhiều hơn số tiền còn lại
    if (loyaltyDiscountAmount > priceAfterVoucher) {
      throw new BadRequestException(
        'Số điểm sử dụng vượt quá giá trị đơn hàng còn lại',
      );
    }

    const totalPrice = priceAfterVoucher - loyaltyDiscountAmount + deliveryFee;

    // =========================
    // TRANSACTION
    // =========================

    return this.prisma.$transaction(async (tx) => {
      if (loyaltyPointsUsed > 0) {
        // Trừ điểm an toàn để tránh 2 checkout đồng thời dùng cùng số điểm
        const result = await tx.customerProfile.updateMany({
          where: {
            userId,

            loyaltyPoints: {
              gte: loyaltyPointsUsed,
            },
          },

          data: {
            loyaltyPoints: {
              decrement: loyaltyPointsUsed,
            },
          },
        });

        if (result.count === 0) {
          throw new BadRequestException(
            'Số điểm hiện tại không đủ để thanh toán',
          );
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          branchId,

          // Snapshot thông tin người nhận
          fulfillmentMethod: checkoutDto.fulfillmentMethod,

          receiverName: checkoutDto.receiverName,

          receiverPhone: checkoutDto.receiverPhone,

          deliveryAddress,
          deliveryLatitude,
          deliveryLongitude,
          deliveryDistanceKm,
          deliveryBaseFee,
          deliveryDiscountAmount,
          deliveryFee,

          // Ghi chú của khách cho đơn hàng
          note: checkoutDto.note,

          subtotal,

          discountAmount,

          loyaltyDiscountAmount,

          totalPrice,

          voucherId,

          voucherCode,

          loyaltyPointsUsed,

          payment: {
            create: {
              method: checkoutDto.paymentMethod,
              amount: totalPrice,
              ...createBankTransferMetadata(checkoutDto.paymentMethod),
            },
          },

          appliedVouchers: {
            create: appliedVouchers.map((appliedVoucher) => ({
              voucherId: appliedVoucher.voucherId,
              code: appliedVoucher.code,
              discountAmount: appliedVoucher.discountAmount,
            })),
          },

          items: {
            create: calculatedItems.map(
              ({ item, variantPrice, unitPrice, lineTotal }) => ({
                productId: item.productId,

                variantId: item.variantId,

                // Snapshot để lịch sử đơn không bị thay đổi về sau
                productName: item.product.name,

                size: item.variant.size,

                variantPrice,

                quantity: item.quantity,

                unitPrice,

                lineTotal,

                toppings: {
                  create: item.toppings.map((itemTopping) => ({
                    toppingId: itemTopping.toppingId,

                    // Snapshot topping tại thời điểm mua
                    toppingName: itemTopping.topping.name,

                    toppingPrice: itemTopping.topping.price,
                  })),
                },
              }),
            ),
          },
        },

        include: {
          voucher: true,
          appliedVouchers: { include: { voucher: true } },
          payment: true,
          items: {
            include: {
              toppings: true,
            },
          },
        },
      });

      order.inventoryState = await this.inventoryService.reserveForOrder(
        tx,
        order.id,
        order.branchId,
        userId,
      );

      if (voucherIds.length > 0) {
        // Tăng lượt dùng cho toàn bộ voucher DB đã áp dụng.
        await Promise.all(
          voucherIds.map((id) =>
            tx.voucher.update({
              where: { id },
              data: {
                usedCount: {
                  increment: 1,
                },
              },
            }),
          ),
        );
      }

      /*
       * Không xóa CartItem sau checkout.
       * Giỏ hàng được giữ nguyên để khách có thể mua lại món cũ.
       */

      return order;
    });
  }

  /**
   * Tìm khách theo SĐT trong tài khoản USER trước, sau đó mới tìm hồ sơ POS.
   * Nhờ vậy cùng một số điện thoại không bị tách điểm giữa hai loại hồ sơ.
   */
  async lookupPosCustomer(phone: string) {
    const normalizedPhone = phone.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        profile: { phone: normalizedPhone },
        isActive: true,
        role: { name: 'USER' },
      },
      select: {
        profile: { select: { fullName: true, phone: true } },
        customerProfile: { select: { loyaltyPoints: true } },
      },
    });

    if (user) {
      return {
        found: true,
        source: 'USER' as const,
        fullName: user.profile?.fullName ?? null,
        phone: user.profile?.phone ?? normalizedPhone,
        loyaltyPoints: user.customerProfile?.loyaltyPoints ?? 0,
      };
    }

    const posCustomer = await this.prisma.posCustomer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (posCustomer) {
      return {
        found: true,
        source: 'POS_CUSTOMER' as const,
        fullName: posCustomer.fullName,
        phone: posCustomer.phone,
        loyaltyPoints: posCustomer.loyaltyPoints,
      };
    }

    return {
      found: false,
      source: null,
      fullName: null,
      phone: normalizedPhone,
      loyaltyPoints: 0,
    };
  }

  /**
   * Tạo hóa đơn POS tại quầy. Backend luôn đọc lại giá hiện tại của variant và
   * topping, vì vậy frontend không thể tự sửa giá trước khi gửi request.
   */
  async createPosOrder(
    staffUserId: number,
    createPosOrderDto: CreatePosOrderDto,
  ) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: {
        role: true,
        profile: { select: { fullName: true } },
        staffProfile: { include: { branch: true } },
      },
    });

    if (!staff || staff.role.name !== 'BRANCH_MANAGER') {
      throw new BadRequestException('Tài khoản không có quyền tạo hóa đơn POS');
    }

    if (
      !staff.isActive ||
      !staff.staffProfile?.branchId ||
      !staff.staffProfile.branch
    ) {
      throw new BadRequestException(
        'Tài khoản chưa được gán chi nhánh hoạt động',
      );
    }

    if (!staff.staffProfile.branch.isActive) {
      throw new BadRequestException('Chi nhánh đã bị khóa bởi Admin');
    }

    // Chụp lại dữ liệu đã được kiểm tra để giữ type an toàn trong transaction.
    const staffBranchId = staff.staffProfile.branchId;
    const staffBranchAddress = staff.staffProfile.branch.address;

    const storeSettings = await this.storeSettingsService.getSettings();
    if (!storeSettings.isAcceptingOrders) {
      throw new BadRequestException('Toàn hệ thống đang tạm ngưng hoạt động');
    }

    const customerPhone = createPosOrderDto.customerPhone?.trim() || '';
    const requestedCustomerName = createPosOrderDto.customerName?.trim() || '';
    let customerUser: {
      id: number;
      fullName: string | null;
      loyaltyPoints: number;
    } | null = null;
    let posCustomer: {
      id: number;
      fullName: string;
      loyaltyPoints: number;
    } | null = null;

    if (customerPhone) {
      const matchedUser = await this.prisma.user.findFirst({
        where: {
          profile: { phone: customerPhone },
          isActive: true,
          role: { name: 'USER' },
        },
        select: {
          id: true,
          profile: { select: { fullName: true } },
          customerProfile: { select: { loyaltyPoints: true } },
        },
      });

      customerUser = matchedUser
        ? {
            id: matchedUser.id,
            fullName: matchedUser.profile?.fullName ?? null,
            loyaltyPoints: matchedUser.customerProfile?.loyaltyPoints ?? 0,
          }
        : null;

      if (!customerUser) {
        const existingPosCustomer = await this.prisma.posCustomer.findUnique({
          where: { phone: customerPhone },
        });

        if (!existingPosCustomer && !requestedCustomerName) {
          throw new BadRequestException(
            'Khách dùng SĐT lần đầu cần nhập tên để lưu hồ sơ tích điểm',
          );
        }

        posCustomer = existingPosCustomer
          ? {
              id: existingPosCustomer.id,
              fullName: existingPosCustomer.fullName,
              loyaltyPoints: existingPosCustomer.loyaltyPoints,
            }
          : await this.prisma.posCustomer.create({
              data: {
                phone: customerPhone,
                fullName: requestedCustomerName,
              },
              select: { id: true, fullName: true, loyaltyPoints: true },
            });
      }
    }

    const variantIds = [
      ...new Set(createPosOrderDto.items.map((item) => item.variantId)),
    ];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          include: {
            category: true,
            toppings: {
              include: { topping: true },
            },
          },
        },
      },
    });
    const variantById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );

    const calculatedItems = createPosOrderDto.items.map((item) => {
      const variant = variantById.get(item.variantId);

      if (!variant || variant.productId !== item.productId) {
        throw new BadRequestException(
          'Size sản phẩm trong hóa đơn không hợp lệ',
        );
      }

      if (
        !variant.isActive ||
        !variant.product.isActive ||
        !variant.product.category.isActive
      ) {
        throw new BadRequestException(
          `${variant.product.name} hiện không còn được bán`,
        );
      }

      const allowedToppings = new Map(
        variant.product.toppings
          .filter(({ topping }) => topping.isActive)
          .map(({ topping }) => [topping.id, topping]),
      );
      const toppings = (item.toppingIds ?? []).map((toppingId) => {
        const topping = allowedToppings.get(toppingId);
        if (!topping) {
          throw new BadRequestException(
            `Topping đã chọn không dùng được với ${variant.product.name}`,
          );
        }
        return topping;
      });
      const variantPrice = Number(variant.price);
      const unitPrice =
        variantPrice +
        toppings.reduce((sum, topping) => sum + Number(topping.price), 0);

      return {
        item,
        variant,
        toppings,
        variantPrice,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });

    const subtotal = calculatedItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );
    const loyaltyPointsUsed = createPosOrderDto.loyaltyPointsToUse ?? 0;
    const customerLoyaltyPoints =
      customerUser?.loyaltyPoints ?? posCustomer?.loyaltyPoints ?? 0;

    if (loyaltyPointsUsed > 0) {
      if (!customerUser && !posCustomer) {
        throw new BadRequestException(
          'Chỉ khách hàng cũ có số điện thoại mới được sử dụng điểm',
        );
      }

      if (customerLoyaltyPoints < 1000) {
        throw new BadRequestException(
          'Khách cần đạt ít nhất 1.000 điểm để sử dụng điểm tích lũy',
        );
      }

      if (loyaltyPointsUsed % 1000 !== 0) {
        throw new BadRequestException(
          'Số điểm sử dụng phải là bội số của 1.000',
        );
      }

      if (loyaltyPointsUsed > customerLoyaltyPoints) {
        throw new BadRequestException(
          'Số điểm sử dụng vượt quá số điểm hiện có của khách',
        );
      }

      if (loyaltyPointsUsed > subtotal) {
        throw new BadRequestException(
          'Số điểm sử dụng vượt quá giá trị hóa đơn',
        );
      }
    }

    // 1 điểm đổi 1đ; khoản giảm được lưu riêng để báo cáo không sai doanh thu.
    const loyaltyDiscountAmount = loyaltyPointsUsed;
    const totalPrice = subtotal - loyaltyDiscountAmount;
    const paidAt = new Date();
    const isBankTransfer = createPosOrderDto.paymentMethod === 'BANK_TRANSFER';

    const order = await this.prisma.$transaction(async (tx) => {
      if (loyaltyPointsUsed > 0) {
        const result = customerUser
          ? await tx.customerProfile.updateMany({
              where: {
                userId: customerUser.id,
                loyaltyPoints: { gte: loyaltyPointsUsed },
              },
              data: { loyaltyPoints: { decrement: loyaltyPointsUsed } },
            })
          : await tx.posCustomer.updateMany({
              where: {
                id: posCustomer!.id,
                loyaltyPoints: { gte: loyaltyPointsUsed },
              },
              data: { loyaltyPoints: { decrement: loyaltyPointsUsed } },
            });

        if (result.count === 0) {
          throw new BadRequestException(
            'Số điểm hiện tại của khách không đủ để thanh toán',
          );
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          userId: customerUser?.id ?? staffUserId,
          branchId: staffBranchId,
          channel: 'POS',
          createdByStaffId: staffUserId,
          posCustomerId: posCustomer?.id ?? null,
          status: 'CONFIRMED',
          fulfillmentMethod: 'PICKUP',
          receiverName:
            customerUser?.fullName ||
            posCustomer?.fullName ||
            requestedCustomerName ||
            'Khách lẻ',
          receiverPhone: customerPhone,
          deliveryAddress: staffBranchAddress || 'Nhận món tại quầy',
          note: createPosOrderDto.note?.trim() || null,
          subtotal,
          discountAmount: 0,
          loyaltyPointsUsed,
          loyaltyDiscountAmount,
          totalPrice,
          payment: {
            create: {
              method:
                createPosOrderDto.paymentMethod === 'CASH'
                  ? 'COD'
                  : 'BANK_TRANSFER',
              status: isBankTransfer ? 'PENDING' : 'PAID',
              amount: totalPrice,
              paidAt: isBankTransfer ? null : paidAt,
              ...createBankTransferMetadata(
                isBankTransfer ? 'BANK_TRANSFER' : 'COD',
              ),
            },
          },
          items: {
            create: calculatedItems.map(
              ({
                item,
                variant,
                toppings,
                variantPrice,
                unitPrice,
                lineTotal,
              }) => ({
                productId: variant.productId,
                variantId: variant.id,
                productName: variant.product.name,
                size: variant.size,
                variantPrice,
                quantity: item.quantity,
                unitPrice,
                lineTotal,
                toppings: {
                  create: toppings.map((topping) => ({
                    toppingId: topping.id,
                    toppingName: topping.name,
                    toppingPrice: topping.price,
                  })),
                },
              }),
            ),
          },
        },
        include: {
          user: {
            select: { id: true, email: true, ...personProfileSelect },
          },
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              phone: true,
            },
          },
          payment: true,
          items: { include: { toppings: true, recipeIngredients: true } },
        },
      });
      createdOrder.inventoryState = await this.inventoryService.reserveForOrder(
        tx,
        createdOrder.id,
        createdOrder.branchId,
        staffUserId,
      );
      return createdOrder;
    });

    // Bổ sung thông tin người tạo để frontend in hóa đơn ngay mà không cần
    // gọi thêm API. Đây là dữ liệu chỉ đọc, không thay đổi relation của Order.
    return {
      ...order,
      user: flattenPersonProfile(order.user),
      createdByStaff: {
        id: staff.id,
        email: staff.email,
        fullName: staff.profile?.fullName ?? null,
      },
    };
  }

  private async cancelOrder(
    orderId: number,
    allowedStatuses: OrderStatus[],
    cancelReason: string,
    ownerUserId?: number,
    actorId?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          ...(ownerUserId ? { userId: ownerUserId } : {}),
        },
        include: {
          payment: true,
          appliedVouchers: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      if (!allowedStatuses.includes(order.status)) {
        throw new BadRequestException(
          ownerUserId
            ? 'Chỉ có thể hủy đơn hàng đang chờ xác nhận'
            : 'Đơn hàng không còn ở trạng thái có thể hủy',
        );
      }

      if (order.payment?.status === 'PAID') {
        throw new BadRequestException(
          'Đơn hàng đã thanh toán cần được hoàn tiền trước khi hủy',
        );
      }

      const cancelled = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
          ...(ownerUserId ? { userId: ownerUserId } : {}),
        },
        data: {
          status: 'CANCELLED',
          // Ghi trạng thái và dấu vết trong cùng transaction để không lệch dữ liệu.
          cancelReason: cancelReason.trim(),
          cancelledAt: new Date(),
        },
      });

      if (cancelled.count !== 1) {
        throw new BadRequestException(
          'Trạng thái đơn hàng vừa thay đổi, vui lòng tải lại trang',
        );
      }

      await this.inventoryService.releaseOrder(
        tx,
        orderId,
        order.branchId,
        actorId ?? ownerUserId,
      );

      if (order.loyaltyPointsUsed > 0) {
        if (order.channel === 'POS' && order.posCustomerId) {
          await tx.posCustomer.update({
            where: { id: order.posCustomerId },
            data: {
              loyaltyPoints: {
                increment: order.loyaltyPointsUsed,
              },
            },
          });
        } else {
          await tx.customerProfile.upsert({
            where: { userId: order.userId },
            create: {
              userId: order.userId,
              loyaltyPoints: order.loyaltyPointsUsed,
            },
            update: { loyaltyPoints: { increment: order.loyaltyPointsUsed } },
          });
        }
      }

      const voucherIds = [
        ...order.appliedVouchers.map((voucher) => voucher.voucherId),
        ...(order.voucherId ? [order.voucherId] : []),
      ].filter((id, index, ids) => ids.indexOf(id) === index);

      await Promise.all(
        voucherIds.map((voucherId) =>
          tx.voucher.updateMany({
            where: {
              id: voucherId,
              usedCount: { gt: 0 },
            },
            data: {
              usedCount: { decrement: 1 },
            },
          }),
        ),
      );

      await tx.payment.updateMany({
        where: {
          orderId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      const notification = this.buildOrderStatusNotification({
        id: order.id,
        status: 'CANCELLED',
        fulfillmentMethod: order.fulfillmentMethod,
      });
      if (notification && order.channel === 'ONLINE') {
        await tx.notification.create({
          data: { ...notification, userId: order.userId },
        });
      }

      const cancelledOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payment: true,
          appliedVouchers: { include: { voucher: true } },
          items: { include: { toppings: true } },
        },
      });

      if (!cancelledOrder) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      return cancelledOrder;
    });
  }

  // =========================
  // USER ORDER
  // =========================

  // User chỉ xem lịch sử đơn hàng của chính mình
  async findMyOrders(userId: number) {
    return this.prisma.order.findMany({
      where: {
        userId,
      },
      include: {
        payment: true,
        appliedVouchers: { include: { voucher: true } },
        items: {
          include: {
            toppings: true,
            recipeIngredients: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // User chỉ xem chi tiết Order thuộc tài khoản của mình
  async findMyOrder(userId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        payment: true,
        appliedVouchers: { include: { voucher: true } },
        items: {
          include: {
            toppings: true,
            recipeIngredients: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return order;
  }

  // User chỉ được tự hủy đơn đang chờ xác nhận của chính mình
  async cancelMyOrder(userId: number, orderId: number, reason: string) {
    return this.cancelOrder(orderId, ['PENDING'], reason, userId, userId);
  }

  /**
   * Dựng preview từ OrderItem và giá hiện tại. Đây là thao tác chỉ đọc nên
   * giỏ hàng của user giữ nguyên trước, trong và sau khi mua lại.
   */
  async reorderMyOrder(userId: number, orderId: number) {
    const source = await this.getReorderCheckoutItems(userId, orderId);
    const previewItems = source.items.map((item) => {
      const unitPrice =
        Number(item.variant.price) +
        item.toppings.reduce(
          (total, itemTopping) => total + Number(itemTopping.topping.price),
          0,
        );

      return {
        ...item,
        cartId: 0,
        toppings: item.toppings.map((itemTopping) => ({
          ...itemTopping,
          cartItemId: item.id,
        })),
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        createdAt: source.order.createdAt,
        updatedAt: source.order.updatedAt,
      };
    });
    const totalPrice = previewItems.reduce(
      (total, item) => total + item.lineTotal,
      0,
    );

    return {
      sourceOrderId: orderId,
      // Giữ shape Cart để checkout tái sử dụng giao diện; đây không phải bản ghi DB.
      cart: {
        id: 0,
        userId,
        items: previewItems,
        totalPrice,
        createdAt: source.order.createdAt,
        updatedAt: source.order.updatedAt,
      },
      selectedCartItemIds: previewItems.map((item) => item.id),
      addedItemCount: previewItems.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
      skippedItems: source.skippedItems,
    };
  }

  // =========================
  // ADMIN / STAFF ORDER
  // =========================

  // ADMIN/STAFF xem toàn bộ đơn hàng trong hệ thống
  async findAll(query = '', staffUserId?: number) {
    const branchId = staffUserId
      ? await this.getStaffBranchId(staffUserId)
      : undefined;
    const orders = await this.prisma.order.findMany({
      where: branchId ? { branchId } : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            ...personProfileSelect,
          },
        },

        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            phone: true,
          },
        },

        voucher: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
          },
        },

        payment: true,
        refund: { include: refundInclude },

        items: {
          include: {
            toppings: true,
            recipeIngredients: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    const creatorIds = [
      ...new Set(
        orders
          .map((order) => order.createdByStaffId)
          .filter((id): id is number => id !== null),
      ),
    ];
    const creators =
      creatorIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, email: true, ...personProfileSelect },
          })
        : [];
    const creatorById = new Map(
      creators.map((creator) => [creator.id, flattenPersonProfile(creator)]),
    );
    const ordersWithCreator = orders.map((order) => ({
      ...order,
      user: flattenPersonProfile(order.user),
      refund: serializeRefund(order.refund),
      createdByStaff: order.createdByStaffId
        ? (creatorById.get(order.createdByStaffId) ?? null)
        : null,
    }));

    return this.fuzzySearch.search(ordersWithCreator, query, {
      keys: [
        {
          name: 'id',
          weight: 0.18,
          getFn: (order) => String(order.id),
        },
        { name: 'receiverName', weight: 0.2 },
        { name: 'receiverPhone', weight: 0.15 },
        { name: 'deliveryAddress', weight: 0.1 },
        { name: 'user.email', weight: 0.1 },
        { name: 'user.fullName', weight: 0.07 },
        { name: 'voucherCode', weight: 0.05 },
        { name: 'items.productName', weight: 0.15 },
      ],
    });
  }

  // ADMIN/STAFF xem chi tiết một đơn hàng
  async findOne(id: number, staffUserId?: number) {
    const branchId = staffUserId
      ? await this.getStaffBranchId(staffUserId)
      : undefined;
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },

      include: {
        user: {
          select: {
            id: true,
            email: true,
            ...personProfileSelect,
          },
        },

        voucher: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
          },
        },

        payment: true,
        refund: { include: refundInclude },

        items: {
          include: {
            toppings: true,
            recipeIngredients: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (branchId !== undefined && order.branchId !== branchId) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    return {
      ...order,
      user: flattenPersonProfile(order.user),
      refund: serializeRefund(order.refund),
    };
  }

  /// Hủy đơn từ màn hình quản lý. Nếu đã PAID, toàn bộ tiền được hoàn và ghi chứng từ nguyên tử.
  async cancelManagedOrder(
    actorId: number,
    actorRole: string,
    id: number,
    dto: CancelManagedOrderDto,
  ) {
    const scopedBranchId =
      actorRole === 'BRANCH_MANAGER'
        ? await this.getStaffBranchId(actorId)
        : undefined;
    const current = await this.prisma.order.findUnique({
      where: { id },
      include: { payment: true, refund: true },
    });
    if (!current || (scopedBranchId && current.branchId !== scopedBranchId)) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    if (current.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã được hủy trước đó');
    }

    if (current.payment?.status !== 'PAID') {
      const cancelled = await this.cancelOrder(
        id,
        ['PENDING', 'CONFIRMED'],
        dto.reason,
        undefined,
        actorId,
      );
      await writeAuditLog(this.prisma, {
        actorId,
        branchId: current.branchId,
        module: 'ORDER',
        action: 'CANCEL_ORDER',
        entityType: 'Order',
        entityId: id,
        description: `Hủy đơn #${id} chưa thanh toán`,
        beforeData: { status: current.status },
        afterData: { status: 'CANCELLED', reason: dto.reason },
      });
      return cancelled;
    }

    if (!dto.refundMethod) {
      throw new BadRequestException('Vui lòng chọn phương thức hoàn tiền');
    }
    const refundMethod = dto.refundMethod;
    if (current.refund) {
      throw new BadRequestException('Đơn hàng đã có chứng từ hoàn tiền');
    }

    const refunded = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          payment: true,
          refund: true,
          appliedVouchers: true,
          user: { include: { role: true } },
        },
      });
      if (!order || !order.payment) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }
      if (scopedBranchId && order.branchId !== scopedBranchId) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }
      if (
        order.status === 'CANCELLED' ||
        order.payment.status !== 'PAID' ||
        order.refund
      ) {
        throw new BadRequestException(
          'Đơn hàng vừa thay đổi hoặc đã được hoàn tiền',
        );
      }

      const processedAt = new Date();
      const paymentClaim = await tx.payment.updateMany({
        where: { id: order.payment.id, status: 'PAID' },
        data: { status: 'REFUNDED' },
      });
      const orderClaim = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: 'CANCELLED',
          cancelReason: dto.reason,
          cancelledAt: processedAt,
        },
      });
      if (paymentClaim.count !== 1 || orderClaim.count !== 1) {
        throw new BadRequestException(
          'Đơn hàng vừa thay đổi, vui lòng tải lại trang',
        );
      }

      // Chỉ trả lượng đang giữ; nguyên liệu đã xuất khi bắt đầu pha không được nhập lại.
      if (order.inventoryState === 'RESERVED') {
        await this.inventoryService.releaseOrder(
          tx,
          id,
          order.branchId,
          actorId,
        );
      }

      const earnedPoints = order.loyaltyPointsGrantedAt
        ? order.loyaltyPointsEarned
        : 0;
      if (order.channel === 'POS' && order.posCustomerId) {
        const customer = await tx.posCustomer.findUnique({
          where: { id: order.posCustomerId },
          select: { loyaltyPoints: true },
        });
        if (customer) {
          await tx.posCustomer.update({
            where: { id: order.posCustomerId },
            data: {
              loyaltyPoints:
                Math.max(0, customer.loyaltyPoints - earnedPoints) +
                order.loyaltyPointsUsed,
            },
          });
        }
      } else if (order.user.role.name === 'USER') {
        const profile = await tx.customerProfile.findUnique({
          where: { userId: order.userId },
          select: { loyaltyPoints: true },
        });
        const loyaltyPoints =
          Math.max(0, (profile?.loyaltyPoints ?? 0) - earnedPoints) +
          order.loyaltyPointsUsed;
        await tx.customerProfile.upsert({
          where: { userId: order.userId },
          create: { userId: order.userId, loyaltyPoints },
          update: { loyaltyPoints },
        });
      }

      const voucherIds = [
        ...order.appliedVouchers.map((voucher) => voucher.voucherId),
        ...(order.voucherId ? [order.voucherId] : []),
      ].filter(
        (voucherId, index, values) => values.indexOf(voucherId) === index,
      );
      await Promise.all(
        voucherIds.map((voucherId) =>
          tx.voucher.updateMany({
            where: { id: voucherId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          }),
        ),
      );

      await tx.paymentRefund.create({
        data: {
          code: `HT-D${order.id}-P${order.payment.id}`,
          orderId: order.id,
          paymentId: order.payment.id,
          branchId: order.branchId,
          amount: order.payment.amount,
          method: refundMethod,
          reason: dto.reason,
          processedById: actorId,
          processedAt,
        },
      });

      if (order.channel === 'ONLINE') {
        await tx.notification.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            type: 'ORDER_REFUNDED',
            title: 'Đơn hàng đã được hoàn tiền',
            message: `Đơn #${order.id} đã hủy và hoàn ${Number(order.payment.amount).toLocaleString('vi-VN')} đ.`,
          },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          payment: true,
          refund: { include: refundInclude },
          items: { include: { toppings: true, recipeIngredients: true } },
          appliedVouchers: { include: { voucher: true } },
        },
      });
    });

    await writeAuditLog(this.prisma, {
      actorId,
      branchId: current.branchId,
      module: 'PAYMENT',
      action: 'REFUND_AND_CANCEL_ORDER',
      entityType: 'PaymentRefund',
      entityId: refunded.refund?.id,
      description: `Hoàn toàn bộ tiền và hủy đơn #${id}`,
      beforeData: {
        orderStatus: current.status,
        paymentStatus: current.payment.status,
      },
      afterData: refunded.refund,
      metadata: {
        inventoryReservationReleased: current.inventoryState === 'RESERVED',
        consumedInventoryWasRestocked: false,
      },
    });

    return { ...refunded, refund: serializeRefund(refunded.refund) };
  }

  // ADMIN/STAFF cập nhật trạng thái đơn hàng
  async updateStatus(id: number, status: string, staffUserId?: number) {
    const branchId = staffUserId
      ? await this.getStaffBranchId(staffUserId)
      : undefined;
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      include: {
        payment: { select: { method: true, status: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (branchId !== undefined && order.branchId !== branchId) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // COMPLETED và CANCELLED là trạng thái cuối
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException(
        'Không thể thay đổi trạng thái của đơn hàng đã hoàn tất hoặc đã hủy',
      );
    }

    // Kiểm soát thứ tự xử lý đơn hàng
    // Luồng nhận tại quán và giao hàng được tách riêng.
    // Đơn PICKUP phải qua READY_FOR_PICKUP trước khi hoàn tất.
    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],

      CONFIRMED: ['PREPARING', 'CANCELLED'],

      PREPARING:
        order.fulfillmentMethod === 'PICKUP'
          ? ['READY_FOR_PICKUP']
          : ['DELIVERING'],

      READY_FOR_PICKUP: ['COMPLETED'],

      DELIVERING: ['COMPLETED'],
    };

    const allowedStatuses = allowedTransitions[order.status] ?? [];

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${order.status} sang ${status}`,
      );
    }

    if (
      status === 'PREPARING' &&
      order.payment?.method === 'BANK_TRANSFER' &&
      order.payment.status !== 'PAID'
    ) {
      throw new BadRequestException(
        'Chưa thể pha chế: đơn chuyển khoản chưa được ngân hàng đối soát',
      );
    }

    if (status === 'CANCELLED') {
      return this.cancelOrder(
        id,
        ['PENDING', 'CONFIRMED'],
        'Cửa hàng hủy đơn hàng',
        undefined,
        staffUserId,
      );
    }

    // Khi đơn chưa hoàn tất thì chỉ cập nhật trạng thái
    if (status !== 'COMPLETED') {
      return this.prisma.$transaction(async (tx) => {
        if (status === 'PREPARING') {
          await this.inventoryService.consumeOrder(
            tx,
            id,
            order.branchId,
            staffUserId,
          );
        }
        const updatedOrder = await tx.order.update({
          where: { id },
          data: { status: status as OrderStatus },
        });
        const notification = this.buildOrderStatusNotification({
          id: updatedOrder.id,
          status: updatedOrder.status,
          fulfillmentMethod: updatedOrder.fulfillmentMethod,
        });

        if (notification && updatedOrder.channel === 'ONLINE') {
          await tx.notification.create({
            data: { ...notification, userId: updatedOrder.userId },
          });
        }

        return updatedOrder;
      });
    }

    // Hoàn tất đơn và cộng điểm trong cùng transaction
    return this.prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: {
          id,
        },
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!currentOrder) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      // Đơn online/khách có tài khoản cộng vào User; khách POS chưa có tài
      // khoản cộng vào PosCustomer. Khách lẻ không SĐT sẽ không được cộng điểm.
      const canEarnUserPoints = currentOrder.user.role.name === 'USER';
      const canEarnPosCustomerPoints =
        currentOrder.channel === 'POS' && currentOrder.posCustomerId !== null;
      const canEarnPoints = canEarnUserPoints || canEarnPosCustomerPoints;

      // Điểm tính trên số tiền thực trả cuối cùng
      const paidAmount = Number(currentOrder.totalPrice);
      const completedAt = new Date();

      // Mỗi 1.000đ = 10 điểm
      const earnedPoints = canEarnPoints
        ? Math.floor(paidAmount / 1000) * 10
        : 0;

      const updatedOrder = await tx.order.update({
        where: {
          id,
        },
        data: {
          status: 'COMPLETED',

          loyaltyPointsEarned: earnedPoints,

          loyaltyPointsGrantedAt: canEarnPoints ? completedAt : null,
        },
      });

      if (canEarnUserPoints && earnedPoints > 0) {
        await tx.customerProfile.upsert({
          where: { userId: currentOrder.userId },
          create: { userId: currentOrder.userId, loyaltyPoints: earnedPoints },
          update: { loyaltyPoints: { increment: earnedPoints } },
        });
      }

      if (canEarnPosCustomerPoints && earnedPoints > 0) {
        await tx.posCustomer.update({
          where: { id: currentOrder.posCustomerId! },
          data: {
            loyaltyPoints: {
              increment: earnedPoints,
            },
          },
        });
      }

      await tx.payment.updateMany({
        where: {
          orderId: id,
          method: 'COD',
          status: 'PENDING',
        },
        data: {
          status: 'PAID',
          paidAt: completedAt,
        },
      });

      const notification = this.buildOrderStatusNotification({
        id: updatedOrder.id,
        status: updatedOrder.status,
        fulfillmentMethod: updatedOrder.fulfillmentMethod,
      });
      if (notification && updatedOrder.channel === 'ONLINE') {
        await tx.notification.create({
          data: { ...notification, userId: updatedOrder.userId },
        });
      }

      const completedOrder = await tx.order.findUnique({
        where: { id: updatedOrder.id },
        include: {
          payment: true,
          appliedVouchers: { include: { voucher: true } },
          items: { include: { toppings: true } },
        },
      });

      if (!completedOrder) {
        throw new NotFoundException('Không tìm thấy đơn hàng');
      }

      return completedOrder;
    });
  }
}
