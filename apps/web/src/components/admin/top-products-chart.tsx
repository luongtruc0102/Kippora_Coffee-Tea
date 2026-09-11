"use client";

import { ImageIcon, PackageOpen, Trophy } from "lucide-react";

import type { TopProduct } from "@/types/dashboard";

type TopProductsChartProps = {
  data: TopProduct[];
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const rankStyles = [
  "bg-[#C9894B] text-white",
  "bg-[#E7D6C6] text-[#4A2C20]",
  "bg-[#E8EEDC] text-[#5F7955]",
  "bg-[#F3E9DE] text-[#7A665A]",
  "bg-[#F3E9DE] text-[#7A665A]",
];

// Ảnh cũ có thể là đường dẫn tương đối, còn ảnh mới thường là URL đầy đủ từ API.
function getImageUrl(imageUrl: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  return `${apiUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

export default function TopProductsChart({ data }: TopProductsChartProps) {
  const products = data.slice(0, 5);

  return (
    <div className="rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1F1B18]">
            Top 5 sản phẩm
          </h3>

          <p className="mt-1 text-sm text-[#78866B]">
            Xếp hạng theo số lượng đã bán
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#C9894B]">
          <Trophy size={20} />
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-[#DED5CC] text-center">
          <PackageOpen size={30} className="text-[#B4A89F]" />
          <p className="mt-3 text-sm font-medium text-[#5E5650]">
            Chưa có sản phẩm bán ra
          </p>
          <p className="mt-1 text-xs text-[#8A817B]">
            Danh sách sẽ xuất hiện khi có đơn hoàn thành.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product, index) => (
            <div
              key={product.productId}
              className="grid min-h-[70px] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#EEE5DC] bg-[#FFFDFC] px-4 py-3 transition hover:border-[#DCC7B3] hover:bg-[#FCF7F1]"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${rankStyles[index]}`}
              >
                {index + 1}
              </div>

              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3E9DE] bg-cover bg-center text-[#C9894B]"
                style={
                  getImageUrl(product.imageUrl)
                    ? {
                        backgroundImage: `url("${getImageUrl(product.imageUrl)}")`,
                      }
                    : undefined
                }
              >
                {!getImageUrl(product.imageUrl) && <ImageIcon size={20} />}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1F1B18]">
                  {product.productName}
                </p>
                <p className="mt-1 text-xs text-[#8A817B]">
                  Đã bán {product.quantitySold} sản phẩm
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-[#4A2C20]">
                  {currencyFormatter.format(product.revenue)}
                </p>
                <p className="mt-1 text-xs text-[#8A817B]">Doanh thu</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-[#F0E8E0] pt-4 text-xs text-[#8A817B]">
        Chỉ tính sản phẩm thuộc các đơn đã hoàn thành.
      </div>
    </div>
  );
}
