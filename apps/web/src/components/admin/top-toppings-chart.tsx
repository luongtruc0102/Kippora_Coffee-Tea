"use client";

import { Coffee, PackageOpen } from "lucide-react";

import type { TopTopping } from "@/types/dashboard";

type TopToppingsChartProps = {
  data: TopTopping[];
};

// Hỗ trợ cả URL tuyệt đối và đường dẫn ảnh tương đối từ backend.
function getImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  return `${apiUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

export default function TopToppingsChart({ data }: TopToppingsChartProps) {
  const toppings = data.slice(0, 5);

  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-[#1F1B18]">
          Topping phổ biến
        </h3>

        <p className="mt-1 text-sm text-[#78866B]">
          Top topping được khách lựa chọn nhiều nhất
        </p>
      </div>

      {toppings.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-[#DED5CC] text-center">
          <PackageOpen size={30} className="text-[#B4A89F]" />
          <p className="mt-3 text-sm font-medium text-[#5E5650]">
            Chưa có topping được sử dụng
          </p>
          <p className="mt-1 text-xs text-[#8A817B]">
            Danh sách sẽ xuất hiện khi có đơn hoàn thành.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {toppings.map((topping) => {
            const toppingImageUrl = getImageUrl(topping.imageUrl);

            return (
              <div
                key={topping.toppingId}
                className="grid min-h-[70px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#EEE5DC] bg-[#FFFDFC] px-4 py-3 transition hover:border-[#DCC7B3] hover:bg-[#FCF7F1]"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#EEF2E8] bg-cover bg-center text-[#78866B]"
                  style={
                    toppingImageUrl
                      ? { backgroundImage: `url("${toppingImageUrl}")` }
                      : undefined
                  }
                >
                  {!toppingImageUrl && <Coffee size={20} />}
                </div>

                <p className="truncate text-sm font-semibold text-[#1F1B18]">
                  {topping.toppingName}
                </p>

                <div className="rounded-full bg-[#EEF2E8] px-3 py-1.5 text-sm font-semibold text-[#5F7955]">
                  {topping.selectedCount} lần dùng
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 border-t border-[#F0E8E0] pt-4 text-xs text-[#8A817B]">
        Chỉ tính topping thuộc các đơn đã hoàn thành.
      </div>
    </div>
  );
}
