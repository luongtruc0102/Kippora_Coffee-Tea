"use client";

import dynamic from "next/dynamic";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Check,
  LoaderCircle,
  MapPin,
  X,
} from "lucide-react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import {
  createAddress,
  updateAddress,
} from "@/services/address.service";

import {
  getAddressSuggestions,
  getDeliveryLocationQuote,
  type AddressSuggestion,
  type RouteCoordinate,
} from "@/services/order.service";

import { useAppToast } from "@/components/ui/app-toast-provider";

import type {
  UserAddress,
} from "@/types/address";

const DeliveryRouteMap = dynamic(
  () =>
    import(
      "@/components/user/delivery-route-map"
    ),
  {
    ssr: false,

    loading: () => (
      <div className="flex h-72 items-center justify-center bg-[#F3E9DE] text-sm text-[#8A817B]">
        Đang tải bản đồ...
      </div>
    ),
  },
);

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  address:
    | UserAddress
    | null;

  defaultReceiverName?: string;
  defaultReceiverPhone?: string;

  onClose: () => void;

  onSaved: (
    address: UserAddress,
  ) => void;
};

export default function AddressFormModal({
  address,
  defaultReceiverName = "",
  defaultReceiverPhone = "",
  onClose,
  onSaved,
}: Props) {
  const { showToast } =
    useAppToast();

  const [label, setLabel] =
    useState(
      address?.label ??
        "Nhà riêng",
    );
  
  const [
    receiverName,
    setReceiverName,
  ] = useState(
    address?.receiverName ??
      defaultReceiverName,
  );
  
  const [
    receiverPhone,
    setReceiverPhone,
  ] = useState(
    address?.receiverPhone ??
      defaultReceiverPhone,
  );
  
  const [
    addressLine,
    setAddressLine,
  ] = useState(
    address?.addressLine ?? "",
  );
  
  const [
    routeCoordinates,
    setRouteCoordinates,
  ] = useState<RouteCoordinate[]>(
    [],
  );
  
  const [
    coordinate,
    setCoordinate,
  ] = useState<Coordinate | null>(
    address
      ? {
          latitude: Number(
            address.latitude,
          ),
  
          longitude: Number(
            address.longitude,
          ),
        }
      : null,
  );

  const [
    suggestions,
    setSuggestions,
  ] = useState<
    AddressSuggestion[]
  >([]);

  const [
    suggestionStatus,
    setSuggestionStatus,
  ] = useState<
    | "idle"
    | "loading"
    | "success"
    | "error"
  >("idle");

  const [
    resolvingLocation,
    setResolvingLocation,
  ] = useState(
    Boolean(address),
  );

  const [submitting, setSubmitting] =
    useState(false);

  const requestIdRef =
    useRef(0);

  const debouncedAddress =
    useDebouncedValue(
      addressLine,
      450,
    );

  const storeCoordinates = {
    latitude: Number(
      process.env
        .NEXT_PUBLIC_STORE_LATITUDE,
    ),

    longitude: Number(
      process.env
        .NEXT_PUBLIC_STORE_LONGITUDE,
    ),
  };

  const hasStoreCoordinates =
    Number.isFinite(
      storeCoordinates.latitude,
    ) &&
    Number.isFinite(
      storeCoordinates.longitude,
    );

  // Khi chỉnh sửa địa chỉ, tải tuyến đường đã lưu một lần khi modal được mount.
  useEffect(() => {
    if (!address) {
      return;
    }

    const editingAddress =
      address;

    let cancelled = false;

    async function loadInitialRoute() {
      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        setResolvingLocation(false);
        return;
      }

      try {
        const quote =
          await getDeliveryLocationQuote(
            accessToken,
            {
              latitude: Number(
                editingAddress.latitude,
              ),

              longitude: Number(
                editingAddress.longitude,
              ),

              subtotal: 0,

              fulfillmentMethod:
                "DELIVERY",

              deliveryAddress:
                editingAddress.addressLine,
            },
          );

        if (cancelled) {
          return;
        }

        setAddressLine(
          quote.normalizedAddress,
        );

        setCoordinate({
          latitude: quote.latitude,
          longitude: quote.longitude,
        });

        setRouteCoordinates(
          quote.routeCoordinates,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setRouteCoordinates([]);

        showToast(
          error instanceof Error
            ? error.message
            : "Không thể tải tuyến đường",
          "error",
        );
      } finally {
        if (!cancelled) {
          setResolvingLocation(false);
        }
      }
    }

    void loadInitialRoute();

    return () => {
      cancelled = true;
    };
  }, [
    address,
    showToast,
  ]);
  // Tải dropdown gợi ý sau khi user dừng nhập.
  useEffect(() => {
    if (
      debouncedAddress.trim()
        .length < 3
    ) {
      return;
    }

    const requestId =
      ++requestIdRef.current;

    async function loadSuggestions() {
      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        return;
      }

      try {
        setSuggestionStatus(
          "loading",
        );

        const data =
          await getAddressSuggestions(
            accessToken,
            debouncedAddress,
          );

        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setSuggestions(data);
        setSuggestionStatus(
          "success",
        );
      } catch {
        if (
          requestId ===
          requestIdRef.current
        ) {
          setSuggestions([]);

          setSuggestionStatus(
            "error",
          );
        }
      }
    }

    void loadSuggestions();

    return () => {
      requestIdRef.current += 1;
    };
  }, [
    debouncedAddress,
  ]);

  // Chuẩn hóa địa chỉ và kiểm tra vị trí khi chọn gợi ý hoặc bản đồ.
  async function resolveLocation(
    selectedCoordinate: Coordinate,
    selectedAddress?: string,
  ) {
    const accessToken =
      sessionStorage.getItem(
        "accessToken",
      );

    if (!accessToken) {
      showToast(
        "Không tìm thấy phiên đăng nhập.",
        "error",
      );

      return;
    }

    try {
      setResolvingLocation(true);
      setSuggestions([]);
      setSuggestionStatus("idle");

      const quote =
        await getDeliveryLocationQuote(
          accessToken,
          {
            latitude:
              selectedCoordinate.latitude,

            longitude:
              selectedCoordinate.longitude,

            subtotal: 0,

            fulfillmentMethod:
              "DELIVERY",

            deliveryAddress:
              selectedAddress,
          },
        );

      setAddressLine(
        quote.normalizedAddress,
      );
      
      setCoordinate({
        latitude: quote.latitude,
        longitude: quote.longitude,
      });

      setRouteCoordinates(
        quote.routeCoordinates,
      );
    } catch (error) {
      setCoordinate(null);
      setRouteCoordinates([]);

      showToast(
        error instanceof Error
          ? error.message
          : "Không thể xác định vị trí",
        "error",
      );
    } finally {
      setResolvingLocation(false);
    }
  }

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!coordinate) {
      showToast(
        "Anh hãy chọn địa chỉ trong danh sách gợi ý hoặc chọn vị trí trên bản đồ.",
        "error",
      );

      return;
    }

    const normalizedLabel =
      label.trim();

    const normalizedName =
      receiverName.trim();

    const normalizedPhone =
      receiverPhone.trim();

    const normalizedAddress =
      addressLine.trim();

    if (!normalizedLabel) {
      showToast(
        "Vui lòng nhập tên địa chỉ.",
        "error",
      );

      return;
    }

    if (
      normalizedName.length < 2
    ) {
      showToast(
        "Tên người nhận chưa hợp lệ.",
        "error",
      );

      return;
    }

    if (
      normalizedPhone.length < 8
    ) {
      showToast(
        "Số điện thoại chưa hợp lệ.",
        "error",
      );

      return;
    }

    try {
      setSubmitting(true);

      const accessToken =
        sessionStorage.getItem(
          "accessToken",
        );

      if (!accessToken) {
        throw new Error(
          "Không tìm thấy phiên đăng nhập.",
        );
      }

      const input = {
        label:
          normalizedLabel,

        receiverName:
          normalizedName,

        receiverPhone:
          normalizedPhone,

        addressLine:
          normalizedAddress,

        latitude:
          String(
            coordinate.latitude,
          ),

        longitude:
          String(
            coordinate.longitude,
          ),
      };

      const savedAddress =
        address
          ? await updateAddress(
              accessToken,
              address.id,
              input,
            )
          : await createAddress(
              accessToken,
              input,
            );

      onSaved(savedAddress);

      showToast(
        address
          ? "Đã cập nhật địa chỉ."
          : "Đã thêm địa chỉ mới.",
        "success",
      );

      onClose();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể lưu địa chỉ",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="no-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-3xl overscroll-contain overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E1D8] bg-white px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#2A211D]">
              {address
                ? "Chỉnh sửa địa chỉ"
                : "Thêm địa chỉ mới"}
            </h2>

            <p className="mt-1 text-sm text-[#78866B]">
              Chọn đúng vị trí để tính phí giao hàng chính xác.
            </p>
          </div>

          <button
            type="button"
            disabled={
              submitting
            }
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#FAF8F5] text-[#5E5650] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-5 p-6"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
              Tên địa chỉ
            </label>

            <input
              value={label}
              maxLength={30}
              onChange={(event) =>
                setLabel(
                  event.target.value,
                )
              }
              placeholder="Ví dụ: Nhà riêng, Công ty..."
              className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
                Người nhận
              </label>

              <input
                value={
                  receiverName
                }
                maxLength={100}
                onChange={(event) =>
                  setReceiverName(
                    event.target
                      .value,
                  )
                }
                className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
                Số điện thoại
              </label>

              <input
                value={
                  receiverPhone
                }
                maxLength={20}
                inputMode="tel"
                onChange={(event) =>
                  setReceiverPhone(
                    event.target
                      .value,
                  )
                }
                className="h-12 w-full rounded-xl border border-[#E9E1D8] px-4 outline-none focus:border-[#C9894B]"
              />
            </div>
          </div>

          <div className="relative">
            <label className="mb-2 block text-sm font-semibold text-[#4A423D]">
              Địa chỉ giao hàng
            </label>

            <div className="relative">
              <MapPin
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C9894B]"
              />

              <input
                value={
                  addressLine
                }
                onChange={(event) => {
                  requestIdRef.current += 1;

                  setAddressLine(
                    event.target
                      .value,
                  );

                  // Khi user sửa chữ, tọa độ và tuyến đường cũ không còn đáng tin cậy.
                  setCoordinate(null);
                  setRouteCoordinates([]);
                  setSuggestions([]);
                  setSuggestionStatus(
                    "idle",
                  );
                }}
                placeholder="Nhập địa chỉ để xem gợi ý..."
                className="h-12 w-full rounded-xl border border-[#E9E1D8] pl-11 pr-12 outline-none focus:border-[#C9894B]"
              />

              {(suggestionStatus ===
                "loading" ||
                resolvingLocation) && (
                <LoaderCircle
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#C9894B]"
                />
              )}
            </div>

            {suggestionStatus !==
              "idle" &&
              !resolvingLocation && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#E9E1D8] bg-white p-2 shadow-xl">
                  {suggestionStatus ===
                  "loading" ? (
                    <p className="px-3 py-4 text-sm text-[#78866B]">
                      Đang tìm địa chỉ...
                    </p>
                  ) : suggestionStatus ===
                    "error" ? (
                    <p className="px-3 py-4 text-sm text-red-500">
                      Không thể tải gợi ý địa chỉ.
                    </p>
                  ) : suggestions.length ===
                    0 ? (
                    <p className="px-3 py-4 text-sm text-[#78866B]">
                      Không tìm thấy địa chỉ phù hợp.
                    </p>
                  ) : (
                    suggestions.map(
                      (suggestion) => (
                        <button
                          key={
                            suggestion.id
                          }
                          type="button"
                          onClick={() =>
                            void resolveLocation(
                              {
                                latitude:
                                  suggestion.latitude,

                                longitude:
                                  suggestion.longitude,
                              },

                              suggestion.displayName,
                            )
                          }
                          className="flex w-full cursor-pointer gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-[#FAF8F5]"
                        >
                          <MapPin
                            size={17}
                            className="mt-0.5 shrink-0 text-[#C9894B]"
                          />

                          {
                            suggestion.displayName
                          }
                        </button>
                      ),
                    )
                  )}
                </div>
              )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-[#F3E9DE]">
            {hasStoreCoordinates ? (
              <DeliveryRouteMap
                storeCoordinates={
                  storeCoordinates
                }
                customerCoordinates={
                  coordinate
                }
                routeCoordinates={
                  routeCoordinates
                }
                customerLabel="Địa chỉ đã chọn"
                onLocationSelect={(
                  selected,
                ) => {
                  void resolveLocation(
                    selected,
                  );
                }}
              />
            ) : (
              <div className="flex h-60 items-center justify-center px-5 text-center text-sm text-[#78866B]">
                Chưa cấu hình tọa độ cửa hàng trong `.env.local`.
              </div>
            )}
          </div>

          {coordinate && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <Check size={18} />

              Đã xác định vị trí chính xác trên bản đồ.
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-[#E9E1D8] pt-5">
            <button
              type="button"
              disabled={
                submitting
              }
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-[#E9E1D8] px-5 py-2.5 text-sm font-semibold text-[#5E5650]"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                resolvingLocation
              }
              className="cursor-pointer rounded-xl bg-[#4A2C20] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50"
            >
              {submitting
                ? "Đang lưu..."
                : address
                  ? "Lưu thay đổi"
                  : "Thêm địa chỉ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}