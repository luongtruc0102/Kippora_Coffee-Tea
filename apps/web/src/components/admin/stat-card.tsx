import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from 'lucide-react';

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  valueClassName?: string;
  trend?: {
    value: number | null;
    inverse?: boolean;
    unit?: '%' | ' điểm %';
  };
};

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
  valueClassName,
  trend,
}: StatCardProps) {
  const trendIsNeutral = trend?.value === 0;
  const trendIsPositive =
    trend?.value !== null && trend?.value !== undefined
      ? trend.inverse
        ? trend.value < 0
        : trend.value > 0
      : false;
  const TrendIcon =
    trend?.value === 0
      ? Minus
      : (trend?.value ?? 0) > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <div className="group rounded-2xl border border-[#E9E1D8] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#78866B]">
            {title}
          </p>

          <h3 className={`mt-2 text-2xl font-bold ${valueClassName ?? 'text-[#1F1B18]'}`}>
            {value}
          </h3>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3E9DE] text-[#4A2C20]">
          <Icon size={21} strokeWidth={1.8} />
        </div>
      </div>

      {description && (
        <p className="mt-3 text-sm text-[#8A817B]">
          {description}
        </p>
      )}

      {trend && (
        <div className="mt-2 min-h-5 text-xs font-semibold">
          {trend.value === null ? (
            <span className="text-[#9A9089]">Kỳ trước chưa có dữ liệu</span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 ${
                trendIsNeutral
                  ? 'text-[#8A817B]'
                  : trendIsPositive
                    ? 'text-emerald-700'
                    : 'text-red-600'
              }`}
            >
              <TrendIcon size={14} />
              {Math.abs(trend.value).toFixed(1)}{trend.unit ?? '%'} so với kỳ trước
            </span>
          )}
        </div>
      )}
    </div>
  );
}
