"use client";

import {
  ArrowLeft,
  BadgePercent,
  Banknote,
  Coins,
  Landmark,
  MapPin,
  NotebookPen,
  PackageCheck,
  Phone,
  QrCode,
  Store,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";

import dynamic from "next/dynamic";
import Link from "next/link";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import ToastMessage from "@/components/ui/toast-message";

import { getCart } from "@/services/cart.service";

import {
  checkoutOrder,
  getAddressSuggestions,
  getDeliveryLocationQuote,
  getDeliveryQuote,
  reorderMyOrder,
  type AddressSuggestion,
  type RouteCoordinate,
} from "@/services/order.service";

import { getMe } from "@/services/auth.service";

import { getCheckoutVouchers } from "@/services/voucher.service";

import { getMyAddresses } from "@/services/address.service";

import type { UserAddress } from "@/types/address";

import type { Cart } from "@/types/cart";

import type { CheckoutVoucher } from "@/types/voucher";

import type { FulfillmentMethod, PaymentMethod } from "@/types/order";

import { consumeReorderCheckoutMessage } from "@/utils/cart.util";
import {
  getPublicStoreLocations,
  getStoreStatus,
} from "@/services/store-settings.service";
import type { PublicStoreLocation, StoreStatus } from "@/types/store-settings";

const DeliveryRouteMap = dynamic(
  () => import("@/components/user/delivery-route-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center bg-[#F3E9DE] text-sm text-[#8A817B]">
        Đang tải bản đồ...
      </div>
    ),
  },
);

export default function CheckoutPage() {
  const router = useRouter();

  const [cart, setCart] = useState<Cart | null>(null);

  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [reorderOrderId, setReorderOrderId] = useState<number | null>(null);

  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

  const [receiverName, setReceiverName] = useState("");

  const [receiverPhone, setReceiverPhone] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressSuggestionStatus, setAddressSuggestionStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const [note, setNote] = useState("");

  const [vouchers, setVouchers] = useState<CheckoutVoucher[]>([]);

  const [selectedVoucherCodes, setSelectedVoucherCodes] = useState<string[]>(
    [],
  );

  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");

  const [fulfillmentMethod, setFulfillmentMethod] =
    useState<FulfillmentMethod>("DELIVERY");

  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);
  const [storeLocations, setStoreLocations] = useState<PublicStoreLocation[]>(
    [],
  );
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [customerCoordinates, setCustomerCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>(
    [],
  );
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");
  const deliveryRequestId = useRef(0);
  const addressSuggestionRequestId = useRef(0);
  const skipAutomaticAddressQuote = useRef<string | null>(null);
  const resolvedDeliveryLocation = useRef<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [reorderMessage, setReorderMessage] = useState("");

  // Sổ địa chỉ dùng để chọn nhanh thông tin nhận hàng.
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);

  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<
    number | null
  >(null);

  const pendingReorderMessage = useRef<string | null | undefined>(undefined);

  // Khôi phục danh sách CartItem đã chọn và dữ liệu user khi mở checkout.
  useEffect(() => {
    // Giữ qua React Strict Mode để thông báo mua lại không bị consume hai lần.
    if (pendingReorderMessage.current === undefined) {
      pendingReorderMessage.current = consumeReorderCheckoutMessage();
    }
    setReorderMessage(pendingReorderMessage.current ?? "");

    // Dựng checkout từ giỏ hoặc preview đơn cũ; hai nguồn không trộn lẫn nhau.
    async function loadCheckout() {
      try {
        setLoading(true);
        setError("");

        const accessToken = sessionStorage.getItem("accessToken");

        if (!accessToken) {
          router.replace("/login?redirect=/checkout");

          return;
        }

        // Mã đơn trên URL là nguồn chính để refresh trang vẫn giữ luồng mua lại.
        const reorderOrderIdFromUrl = new URLSearchParams(
          window.location.search,
        ).get("reorderOrderId");
        const legacyReorderOrderId = sessionStorage.getItem(
          "checkoutReorderOrderId",
        );
        const reorderSourceId = reorderOrderIdFromUrl ?? legacyReorderOrderId;
        const isReorder = Boolean(reorderSourceId);
        const storedCartItemIds = sessionStorage.getItem("checkoutItemIds");

        let cartData: Cart;
        let validIds: number[];

        if (isReorder) {
          const sourceOrderId = Number(reorderSourceId);

          if (!Number.isInteger(sourceOrderId) || sourceOrderId <= 0) {
            router.replace("/orders");
            return;
          }

          const preview = await reorderMyOrder(accessToken, sourceOrderId);
          cartData = preview.cart;
          // Mua lại luôn chọn toàn bộ dòng còn khả dụng với quantity của đơn cũ.
          validIds = preview.selectedCartItemIds.filter((id) =>
            cartData.items.some((item) => item.id === id),
          );
          setReorderOrderId(sourceOrderId);
        } else {
          if (!storedCartItemIds) {
            router.replace("/cart");
            return;
          }

          const requestedIds = JSON.parse(storedCartItemIds) as number[];
          if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
            router.replace("/cart");
            return;
          }

          cartData = await getCart(accessToken);
          validIds = requestedIds.filter((id) =>
            cartData.items.some((item) => item.id === id),
          );
          setReorderOrderId(null);
        }

        if (validIds.length === 0) {
          router.replace(isReorder ? "/orders" : "/cart");

          return;
        }

        const checkoutSubtotal = cartData.items
          .filter((item) => validIds.includes(item.id))
          .reduce((total, item) => total + Number(item.lineTotal), 0);

        const locationData = await getPublicStoreLocations();
        const storedBranchId = Number(
          sessionStorage.getItem("checkoutBranchId"),
        );
        const preferredLocation =
          locationData.find(
            (location) => location.id === storedBranchId && location.isOpen,
          ) ??
          locationData.find((location) => location.isOpen) ??
          locationData[0];

        if (!preferredLocation) {
          throw new Error("Chưa có chi nhánh nào để nhận đơn");
        }

        const [availableVouchers, userData, addressData, storeStatusData] =
          await Promise.all([
            getCheckoutVouchers(accessToken, checkoutSubtotal),

            getMe(accessToken),

            getMyAddresses(accessToken),

            getStoreStatus(undefined, preferredLocation.id),
          ]);

        setCart(cartData);

        setSelectedItemIds(validIds);

        setVouchers(availableVouchers);

        setStoreStatus(storeStatusData);
        setStoreLocations(locationData);
        setSelectedBranchId(preferredLocation.id);
        sessionStorage.setItem(
          "checkoutBranchId",
          String(preferredLocation.id),
        );

        if (
          !storeStatusData.deliveryAvailable &&
          storeStatusData.pickupAvailable
        ) {
          setFulfillmentMethod("PICKUP");
        }

        setSavedAddresses(addressData);

        const defaultAddress =
          addressData.find((address) => address.isDefault) ??
          addressData[0] ??
          null;

        if (defaultAddress) {
          const coordinate = {
            latitude: Number(defaultAddress.latitude),

            longitude: Number(defaultAddress.longitude),
          };

          setSelectedSavedAddressId(defaultAddress.id);

          setReceiverName(defaultAddress.receiverName);

          setReceiverPhone(defaultAddress.receiverPhone);

          setDeliveryAddress(defaultAddress.addressLine);

          // Lưu tọa độ để effect tính tuyến bằng vị trí chính xác,
          // không phải geocode lại chuỗi địa chỉ.
          resolvedDeliveryLocation.current = {
            address: defaultAddress.addressLine,

            latitude: coordinate.latitude,

            longitude: coordinate.longitude,
          };
        } else {
          // Tài khoản cũ chưa có sổ địa chỉ vẫn dùng dữ liệu User hiện tại.
          setSelectedSavedAddressId(null);

          setReceiverName(userData.fullName ?? "");

          setReceiverPhone(userData.phone ?? "");

          setDeliveryAddress(userData.address ?? "");
        }

        setLoyaltyPoints(userData.loyaltyPoints ?? 0);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Không thể tải trang thanh toán",
        );
      } finally {
        setLoading(false);
      }
    }

    loadCheckout();
  }, [router]);

  // Chỉ giữ các CartItem mà trang giỏ đã chuyển sang qua sessionStorage.
  const selectedItems = useMemo(() => {
    if (!cart) {
      return [];
    }

    return cart.items.filter((item) => selectedItemIds.includes(item.id));
  }, [cart, selectedItemIds]);

  // Tính tạm tính từ các dòng được chọn, không dùng tổng của toàn bộ giỏ.
  const subtotal = useMemo(() => {
    return selectedItems.reduce(
      (total, item) => total + Number(item.lineTotal),
      0,
    );
  }, [selectedItems]);

  // Cộng quantity để hiển thị tổng số sản phẩm đang thanh toán.
  const selectedQuantity = useMemo(() => {
    return selectedItems.reduce((total, item) => total + item.quantity, 0);
  }, [selectedItems]);

  // Cộng tối đa hai voucher đã chọn và không cho giảm vượt subtotal.
  const voucherDiscount = useMemo(() => {
    const discount = vouchers
      .filter((voucher) => selectedVoucherCodes.includes(voucher.code))
      .reduce((total, voucher) => total + Number(voucher.discountAmount), 0);

    return Math.min(discount, subtotal);
  }, [selectedVoucherCodes, subtotal, vouchers]);

  // Tính phí giao hàng xem trước theo khoảng cách và chính sách hiện tại.
  const deliveryBaseDistanceKm = storeStatus?.deliveryBaseDistanceKm ?? 3;
  const configuredDeliveryBaseFee = storeStatus?.deliveryBaseFee ?? 15000;
  const deliveryFeePerKm = storeStatus?.deliveryFeePerKm ?? 5000;
  const firstDeliveryDiscountThreshold =
    storeStatus?.deliveryDiscountFirstThreshold ?? 300000;
  const firstDeliveryDiscountAmount =
    storeStatus?.deliveryDiscountFirstAmount ?? 20000;
  const secondDeliveryDiscountThreshold =
    storeStatus?.deliveryDiscountSecondThreshold ?? 500000;
  const secondDeliveryDiscountAmount =
    storeStatus?.deliveryDiscountSecondAmount ?? 40000;
  const deliveryBaseFee =
    fulfillmentMethod === "PICKUP" || distanceKm === null
      ? 0
      : configuredDeliveryBaseFee +
        Math.max(0, Math.ceil(distanceKm - deliveryBaseDistanceKm)) *
          deliveryFeePerKm;

  const deliveryDiscount =
    fulfillmentMethod === "PICKUP" || distanceKm === null
      ? 0
      : subtotal >= secondDeliveryDiscountThreshold
        ? Math.min(secondDeliveryDiscountAmount, deliveryBaseFee)
        : subtotal >= firstDeliveryDiscountThreshold
          ? Math.min(firstDeliveryDiscountAmount, deliveryBaseFee)
          : 0;

  const deliveryFee = Math.max(0, deliveryBaseFee - deliveryDiscount);

  const deliveryDistanceExceeded =
    fulfillmentMethod === "DELIVERY" &&
    distanceKm !== null &&
    storeStatus !== null &&
    distanceKm > storeStatus.maxDeliveryDistanceKm;

  const selectedMethodAvailable =
    fulfillmentMethod === "DELIVERY"
      ? Boolean(storeStatus?.deliveryAvailable)
      : Boolean(storeStatus?.pickupAvailable);

  const storeCheckoutDisabled =
    branchLoading ||
    !storeStatus?.isOpen ||
    !selectedMethodAvailable ||
    deliveryDistanceExceeded;

  const selectedStoreLocation = storeLocations.find(
    (location) => location.id === selectedBranchId,
  );

  // Lấy vị trí từ đúng chi nhánh đã chọn để dùng chung cho bản đồ và pickup.
  const configuredStoreCoordinates = {
    latitude: selectedStoreLocation?.latitude ?? Number.NaN,
    longitude: selectedStoreLocation?.longitude ?? Number.NaN,
  };
  const configuredStoreAddress =
    selectedStoreLocation?.address ??
    storeStatus?.branch.address ??
    "Chi nhánh chưa cập nhật địa chỉ";

  const hasStoreCoordinates =
    Number.isFinite(configuredStoreCoordinates.latitude) &&
    Number.isFinite(configuredStoreCoordinates.longitude);

  // Chuẩn hóa mọi giá tiền checkout theo định dạng tiền Việt Nam.
  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value));
  }

  // Chặn điểm âm, vượt số dư hoặc vượt giá trị đơn sau khi trừ voucher;
  // điểm chỉ được dùng theo từng mốc 1.000.
  function handlePointsChange(value: number) {
    if (value < 0) {
      value = 0;
    }

    const availableAfterVoucher = Math.max(0, subtotal - voucherDiscount);

    const maxUsable = Math.min(
      Math.floor(loyaltyPoints / 1000) * 1000,
      Math.floor(availableAfterVoucher / 1000) * 1000,
    );

    setLoyaltyPointsToUse(Math.min(value, maxUsable));
  }

  // Bật/tắt voucher hợp lệ và giới hạn mỗi đơn tối đa hai mã.
  function toggleVoucher(voucher: CheckoutVoucher) {
    if (!voucher.canUse) {
      return;
    }

    setError("");
    setSelectedVoucherCodes((current) => {
      if (current.includes(voucher.code)) {
        return current.filter((code) => code !== voucher.code);
      }

      if (current.length >= 2) {
        setError("Mỗi đơn hàng chỉ được dùng tối đa 2 voucher");
        return current;
      }

      return [...current, voucher.code];
    });
  }

  // Đổi giao hàng/pickup và xóa kết quả tuyến đường không còn phù hợp.
  function selectFulfillmentMethod(method: FulfillmentMethod) {
    const methodAvailable =
      method === "DELIVERY"
        ? storeStatus?.deliveryAvailable
        : storeStatus?.pickupAvailable;

    if (!methodAvailable) {
      setError(
        storeStatus?.unavailableReason ||
          "Phương thức nhận hàng này hiện không khả dụng",
      );
      return;
    }

    deliveryRequestId.current += 1;
    setFulfillmentMethod(method);
    setError("");
    setDeliveryError("");
    setCalculatingDelivery(false);
    setCustomerCoordinates(null);
    setRouteCoordinates([]);
    setDistanceKm(null);
  }

  async function handleBranchChange(value: string) {
    const branchId = Number(value);
    if (!Number.isInteger(branchId) || branchId <= 0 || branchLoading) return;

    const previousBranchId = selectedBranchId;
    setBranchLoading(true);
    setSelectedBranchId(branchId);
    setStoreStatus(null);
    setError("");
    setDeliveryError("");
    deliveryRequestId.current += 1;
    addressSuggestionRequestId.current += 1;
    setCalculatingDelivery(false);
    setCustomerCoordinates(null);
    setRouteCoordinates([]);
    setDistanceKm(null);

    try {
      const nextStatus = await getStoreStatus(undefined, branchId);
      setStoreStatus(nextStatus);
      sessionStorage.setItem("checkoutBranchId", String(branchId));

      if (!nextStatus.bankTransferAvailable) {
        setPaymentMethod("COD");
      }

      if (!nextStatus.deliveryAvailable && nextStatus.pickupAvailable) {
        setFulfillmentMethod("PICKUP");
      } else if (!nextStatus.pickupAvailable && nextStatus.deliveryAvailable) {
        setFulfillmentMethod("DELIVERY");
      }
    } catch (branchError) {
      setSelectedBranchId(previousBranchId);
      if (previousBranchId) {
        setStoreStatus(await getStoreStatus(undefined, previousBranchId));
      }
      setError(
        branchError instanceof Error
          ? branchError.message
          : "Không thể đổi chi nhánh",
      );
    } finally {
      setBranchLoading(false);
    }
  }

  // Debounce việc gợi ý địa chỉ; requestId ngăn response cũ ghi đè từ khóa
  // mới khi người dùng nhập nhanh.
  useEffect(() => {
    const normalizedAddress = deliveryAddress.trim();

    if (loading || !showAddressSuggestions || normalizedAddress.length < 3) {
      return;
    }

    const requestId = ++addressSuggestionRequestId.current;
    const timeoutId = window.setTimeout(async () => {
      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        router.replace("/login?redirect=/checkout");
        return;
      }

      try {
        setAddressSuggestionStatus("loading");
        const suggestions = await getAddressSuggestions(
          accessToken,
          normalizedAddress,
          selectedBranchId ?? undefined,
        );

        if (requestId === addressSuggestionRequestId.current) {
          setAddressSuggestions(suggestions);
          setAddressSuggestionStatus("success");
        }
      } catch {
        if (requestId === addressSuggestionRequestId.current) {
          setAddressSuggestions([]);
          setAddressSuggestionStatus("error");
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);

      if (requestId === addressSuggestionRequestId.current) {
        addressSuggestionRequestId.current += 1;
      }
    };
  }, [
    deliveryAddress,
    loading,
    router,
    selectedBranchId,
    showAddressSuggestions,
  ]);

  // Tự động geocode địa chỉ, dựng tuyến và tính khoảng cách sau khi user
  // ngừng nhập; request cũ được vô hiệu bằng deliveryRequestId.
  useEffect(() => {
    const normalizedAddress = deliveryAddress.trim();

    if (loading || subtotal <= 0 || normalizedAddress.length < 5) {
      return;
    }

    const quoteKey = `${selectedBranchId}:${fulfillmentMethod}:${normalizedAddress}`;
    if (skipAutomaticAddressQuote.current === quoteKey) {
      skipAutomaticAddressQuote.current = null;
      return;
    }

    const requestId = ++deliveryRequestId.current;
    const timeoutId = window.setTimeout(
      async () => {
        const accessToken = sessionStorage.getItem("accessToken");

        if (!accessToken) {
          router.replace("/login?redirect=/checkout");
          return;
        }

        try {
          setCalculatingDelivery(true);
          setDeliveryError("");

          const savedLocation = resolvedDeliveryLocation.current;
          const quote =
            savedLocation?.address === normalizedAddress
              ? await getDeliveryLocationQuote(accessToken, {
                  latitude: savedLocation.latitude,
                  longitude: savedLocation.longitude,
                  subtotal,
                  fulfillmentMethod,
                  deliveryAddress: normalizedAddress,
                  branchId: selectedBranchId ?? undefined,
                })
              : await getDeliveryQuote(
                  accessToken,
                  normalizedAddress,
                  subtotal,
                  fulfillmentMethod,
                  selectedBranchId ?? undefined,
                );

          if (requestId !== deliveryRequestId.current) {
            return;
          }

          resolvedDeliveryLocation.current = {
            address: normalizedAddress,
            latitude: quote.latitude,
            longitude: quote.longitude,
          };
          setCustomerCoordinates({
            latitude: quote.latitude,
            longitude: quote.longitude,
          });
          setRouteCoordinates(quote.routeCoordinates);
          setDistanceKm(quote.distanceKm);
        } catch (error) {
          if (requestId !== deliveryRequestId.current) {
            return;
          }

          setDistanceKm(null);
          setCustomerCoordinates(null);
          setRouteCoordinates([]);
          setDeliveryError(
            error instanceof Error
              ? error.message
              : "Không thể tính khoảng cách cho địa chỉ này",
          );
        } finally {
          if (requestId === deliveryRequestId.current) {
            setCalculatingDelivery(false);
          }
        }
      },
      showAddressSuggestions ? 1400 : 500,
    );

    return () => {
      window.clearTimeout(timeoutId);

      if (requestId === deliveryRequestId.current) {
        deliveryRequestId.current += 1;
      }
    };
  }, [
    deliveryAddress,
    fulfillmentMethod,
    loading,
    router,
    selectedBranchId,
    showAddressSuggestions,
    subtotal,
  ]);

  // Điền thông tin người nhận từ địa chỉ đã lưu và tính tuyến ngay.
  function handleSavedAddressSelect(value: string) {
    if (value === "MANUAL") {
      deliveryRequestId.current += 1;
      addressSuggestionRequestId.current += 1;

      setSelectedSavedAddressId(null);

      setDeliveryAddress("");

      setAddressSuggestions([]);
      setAddressSuggestionStatus("idle");

      setShowAddressSuggestions(false);

      setCustomerCoordinates(null);

      setRouteCoordinates([]);
      setDistanceKm(null);
      setDeliveryError("");

      resolvedDeliveryLocation.current = null;

      skipAutomaticAddressQuote.current = null;

      return;
    }

    const addressId = Number(value);

    const selectedAddress = savedAddresses.find(
      (address) => address.id === addressId,
    );

    if (!selectedAddress) {
      return;
    }

    const coordinate = {
      latitude: Number(selectedAddress.latitude),

      longitude: Number(selectedAddress.longitude),
    };

    setSelectedSavedAddressId(selectedAddress.id);

    setReceiverName(selectedAddress.receiverName);

    setReceiverPhone(selectedAddress.receiverPhone);

    resolvedDeliveryLocation.current = {
      address: selectedAddress.addressLine,

      latitude: coordinate.latitude,

      longitude: coordinate.longitude,
    };

    void calculateDeliveryFromCoordinates(
      coordinate,
      selectedAddress.addressLine,
    );
  }

  // Dùng tọa độ từ gợi ý hoặc cú chạm bản đồ để tính lại tuyến đường ngay,
  // đồng thời đồng bộ địa chỉ chuẩn hóa mà backend trả về.
  async function calculateDeliveryFromCoordinates(
    coordinate: { latitude: number; longitude: number },
    selectedAddress?: string,
  ) {
    const accessToken = sessionStorage.getItem("accessToken");

    if (!accessToken) {
      router.replace("/login?redirect=/checkout");
      return;
    }

    const requestId = ++deliveryRequestId.current;
    addressSuggestionRequestId.current += 1;
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
    setAddressSuggestionStatus("idle");
    setCalculatingDelivery(true);
    setDeliveryError("");
    setDistanceKm(null);
    setCustomerCoordinates(coordinate);
    setRouteCoordinates([]);

    if (selectedAddress) {
      resolvedDeliveryLocation.current = {
        address: selectedAddress,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      };
      skipAutomaticAddressQuote.current = `${selectedBranchId}:${fulfillmentMethod}:${selectedAddress}`;
      setDeliveryAddress(selectedAddress);
    }

    try {
      const quote = await getDeliveryLocationQuote(accessToken, {
        ...coordinate,
        subtotal,
        fulfillmentMethod,
        deliveryAddress: selectedAddress,
        branchId: selectedBranchId ?? undefined,
      });

      if (requestId !== deliveryRequestId.current) {
        return;
      }

      resolvedDeliveryLocation.current = {
        address: quote.normalizedAddress,
        latitude: quote.latitude,
        longitude: quote.longitude,
      };
      skipAutomaticAddressQuote.current = `${selectedBranchId}:${fulfillmentMethod}:${quote.normalizedAddress}`;
      setDeliveryAddress(quote.normalizedAddress);
      setCustomerCoordinates({
        latitude: quote.latitude,
        longitude: quote.longitude,
      });
      setRouteCoordinates(quote.routeCoordinates);
      setDistanceKm(quote.distanceKm);
    } catch (error) {
      if (requestId !== deliveryRequestId.current) {
        return;
      }

      setRouteCoordinates([]);
      setDistanceKm(null);
      setDeliveryError(
        error instanceof Error
          ? error.message
          : "Không thể tính khoảng cách tại vị trí này",
      );
    } finally {
      if (requestId === deliveryRequestId.current) {
        setCalculatingDelivery(false);
      }
    }
  }

  // Kiểm tra dữ liệu giao/nhận, gửi đúng CartItem được chọn và chuyển sang
  // trang chi tiết đơn sau khi backend tạo đơn thành công.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError("");
      setSubmitting(true);

      if (!storeStatus?.isOpen) {
        throw new Error(
          storeStatus?.unavailableReason ||
            "Cửa hàng hiện chưa nhận đơn đặt hàng",
        );
      }

      if (!selectedBranchId) {
        throw new Error("Vui lòng chọn chi nhánh phục vụ");
      }

      if (
        paymentMethod === "BANK_TRANSFER" &&
        !storeStatus.bankTransferAvailable
      ) {
        throw new Error("Chi nhánh chưa hỗ trợ thanh toán bằng chuyển khoản");
      }

      if (!selectedMethodAvailable) {
        throw new Error("Phương thức nhận hàng đã chọn hiện không khả dụng");
      }

      if (deliveryDistanceExceeded) {
        throw new Error(
          "Địa chỉ nằm ngoài bán kính giao hàng tối đa " +
            storeStatus.maxDeliveryDistanceKm +
            " km",
        );
      }

      const accessToken = sessionStorage.getItem("accessToken");

      if (!accessToken) {
        router.replace("/login?redirect=/checkout");

        return;
      }

      if (
        fulfillmentMethod === "DELIVERY" &&
        (distanceKm === null || !customerCoordinates)
      ) {
        throw new Error(
          "Vui lòng tính khoảng cách giao hàng trước khi đặt hàng",
        );
      }

      if (fulfillmentMethod === "PICKUP" && !hasStoreCoordinates) {
        throw new Error("Tọa độ cửa hàng chưa được cấu hình");
      }

      const checkoutCoordinates =
        fulfillmentMethod === "PICKUP"
          ? configuredStoreCoordinates
          : customerCoordinates!;
      const checkoutAddress =
        fulfillmentMethod === "PICKUP"
          ? configuredStoreAddress
          : deliveryAddress.trim();

      const order = await checkoutOrder(accessToken, {
        branchId: selectedBranchId,
        cartItemIds: reorderOrderId ? undefined : selectedItemIds,
        reorderOrderId: reorderOrderId ?? undefined,
        reorderOrderItemIds: reorderOrderId ? selectedItemIds : undefined,

        receiverName: receiverName.trim(),

        receiverPhone: receiverPhone.trim(),

        fulfillmentMethod,
        deliveryAddress: checkoutAddress,
        deliveryLatitude: String(checkoutCoordinates.latitude),
        deliveryLongitude: String(checkoutCoordinates.longitude),
        paymentMethod,

        note: note.trim() || undefined,

        voucherCodes:
          selectedVoucherCodes.length > 0 ? selectedVoucherCodes : undefined,

        loyaltyPointsToUse: loyaltyPointsToUse || undefined,
      });

      // Không giữ lựa chọn checkout cũ sau khi đặt hàng thành công
      sessionStorage.removeItem("checkoutItemIds");
      sessionStorage.removeItem("checkoutReorderOrderId");
      sessionStorage.removeItem("checkoutReorderOrderItemIds");

      router.replace(`/orders/${order.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể đặt hàng");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16 text-center text-sm text-[#78866B]">
        Đang chuẩn bị thanh toán...
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-[1200px] px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:pb-8"
    >
      <div className="flex items-center gap-3">
        <Link
          href={reorderOrderId ? `/orders/${reorderOrderId}` : "/cart"}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9E1D8] bg-white text-[#4A2C20]"
        >
          <ArrowLeft size={18} />
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-[#1F1B18]">Thanh toán</h1>

          <p className="mt-1 text-sm text-[#78866B]">
            Kiểm tra thông tin trước khi đặt hàng.
          </p>
        </div>
      </div>

      <ToastMessage message={reorderMessage} variant="info" />
      <ToastMessage message={error} />
      <ToastMessage message={deliveryError} />

      {storeStatus && (
        <div
          className={
            storeStatus.isOpen
              ? "mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
              : "mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800"
          }
        >
          <Store size={19} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold">
              Trạng thái nhận đơn · {storeStatus.branch.name}
            </p>
            <p className="mt-1 text-sm leading-6">
              {storeStatus.isOpen
                ? "Cửa hàng đang mở · Dự kiến chuẩn bị " +
                  storeStatus.preparationMinutes +
                  " phút · Phục vụ " +
                  storeStatus.openingTime +
                  "–" +
                  storeStatus.closingTime
                : storeStatus.unavailableReason}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-5">
          {/* Thông tin giao hàng */}
          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin size={19} className="text-[#C9894B]" />

              <h2 className="font-bold text-[#2A211D]">Thông tin nhận hàng</h2>
            </div>
            {savedAddresses.length > 0 && (
              <div className="mt-5 rounded-2xl border border-[#E9E1D8] bg-[#FAF8F5] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#2A211D]">
                      Địa chỉ đã lưu
                    </p>

                    <p className="mt-1 text-xs text-[#78866B]">
                      Chọn để điền nhanh thông tin nhận hàng.
                    </p>
                  </div>

                  <Link
                    href="/profile"
                    className="text-xs font-semibold text-[#B66F32]"
                  >
                    Quản lý địa chỉ
                  </Link>
                </div>

                <select
                  value={
                    selectedSavedAddressId !== null
                      ? String(selectedSavedAddressId)
                      : "MANUAL"
                  }
                  onChange={(event) =>
                    handleSavedAddressSelect(event.target.value)
                  }
                  className="mt-3 h-12 w-full cursor-pointer rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B]"
                >
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label}
                      {address.isDefault ? " · Mặc định" : ""}
                      {" · "}
                      {address.receiverName}
                      {" · "}
                      {address.addressLine}
                    </option>
                  ))}

                  <option value="MANUAL">Nhập địa chỉ khác</option>
                </select>
              </div>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#5E5650]">
                  Người nhận
                </label>

                <div className="relative">
                  <UserRound
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
                  />

                  <input
                    value={receiverName}
                    onChange={(event) => {
                      setReceiverName(event.target.value);
                    }}
                    required
                    minLength={2}
                    className="h-11 w-full rounded-xl border border-[#E9E1D8] pl-10 pr-4 text-sm outline-none focus:border-[#C9894B]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#5E5650]">
                  Số điện thoại
                </label>

                <div className="relative">
                  <Phone
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A817B]"
                  />

                  <input
                    value={receiverPhone}
                    onChange={(event) => {
                      setReceiverPhone(event.target.value);
                    }}
                    required
                    minLength={8}
                    className="h-11 w-full rounded-xl border border-[#E9E1D8] pl-10 pr-4 text-sm outline-none focus:border-[#C9894B]"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-[#5E5650]">
                {fulfillmentMethod === "PICKUP"
                  ? "Địa chỉ xuất phát"
                  : "Địa chỉ giao hàng"}
              </label>

              <div className="relative">
                <textarea
                  value={deliveryAddress}
                  onFocus={() => setShowAddressSuggestions(true)}
                  onBlur={() => {
                    window.setTimeout(
                      () => setShowAddressSuggestions(false),
                      150,
                    );
                  }}
                  onChange={(event) => {
                    deliveryRequestId.current += 1;
                    addressSuggestionRequestId.current += 1;
                    skipAutomaticAddressQuote.current = null;
                    resolvedDeliveryLocation.current = null;
                    setSelectedSavedAddressId(null);
                    setDeliveryAddress(event.target.value);
                    setShowAddressSuggestions(true);
                    setAddressSuggestions([]);
                    setAddressSuggestionStatus("idle");
                    setCalculatingDelivery(false);
                    setDistanceKm(null);
                    setCustomerCoordinates(null);
                    setRouteCoordinates([]);
                    setDeliveryError("");
                  }}
                  required
                  minLength={5}
                  rows={2}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showAddressSuggestions}
                  aria-controls="checkout-address-suggestions"
                  className="w-full resize-none rounded-xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
                  placeholder={
                    fulfillmentMethod === "PICKUP"
                      ? "Nhập địa chỉ của bạn để xem đường đến quán..."
                      : "Nhập địa chỉ nhận hàng..."
                  }
                />

                {showAddressSuggestions &&
                  deliveryAddress.trim().length >= 3 &&
                  addressSuggestionStatus !== "idle" && (
                    <div
                      id="checkout-address-suggestions"
                      className="absolute left-0 right-0 top-full z-[700] mt-2 overflow-hidden rounded-xl border border-[#E9E1D8] bg-white shadow-xl"
                    >
                      {addressSuggestionStatus === "loading" ? (
                        <p className="px-4 py-3 text-sm text-[#8A817B]">
                          Đang tìm địa chỉ...
                        </p>
                      ) : addressSuggestionStatus === "error" ? (
                        <p className="px-4 py-3 text-sm text-red-600">
                          Không thể tải gợi ý địa chỉ. Vui lòng thử lại.
                        </p>
                      ) : addressSuggestions.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-[#8A817B]">
                          Không tìm thấy địa chỉ phù hợp.
                        </p>
                      ) : (
                        addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              void calculateDeliveryFromCoordinates(
                                {
                                  latitude: suggestion.latitude,
                                  longitude: suggestion.longitude,
                                },
                                suggestion.displayName,
                              );
                            }}
                            className="flex w-full items-start gap-3 border-b border-[#F0E8E0] px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-[#FFF8F0]"
                          >
                            <MapPin
                              size={17}
                              className="mt-0.5 shrink-0 text-[#C9894B]"
                            />
                            <span className="leading-5 text-[#4A423D]">
                              {suggestion.displayName}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
              </div>
            </div>{" "}
            <div className="mt-5 border-t border-[#E9E1D8] pt-5">
              <div className="flex items-center gap-2">
                <NotebookPen size={19} className="text-[#C9894B]" />

                <h3 className="font-bold text-[#2A211D]">Ghi chú</h3>
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="mt-4 w-full resize-none rounded-xl border border-[#E9E1D8] px-4 py-3 text-sm outline-none focus:border-[#C9894B]"
                placeholder="Ví dụ: ít đá, gọi trước khi giao..."
              />
            </div>
          </section>

          {/* Phương thức nhận hàng */}
          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <PackageCheck size={19} className="text-[#C9894B]" />
              <h2 className="font-bold text-[#2A211D]">
                Phương thức nhận hàng
              </h2>
            </div>

            <label className="mt-4 block text-sm font-semibold text-[#4A423D]">
              <span>Chi nhánh phục vụ</span>
              <select
                value={selectedBranchId ?? ""}
                disabled={branchLoading}
                onChange={(event) =>
                  void handleBranchChange(event.target.value)
                }
                className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-[#E9E1D8] bg-white px-4 text-sm outline-none focus:border-[#C9894B] disabled:cursor-wait disabled:bg-[#FAF8F5]"
              >
                {storeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} · {location.name}
                    {location.isOpen ? "" : " · Chưa sẵn sàng"}
                  </option>
                ))}
              </select>
            </label>

            {selectedStoreLocation?.address && (
              <p className="mt-2 text-xs leading-5 text-[#78866B]">
                {selectedStoreLocation.address}
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!storeStatus?.deliveryAvailable}
                onClick={() => selectFulfillmentMethod("DELIVERY")}
                aria-pressed={fulfillmentMethod === "DELIVERY"}
                className={`rounded-2xl border p-4 text-left transition ${
                  fulfillmentMethod === "DELIVERY"
                    ? "border-[#C9894B] bg-[#FFF8F0] shadow-sm"
                    : "border-[#E9E1D8] bg-white hover:border-[#D8C5B4]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="flex items-center gap-2 font-bold text-[#2A211D]">
                  <Truck size={19} className="text-[#C9894B]" />
                  Giao hàng
                </span>
              </button>

              <button
                type="button"
                disabled={!storeStatus?.pickupAvailable}
                onClick={() => selectFulfillmentMethod("PICKUP")}
                aria-pressed={fulfillmentMethod === "PICKUP"}
                className={`rounded-2xl border p-4 text-left transition ${
                  fulfillmentMethod === "PICKUP"
                    ? "border-[#C9894B] bg-[#FFF8F0] shadow-sm"
                    : "border-[#E9E1D8] bg-white hover:border-[#D8C5B4]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="flex items-center gap-2 font-bold text-[#2A211D]">
                  <Store size={19} className="text-[#C9894B]" />
                  Đến quán lấy
                </span>
              </button>
            </div>

            {deliveryDistanceExceeded && (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                Ngoài bán kính giao hàng tối đa{" "}
                {storeStatus?.maxDeliveryDistanceKm} km.
              </p>
            )}

            {storeStatus && !selectedMethodAvailable && storeStatus.isOpen && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                Phương thức này đang tạm ngưng. Vui lòng chọn phương thức còn
                khả dụng.
              </p>
            )}

            {fulfillmentMethod === "PICKUP" && (
              <div className="mt-4 rounded-2xl bg-[#FAF8F5] p-4">
                <div className="flex items-start gap-3">
                  <Store size={20} className="mt-0.5 shrink-0 text-[#C9894B]" />
                  <div>
                    <p className="font-bold text-[#2A211D]">
                      Nhận món tại Kippora Coffee & Tea
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#5E5650]">
                      {configuredStoreAddress}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-700">
                      Phí nhận hàng: Miễn phí
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-xl border border-[#E9E1D8] bg-[#F3E9DE]">
              {hasStoreCoordinates ? (
                <DeliveryRouteMap
                  storeCoordinates={configuredStoreCoordinates}
                  customerCoordinates={customerCoordinates}
                  routeCoordinates={routeCoordinates}
                  customerLabel={
                    fulfillmentMethod === "PICKUP"
                      ? "Điểm xuất phát"
                      : "Điểm giao hàng"
                  }
                  onLocationSelect={(coordinate) => {
                    void calculateDeliveryFromCoordinates(coordinate);
                  }}
                />
              ) : (
                <div className="flex h-48 items-center justify-center px-6 text-center text-sm text-[#8A817B]">
                  Chi nhánh chưa cấu hình tọa độ trên trang quản lý chi nhánh.
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-[#8A817B]">
              {fulfillmentMethod === "PICKUP"
                ? "Nhập địa chỉ hoặc chọn trên bản đồ để tính đường từ bạn đến quán."
                : "Nhập địa chỉ hoặc chọn trên bản đồ để tính đường từ quán đến bạn."}
            </p>

            {calculatingDelivery && (
              <p className="mt-3 text-sm font-medium text-[#7A4B2B]">
                Đang tìm tuyến đường...
              </p>
            )}

            {distanceKm !== null && fulfillmentMethod === "DELIVERY" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#FAF8F5] p-3">
                  <p className="text-xs text-[#78866B]">Khoảng cách</p>
                  <p className="mt-1 font-bold text-[#2A211D]">
                    {distanceKm} km
                  </p>
                </div>
                <div className="rounded-xl bg-[#FAF8F5] p-3">
                  <p className="text-xs text-[#78866B]">Phí ban đầu</p>
                  <p className="mt-1 font-bold text-[#2A211D]">
                    {formatCurrency(deliveryBaseFee)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#FAF8F5] p-3">
                  <p className="text-xs text-[#78866B]">Phí sau ưu đãi</p>
                  <p className="mt-1 font-bold text-[#4A2C20]">
                    {formatCurrency(deliveryFee)}
                  </p>
                </div>
              </div>
            )}

            {distanceKm !== null && fulfillmentMethod === "PICKUP" && (
              <div className="mt-4 rounded-xl bg-[#FAF8F5] p-3">
                <p className="text-xs text-[#78866B]">Quãng đường đến quán</p>
                <p className="mt-1 font-bold text-[#2A211D]">{distanceKm} km</p>
              </div>
            )}
          </section>
          {/* Voucher */}
          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BadgePercent size={19} className="text-[#C9894B]" />
                <h2 className="font-bold text-[#2A211D]">Voucher</h2>
              </div>
              <span className="rounded-full bg-[#F3E9DE] px-2.5 py-1 text-xs font-semibold text-[#7A4B2B]">
                {selectedVoucherCodes.length}/2 đã chọn
              </span>
            </div>

            <input
              value={selectedVoucherCodes.join(", ")}
              readOnly
              placeholder="Chọn voucher bên dưới"
              aria-label="Voucher đã chọn"
              className="mt-4 h-11 w-full cursor-default rounded-xl border border-[#E9E1D8] bg-[#FAF8F5] px-4 text-sm font-medium uppercase text-[#4A2C20] outline-none"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {vouchers.length === 0 ? (
                <p className="col-span-full rounded-xl bg-[#FAF8F5] px-4 py-5 text-center text-sm text-[#8A817B]">
                  Chưa có voucher phù hợp.
                </p>
              ) : (
                vouchers.map((voucher) => {
                  const selected = selectedVoucherCodes.includes(voucher.code);
                  const limitReached =
                    selectedVoucherCodes.length >= 2 && !selected;
                  const disabled = !voucher.canUse || limitReached;

                  return (
                    <button
                      key={voucher.code}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleVoucher(voucher)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-[#C9894B] bg-[#FFF8F0]"
                          : "border-[#E9E1D8] bg-white hover:border-[#D9B38C]"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#4A2C20]">
                            {voucher.code}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#78866B]">
                            {voucher.description ||
                              (voucher.discountType === "PERCENT"
                                ? `Giảm ${Number(voucher.discountValue)}%`
                                : `Giảm ${formatCurrency(voucher.discountValue)}`)}
                          </p>
                          {!voucher.canUse && voucher.unavailableReason && (
                            <p className="mt-1 text-xs font-medium text-amber-700">
                              {voucher.unavailableReason}
                            </p>
                          )}
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                            selected
                              ? "border-[#C9894B] bg-[#C9894B] text-white"
                              : "border-[#D9CEC4] text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Điểm tích lũy */}
          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Coins size={19} className="text-[#C9894B]" />
                <h2 className="font-bold text-[#2A211D]">Điểm tích lũy</h2>
              </div>
              <span className="font-bold text-[#4A2C20]">
                {loyaltyPoints.toLocaleString("vi-VN")} điểm
              </span>
            </div>

            {loyaltyPoints < 1000 ? (
              <p className="mt-4 rounded-xl bg-[#FAF8F5] px-4 py-3 text-sm leading-6 text-[#8A817B]">
                Cần thêm{" "}
                <strong className="text-[#C9894B]">
                  {(1000 - loyaltyPoints).toLocaleString("vi-VN")}
                </strong>{" "}
                điểm để mở khóa đổi điểm.
              </p>
            ) : (
              <div className="mt-4">
                <label className="text-sm font-medium text-[#6B625C]">
                  Điểm muốn dùng
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={loyaltyPointsToUse || ""}
                  onChange={(event) => {
                    // Chuẩn hóa chuỗi số để không giữ các số 0 ở đầu.
                    const normalizedValue = event.target.value.replace(
                      /^0+(?=\d)/,
                      "",
                    );

                    handlePointsChange(Number(normalizedValue));
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-[#E9E1D8] px-4 text-sm outline-none focus:border-[#C9894B]"
                />
                <p className="mt-2 text-xs text-[#8A817B]">
                  Mỗi 1.000 điểm giảm 1.000đ.
                </p>
              </div>
            )}
          </section>

          {/* Phương thức thanh toán */}
          <section className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
            <h2 className="font-bold text-[#2A211D]">Phương thức thanh toán</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("COD")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  paymentMethod === "COD"
                    ? "border-[#C9894B] bg-[#FFF8F0] ring-1 ring-[#C9894B]"
                    : "border-[#E9E1D8] hover:border-[#D9B38C]"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#9A5D2E]">
                  <Banknote size={22} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#2A211D]">
                    Tiền mặt
                  </span>
                  <span className="mt-1 block text-xs text-[#78866B]">
                    Thanh toán khi nhận hàng
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled={!storeStatus?.bankTransferAvailable}
                onClick={() => setPaymentMethod("BANK_TRANSFER")}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  paymentMethod === "BANK_TRANSFER"
                    ? "border-[#C9894B] bg-[#FFF8F0] ring-1 ring-[#C9894B]"
                    : "border-[#E9E1D8] hover:border-[#D9B38C]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#9A5D2E]">
                  <Landmark size={22} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#2A211D]">
                    Chuyển khoản
                  </span>
                  <span className="mt-1 block text-xs text-[#78866B]">
                    {storeStatus?.bankTransferAvailable
                      ? "Thanh toán qua ngân hàng"
                      : "Chi nhánh chưa hỗ trợ"}
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled
                className="relative flex items-center gap-3 rounded-xl border border-[#E9E1D8] p-4 text-left opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <QrCode size={22} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#2A211D]">
                    VNPay
                  </span>
                  <span className="mt-1 block text-xs text-[#78866B]">
                    Sắp ra mắt
                  </span>
                </span>
              </button>

              <button
                type="button"
                disabled
                className="relative flex items-center gap-3 rounded-xl border border-[#E9E1D8] p-4 text-left opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-700">
                  <WalletCards size={22} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-[#2A211D]">
                    MoMo
                  </span>
                  <span className="mt-1 block text-xs text-[#78866B]">
                    Sắp ra mắt
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* Đơn hàng sticky */}
        <aside className="h-fit self-start rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center gap-2">
            <PackageCheck size={20} className="text-[#C9894B]" />
            <h2 className="text-lg font-bold text-[#2A211D]">
              Đơn hàng của bạn
            </h2>
          </div>
          <div className="mt-4 divide-y divide-[#F0E8E0] rounded-xl border border-[#E9E1D8]">
            {selectedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#2A211D]">
                    {item.product.name}
                  </p>
                  <p className="mt-1 text-xs text-[#78866B]">
                    Size {item.variant.size} · x{item.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-[#4A2C20]">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3 border-t border-[#E9E1D8] pt-5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#78866B]">Sản phẩm</span>
              <span className="font-semibold text-[#2A211D]">
                {selectedQuantity}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-[#78866B]">Tạm tính</span>
              <span className="font-semibold text-[#2A211D]">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-[#78866B]">Nhận hàng</span>
              <span className="text-right font-semibold text-[#2A211D]">
                {fulfillmentMethod === "PICKUP" ? "Đến quán lấy" : "Giao hàng"}
              </span>
            </div>

            {deliveryDistanceExceeded && (
              <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                Ngoài bán kính giao hàng tối đa{" "}
                {storeStatus?.maxDeliveryDistanceKm} km.
              </p>
            )}

            {storeStatus && !selectedMethodAvailable && storeStatus.isOpen && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                Phương thức này đang tạm ngưng. Vui lòng chọn phương thức còn
                khả dụng.
              </p>
            )}

            {fulfillmentMethod === "PICKUP" && (
              <div className="flex justify-between">
                <span className="text-[#78866B]">Phí nhận tại quán</span>
                <span className="font-semibold text-emerald-700">Miễn phí</span>
              </div>
            )}

            {fulfillmentMethod === "DELIVERY" && distanceKm !== null && (
              <div className="flex justify-between">
                <span className="text-[#78866B]">Phí giao hàng</span>
                <span className="font-semibold text-[#2A211D]">
                  {formatCurrency(deliveryBaseFee)}
                </span>
              </div>
            )}

            {deliveryDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#78866B]">Ưu đãi giao hàng</span>
                <span className="font-medium text-emerald-700">
                  -{formatCurrency(deliveryDiscount)}
                </span>
              </div>
            )}

            {voucherDiscount > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-[#78866B]">
                  Voucher ({selectedVoucherCodes.join(", ")})
                </span>
                <span className="shrink-0 font-medium text-emerald-700">
                  -{formatCurrency(voucherDiscount)}
                </span>
              </div>
            )}

            {loyaltyPointsToUse > 0 && (
              <div className="flex justify-between">
                <span className="text-[#78866B]">Điểm sử dụng</span>
                <span className="font-medium text-emerald-700">
                  -{formatCurrency(loyaltyPointsToUse)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-[#E9E1D8] pt-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#2A211D]">
                Tổng thanh toán
              </span>
              <span className="text-xl font-bold text-[#4A2C20]">
                {formatCurrency(
                  Math.max(
                    0,
                    subtotal -
                      voucherDiscount -
                      loyaltyPointsToUse +
                      deliveryFee,
                  ),
                )}
              </span>
            </div>
            {/* <p className="mt-2 text-xs leading-5 text-[#8A817B]">
              Tổng cuối cùng sẽ được backend tính lại sau khi kiểm tra voucher
              và điểm.
            </p> */}
          </div>
          <button
            type="submit"
            disabled={
              storeCheckoutDisabled ||
              submitting ||
              selectedItems.length === 0 ||
              (fulfillmentMethod === "DELIVERY" && distanceKm === null)
            }
            className="mt-5 w-full rounded-2xl bg-[#4A2C20] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#382118] disabled:cursor-wait disabled:opacity-50"
          >
            {submitting
              ? "Đang đặt hàng..."
              : storeCheckoutDisabled
                ? "Cửa hàng chưa nhận đơn"
                : "Đặt hàng"}
          </button>
          {fulfillmentMethod === "DELIVERY" ? (
            <div className="mt-3 rounded-xl bg-[#FAF4EC] px-4 py-3 text-xs leading-5 text-[#7A4B2B]">
              {subtotal < firstDeliveryDiscountThreshold ? (
                <>
                  Mua thêm{" "}
                  <strong>
                    {formatCurrency(firstDeliveryDiscountThreshold - subtotal)}
                  </strong>{" "}
                  để được giảm {formatCurrency(firstDeliveryDiscountAmount)} phí
                  giao hàng.
                </>
              ) : subtotal < secondDeliveryDiscountThreshold ? (
                <>
                  Mua thêm{" "}
                  <strong>
                    {formatCurrency(secondDeliveryDiscountThreshold - subtotal)}
                  </strong>{" "}
                  để được giảm lên{" "}
                  {formatCurrency(secondDeliveryDiscountAmount)}
                  phí giao hàng.
                </>
              ) : (
                <>
                  Đơn hàng đã đạt ưu đãi giảm tối đa{" "}
                  {formatCurrency(secondDeliveryDiscountAmount)} phí giao hàng.
                </>
              )}
              <span className="mt-1 block text-[#8A817B]">
                Phí cơ bản {formatCurrency(configuredDeliveryBaseFee)} cho{" "}
                {deliveryBaseDistanceKm} km đầu, thêm{" "}
                {formatCurrency(deliveryFeePerKm)}/km tiếp theo. Ưu đãi chỉ trừ
                vào phí giao hàng.
              </span>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-[#EEF6EA] px-4 py-3 text-xs leading-5 text-[#4F6B45]">
              Đơn hàng sẽ được chuẩn bị tại quán. Bạn không phải trả phí giao
              hàng.
            </div>
          )}{" "}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E9E1D8] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(74,44,32,0.10)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#78866B]">Tổng dự kiến</p>
            <p className="truncate text-lg font-bold text-[#4A2C20]">
              {formatCurrency(
                Math.max(
                  0,
                  subtotal - voucherDiscount - loyaltyPointsToUse + deliveryFee,
                ),
              )}
            </p>
          </div>
          <button
            type="submit"
            disabled={
              storeCheckoutDisabled ||
              submitting ||
              selectedItems.length === 0 ||
              (fulfillmentMethod === "DELIVERY" && distanceKm === null)
            }
            className="rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting
              ? "Đang đặt..."
              : storeCheckoutDisabled
                ? "Chưa thể đặt hàng"
                : "Đặt hàng"}
          </button>
        </div>
      </div>
    </form>
  );
}
