"use client";

import {
  Banknote,
  Check,
  Coffee,
  CreditCard,
  Download,
  ExternalLink,
  LoaderCircle,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import OrderReceiptContent from "@/components/staff/order-receipt-content";
import { useAppToast } from "@/components/ui/app-toast-provider";
import {
  getPublicCategories,
  getPublicProducts,
} from "@/services/menu.service";
import {
  createPosOrder,
  lookupPosCustomer,
  type PosCustomerLookupResult,
} from "@/services/order.service";
import type { Category, Product, Topping } from "@/types/menu";
import type { Order } from "@/types/order";

type PosCartTopping = Pick<Topping, "id" | "name" | "price">;

type PosCartItem = {
  key: string;
  productId: number;
  variantId: number;
  productName: string;
  size: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  toppings: PosCartTopping[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function getImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  return `${apiUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

export default function StaffPosPage() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | "ALL">(
    "ALL",
  );
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(
    null,
  );
  const [selectedVariantId, setSelectedVariantId] = useState(0);
  const [selectedToppingIds, setSelectedToppingIds] = useState<number[]>([]);
  const [configQuantity, setConfigQuantity] = useState(1);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerMatch, setCustomerMatch] =
    useState<PosCustomerLookupResult | null>(null);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">(
    "CASH",
  );
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Menu POS dùng cùng API fuzzy search với menu khách hàng.
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      async () => {
        try {
          const productData = await getPublicProducts(
            search,
            controller.signal,
          );
          setProducts(productData);

          if (categories.length === 0) {
            setCategories(await getPublicCategories());
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            showToast(
              error instanceof Error ? error.message : "Không thể tải menu POS",
              "error",
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      search ? 250 : 0,
    );

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [search, showToast, categories.length]);

  // Khi SĐT đủ dài, tự tìm lại hồ sơ và điền tên/điểm của khách cũ.
  useEffect(() => {
    const normalizedPhone = customerPhone.trim();
    if (normalizedPhone.length < 8) {
      return;
    }

    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setLookingUpCustomer(true);
        const result = await lookupPosCustomer(
          accessToken,
          normalizedPhone,
          controller.signal,
        );
        setCustomerMatch(result);
        setLoyaltyPointsToUse("");
        if (result.found && result.fullName) {
          setCustomerName(result.fullName);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setCustomerMatch(null);
          showToast(
            error instanceof Error
              ? error.message
              : "Không thể tìm thông tin khách",
            "error",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLookingUpCustomer(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [customerPhone, showToast]);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          selectedCategory === "ALL" || product.categoryId === selectedCategory,
      ),
    [products, selectedCategory],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );
  const availableLoyaltyPoints = customerMatch?.found
    ? customerMatch.loyaltyPoints
    : 0;
  const maximumLoyaltyPoints =
    availableLoyaltyPoints >= 1000
      ? Math.floor(Math.min(availableLoyaltyPoints, subtotal) / 1000) * 1000
      : 0;
  const requestedLoyaltyPoints = Number(loyaltyPointsToUse) || 0;
  const loyaltyPointsInvalid =
    requestedLoyaltyPoints > 0 &&
    (requestedLoyaltyPoints % 1000 !== 0 ||
      requestedLoyaltyPoints > maximumLoyaltyPoints);
  const selectedLoyaltyPoints = loyaltyPointsInvalid
    ? 0
    : requestedLoyaltyPoints;
  const totalPrice = subtotal - selectedLoyaltyPoints;

  const selectedVariant = configuringProduct?.variants.find(
    (variant) => variant.id === selectedVariantId,
  );
  const configuringUnitPrice =
    Number(selectedVariant?.price ?? 0) +
    (configuringProduct?.toppings ?? [])
      .filter(({ topping }) => selectedToppingIds.includes(topping.id))
      .reduce((sum, { topping }) => sum + Number(topping.price), 0);

  function openProduct(product: Product) {
    const firstVariant = product.variants[0];
    if (!firstVariant) {
      showToast("Sản phẩm chưa có size đang bán", "error");
      return;
    }
    setConfiguringProduct(product);
    setSelectedVariantId(firstVariant.id);
    setSelectedToppingIds([]);
    setConfigQuantity(1);
  }

  function addConfiguredItem() {
    if (!configuringProduct || !selectedVariant) return;
    const toppings = configuringProduct.toppings
      .map(({ topping }) => topping)
      .filter((topping) => selectedToppingIds.includes(topping.id));
    const sortedToppingIds = toppings.map((topping) => topping.id).sort();
    const key = `${configuringProduct.id}:${selectedVariant.id}:${sortedToppingIds.join("-")}`;

    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + configQuantity }
            : item,
        );
      }
      return [
        ...current,
        {
          key,
          productId: configuringProduct.id,
          variantId: selectedVariant.id,
          productName: configuringProduct.name,
          size: selectedVariant.size,
          imageUrl: configuringProduct.imageUrl,
          quantity: configQuantity,
          unitPrice: configuringUnitPrice,
          toppings,
        },
      ];
    });
    setConfiguringProduct(null);
    showToast("Đã thêm món vào hóa đơn", "success");
  }

  function updateQuantity(key: string, change: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.key === key
            ? { ...item, quantity: Math.max(0, item.quantity + change) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  async function submitOrder() {
    if (cart.length === 0 || submitting) return;
    if (customerPhone.trim() && customerPhone.trim().length < 8) {
      showToast("Số điện thoại khách phải có ít nhất 8 ký tự", "error");
      return;
    }
    if (
      customerPhone.trim() &&
      customerMatch?.found === false &&
      customerName.trim().length < 2
    ) {
      showToast("Khách dùng SĐT lần đầu cần nhập tên", "error");
      return;
    }
    const accessToken = sessionStorage.getItem("accessToken");
    if (!accessToken) {
      router.replace("/login?redirect=/staff/pos");
      return;
    }

    try {
      setSubmitting(true);
      const order = await createPosOrder(accessToken, {
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          toppingIds: item.toppings.map((topping) => topping.id),
        })),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod,
        loyaltyPointsToUse: selectedLoyaltyPoints || undefined,
        note: note.trim() || undefined,
      });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerMatch(null);
      setLoyaltyPointsToUse("");
      setNote("");
      setCompletedOrder(order);
      showToast(`Đã tạo hóa đơn POS #${order.id}`, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Không thể tạo hóa đơn POS",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // TODO(pos-direct-print): Khi cửa hàng trang bị máy in nhiệt, tích hợp QZ Tray
  // hoặc kiosk printing để in thẳng không qua hộp thoại của trình duyệt.
  async function downloadReceiptPdf() {
    if (!completedOrder || exportingPdf) return;

    const receipt = document.getElementById("pos-receipt-content");
    if (!receipt) {
      showToast("Không tìm thấy nội dung hóa đơn để tải", "error");
      return;
    }

    let exportReceipt: HTMLElement | null = null;
    let exportMask: HTMLDivElement | null = null;

    try {
      setExportingPdf(true);
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        // Hỗ trợ màu CSS lab()/oklch() do Tailwind 4 tạo ra.
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      // Không chụp trực tiếp node trong modal vì parent có max-height/overflow.
      // Bản sao này nằm trong viewport, được lớp chờ che lại và sẽ bị xóa sau khi
      // xuất xong nên toàn bộ bill luôn được render đầy đủ mà giao diện không lóe.
      exportReceipt = receipt.cloneNode(true) as HTMLElement;
      exportReceipt.removeAttribute("id");
      Object.assign(exportReceipt.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${Math.max(receipt.scrollWidth, 380)}px`,
        height: "auto",
        maxHeight: "none",
        overflow: "visible",
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        pointerEvents: "none",
        zIndex: "2147483646",
      });

      exportMask = document.createElement("div");
      exportMask.textContent = "Đang tạo hóa đơn...";
      Object.assign(exportMask.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#faf8f5",
        color: "#4a2c20",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "wait",
      });

      document.body.append(exportReceipt, exportMask);

      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );

      const exportWidth = Math.max(exportReceipt.scrollWidth, 1);
      const canvas = await html2canvas(exportReceipt, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: Math.max(exportWidth, 1024),
        scrollX: 0,
        scrollY: 0,
      });

      // Một trang giấy nhiệt 80 mm duy nhất; chiều cao tăng đúng theo nội dung,
      // không dùng auto-paging nên bill nhiều món vẫn liền mạch từ đầu đến cuối.
      const pageWidthMm = 80;
      const marginMm = 5;
      const imageWidthMm = pageWidthMm - marginMm * 2;
      const imageHeightMm = (canvas.height / canvas.width) * imageWidthMm;
      const pageHeightMm = Math.max(
        80,
        Math.ceil(imageHeightMm + marginMm * 2),
      );
      const pdf = new jsPDF({
        unit: "mm",
        format: [pageWidthMm, pageHeightMm],
        orientation: "portrait",
        compress: true,
      });

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.98),
        "JPEG",
        marginMm,
        marginMm,
        imageWidthMm,
        imageHeightMm,
        undefined,
        "FAST",
      );
      pdf.save(`kippora-hoa-don-${completedOrder.id}.pdf`);

      showToast("Đã tải hóa đơn PDF", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Không thể tạo file hóa đơn PDF",
        "error",
      );
    } finally {
      exportReceipt?.remove();
      exportMask?.remove();
      setExportingPdf(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#C9894B]">
          Bán hàng tại quầy
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#1F1B18]">POS Kippora</h1>
        <p className="mt-1 text-sm text-[#78866B]">
          Chọn món và tạo hóa đơn trực tiếp cho khách tại quán.
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">
          <div className="sticky top-20 z-20 rounded-2xl border border-[#E9E1D8] bg-white p-4 shadow-sm">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A918A]"
                size={19}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm nhanh tên món..."
                className="h-12 w-full rounded-xl border border-[#E9E1D8] bg-[#FCFAF7] pl-11 pr-4 outline-none transition focus:border-[#C9894B]"
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selectedCategory === "ALL" ? "bg-[#4A2C20] text-white" : "bg-[#F7F2EC] text-[#5E5650]"}`}
              >
                Tất cả
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selectedCategory === category.id ? "bg-[#4A2C20] text-white" : "bg-[#F7F2EC] text-[#5E5650]"}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-96 items-center justify-center">
              <LoaderCircle className="animate-spin text-[#C9894B]" size={30} />
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="mt-5 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[#DED5CC] bg-white text-[#8A817B]">
              <Coffee size={32} />
              <p className="mt-3">Không tìm thấy món phù hợp.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((product) => {
                const imageUrl = getImageUrl(product.imageUrl);
                const startingPrice = Number(
                  product.variants[0]?.price ?? product.price,
                );
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => openProduct(product)}
                    className="overflow-hidden rounded-2xl border border-[#E9E1D8] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#D6B89C] hover:shadow-md"
                  >
                    <div
                      className="flex h-36 items-center justify-center bg-[#F3E9DE] bg-cover bg-center text-[#C9894B]"
                      style={
                        imageUrl
                          ? { backgroundImage: `url("${imageUrl}")` }
                          : undefined
                      }
                    >
                      {!imageUrl && <Coffee size={30} />}
                    </div>
                    <div className="p-4">
                      <p className="truncate font-bold text-[#2A211D]">
                        {product.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-[#78866B]">
                          {product.category.name}
                        </span>
                        <strong className="text-sm text-[#9A5C2F]">
                          {formatCurrency(startingPrice)}
                        </strong>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-[#E9E1D8] bg-white shadow-sm xl:sticky xl:top-20">
          <div className="flex items-center justify-between border-b border-[#F0E8E0] px-5 py-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={20} className="text-[#C9894B]" />
              <h2 className="font-bold text-[#2A211D]">Hóa đơn tại quầy</h2>
            </div>
            <span className="rounded-full bg-[#F3E9DE] px-2.5 py-1 text-xs font-bold text-[#9A5C2F]">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} món
            </span>
          </div>

          <div className="max-h-[340px] overflow-y-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cart.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center text-center text-[#9A918A]">
                <ShoppingBag size={30} />
                <p className="mt-3 text-sm">Chưa chọn món nào</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0E8E0]">
                {cart.map((item) => {
                  const imageUrl = getImageUrl(item.imageUrl);
                  return (
                    <div key={item.key} className="py-4">
                      <div className="flex gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] bg-cover bg-center text-[#C9894B]"
                          style={
                            imageUrl
                              ? { backgroundImage: `url("${imageUrl}")` }
                              : undefined
                          }
                        >
                          {!imageUrl && <Coffee size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2">
                            <p className="truncate text-sm font-bold text-[#2A211D]">
                              {item.productName}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setCart((current) =>
                                  current.filter(
                                    (cartItem) => cartItem.key !== item.key,
                                  ),
                                )
                              }
                              className="text-[#B4A89F] hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-[#78866B]">
                            Size {item.size}
                            {item.toppings.length
                              ? ` · ${item.toppings
                                  .map((topping) => topping.name)
                                  .join(", ")}`
                              : ""}
                          </p>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.key, -1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E9E1D8]"
                              >
                                <Minus size={14} />
                              </button>
                              <strong className="w-5 text-center text-sm">
                                {item.quantity}
                              </strong>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.key, 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4A2C20] text-white"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <strong className="text-sm text-[#4A2C20]">
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-[#F0E8E0] p-5">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                readOnly={customerMatch?.found === true}
                placeholder="Tên khách"
                className="h-11 rounded-xl border border-[#E9E1D8] px-3 text-sm outline-none focus:border-[#C9894B] read-only:bg-[#F7F2EC]"
              />
              <input
                value={customerPhone}
                onChange={(event) => {
                  const nextPhone = event.target.value.replace(/[^0-9+]/g, "");
                  if (customerMatch?.found) setCustomerName("");
                  setCustomerMatch(null);
                  setLoyaltyPointsToUse("");
                  setLookingUpCustomer(false);
                  setCustomerPhone(nextPhone);
                }}
                placeholder="Số điện thoại (tùy chọn)"
                className="h-11 rounded-xl border border-[#E9E1D8] px-3 text-sm outline-none focus:border-[#C9894B]"
              />
            </div>
            <div className="min-h-5 text-xs">
              {lookingUpCustomer ? (
                <span className="inline-flex items-center gap-1.5 text-[#78866B]">
                  <LoaderCircle size={13} className="animate-spin" /> Đang tìm
                  khách hàng...
                </span>
              ) : customerMatch?.found ? (
                <span className="font-medium text-emerald-700">
                  Khách cũ ·{" "}
                  {customerMatch.loyaltyPoints.toLocaleString("vi-VN")} điểm
                </span>
              ) : customerPhone.trim().length >= 8 && customerMatch ? (
                <span className="text-[#C2763D]">
                  Khách mới — nhập tên một lần để lưu hồ sơ tích điểm.
                </span>
              ) : (
                <span className="text-[#8A817B]">
                  Không bắt buộc SĐT; khách lẻ sẽ không được tích điểm.
                </span>
              )}
            </div>
            {customerMatch?.found && (
              <div className="rounded-xl border border-[#E9E1D8] bg-[#FCFAF7] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#4A2C20]">
                      Dùng điểm tích lũy
                    </p>
                    <p className="mt-0.5 text-xs text-[#78866B]">
                      Có {availableLoyaltyPoints.toLocaleString("vi-VN")} điểm ·
                      1.000 điểm giảm 1.000đ
                    </p>
                  </div>
                  {maximumLoyaltyPoints > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLoyaltyPointsToUse(String(maximumLoyaltyPoints))
                      }
                      className="shrink-0 text-xs font-semibold text-[#C2763D]"
                    >
                      Dùng tối đa
                    </button>
                  )}
                </div>
                <input
                  inputMode="numeric"
                  value={loyaltyPointsToUse}
                  disabled={maximumLoyaltyPoints === 0}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "");
                    const withoutLeadingZeros = digits.replace(/^0+(?=\d)/, "");
                    setLoyaltyPointsToUse(
                      withoutLeadingZeros === ""
                        ? ""
                        : String(
                            Math.min(
                              Number(withoutLeadingZeros),
                              maximumLoyaltyPoints,
                            ),
                          ),
                    );
                  }}
                  placeholder={
                    availableLoyaltyPoints < 1000
                      ? "Cần tối thiểu 1.000 điểm"
                      : "Nhập theo bội số 1.000"
                  }
                  className="mt-3 h-10 w-full rounded-lg border border-[#E9E1D8] bg-white px-3 text-sm outline-none focus:border-[#C9894B] disabled:cursor-not-allowed disabled:bg-[#F3EEE9]"
                />
                {loyaltyPointsInvalid && (
                  <p className="mt-1.5 text-xs text-red-500">
                    Số điểm sử dụng phải là bội số của 1.000.
                  </p>
                )}
              </div>
            )}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Ghi chú pha chế..."
              className="w-full resize-none rounded-xl border border-[#E9E1D8] px-3 py-2.5 text-sm outline-none focus:border-[#C9894B]"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${paymentMethod === "CASH" ? "border-[#C9894B] bg-[#FCF4EA] text-[#9A5C2F]" : "border-[#E9E1D8] text-[#5E5650]"}`}
              >
                <Banknote size={17} /> Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("BANK_TRANSFER")}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${paymentMethod === "BANK_TRANSFER" ? "border-[#C9894B] bg-[#FCF4EA] text-[#9A5C2F]" : "border-[#E9E1D8] text-[#5E5650]"}`}
              >
                <CreditCard size={17} /> Chuyển khoản
              </button>
            </div>

            {selectedLoyaltyPoints > 0 && (
              <div className="flex items-center justify-between border-t border-[#F0E8E0] pt-3 text-sm">
                <span className="text-[#78866B]">Giảm từ điểm</span>
                <strong className="text-emerald-700">
                  -{formatCurrency(selectedLoyaltyPoints)}
                </strong>
              </div>
            )}
            <div
              className={`flex items-center justify-between ${selectedLoyaltyPoints > 0 ? "" : "border-t border-[#F0E8E0] pt-4"}`}
            >
              <span className="font-semibold text-[#5E5650]">
                Tổng thanh toán
              </span>
              <strong className="text-xl text-[#4A2C20]">
                {formatCurrency(totalPrice)}
              </strong>
            </div>
            <button
              type="button"
              disabled={cart.length === 0 || submitting || loyaltyPointsInvalid}
              onClick={() => void submitOrder()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4A2C20] font-bold text-white transition hover:bg-[#5C382A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" size={19} />
              ) : (
                <Check size={19} />
              )}
              {submitting ? "Đang tạo hóa đơn..." : "Thanh toán & tạo đơn"}
            </button>
          </div>
        </aside>
      </div>

      {configuringProduct && selectedVariant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={() => setConfiguringProduct(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F0E8E0] bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#2A211D]">
                  {configuringProduct.name}
                </h2>
                <p className="mt-1 text-sm text-[#78866B]">
                  Chọn size và topping cho món
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfiguringProduct(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F2EC]"
              >
                <X size={19} />
              </button>
            </div>
            <div className="space-y-6 p-6">
              <section>
                <h3 className="font-bold text-[#2A211D]">Chọn size</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {configuringProduct.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`rounded-xl border p-3 text-left ${selectedVariantId === variant.id ? "border-[#C9894B] bg-[#FCF4EA]" : "border-[#E9E1D8]"}`}
                    >
                      <p className="font-bold">{variant.size}</p>
                      <p className="mt-1 text-sm text-[#78866B]">
                        {formatCurrency(Number(variant.price))}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              {configuringProduct.toppings.length > 0 && (
                <section>
                  <h3 className="font-bold text-[#2A211D]">Chọn topping</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {configuringProduct.toppings.map(({ topping }) => {
                      const active = selectedToppingIds.includes(topping.id);
                      const imageUrl = getImageUrl(topping.imageUrl);
                      return (
                        <button
                          key={topping.id}
                          type="button"
                          onClick={() =>
                            setSelectedToppingIds((current) =>
                              active
                                ? current.filter((id) => id !== topping.id)
                                : [...current, topping.id],
                            )
                          }
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left ${active ? "border-[#C9894B] bg-[#FCF4EA]" : "border-[#E9E1D8]"}`}
                        >
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#EEF2E8] bg-cover bg-center text-[#78866B]"
                            style={
                              imageUrl
                                ? { backgroundImage: `url("${imageUrl}")` }
                                : undefined
                            }
                          >
                            {!imageUrl && <Coffee size={17} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">
                              {topping.name}
                            </p>
                            <p className="mt-1 text-xs text-[#78866B]">
                              + {formatCurrency(Number(topping.price))}
                            </p>
                          </div>
                          {active && (
                            <Check size={18} className="text-[#C9894B]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-[#FAF8F5] p-4">
                <span className="font-semibold">Số lượng</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setConfigQuantity((value) => Math.max(1, value - 1))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E9E1D8] bg-white"
                  >
                    <Minus size={16} />
                  </button>
                  <strong>{configQuantity}</strong>
                  <button
                    type="button"
                    onClick={() =>
                      setConfigQuantity((value) => Math.min(99, value + 1))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4A2C20] text-white"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={addConfiguredItem}
                className="flex h-12 w-full items-center justify-between rounded-xl bg-[#4A2C20] px-5 font-bold text-white"
              >
                <span>Thêm vào hóa đơn</span>
                <span>
                  {formatCurrency(configuringUnitPrice * configQuantity)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {completedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
          <div
            id="pos-receipt"
            className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="pos-receipt-actions sticky top-0 z-10 flex items-center justify-between border-b border-[#F0E8E0] bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <ReceiptText size={20} className="text-[#C9894B]" />
                <h2 className="font-bold text-[#2A211D]">Hóa đơn đã tạo</h2>
              </div>
              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F2EC] text-[#5E5650]"
                aria-label="Đóng hóa đơn"
              >
                <X size={18} />
              </button>
            </div>

            <OrderReceiptContent
              id="pos-receipt-content"
              order={completedOrder}
            />

            <div className="pos-receipt-actions grid gap-2 border-t border-[#F0E8E0] bg-white p-5 sm:grid-cols-3">
              <button
                type="button"
                disabled={exportingPdf}
                onClick={() => void downloadReceiptPdf()}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E9E1D8] font-semibold text-[#5E5650] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingPdf ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <Download size={17} />
                )}
                {exportingPdf ? "Đang tạo PDF" : "Tải PDF"}
              </button>
              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#C9894B] bg-[#FCF4EA] font-semibold text-[#9A5C2F]"
              >
                <RotateCcw size={17} /> Đơn mới
              </button>
              <button
                type="button"
                onClick={() => router.push("/staff/orders")}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#4A2C20] font-semibold text-white"
              >
                <ExternalLink size={17} /> Xử lý đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
