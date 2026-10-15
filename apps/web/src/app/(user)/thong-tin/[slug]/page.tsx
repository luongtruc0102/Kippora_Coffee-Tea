"use client";

import { ArrowLeft, Clock3, FileText, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getPublicContentPage } from "@/services/content-page.service";
import type { ContentPage } from "@/types/content-page";

function ContentBody({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      {content.split(/\r?\n/).map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={index} className="h-2" />;
        if (line.startsWith("## ")) {
          return (
            <h2
              key={index}
              className="pt-3 text-xl font-bold text-[#2A211D] sm:text-2xl"
            >
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div key={index} className="flex gap-3 pl-1 text-[#5E5650]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9894B]" />
              <p className="leading-7">{line.slice(2)}</p>
            </div>
          );
        }
        return (
          <p key={index} className="leading-7 text-[#5E5650]">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function PublicContentPage() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void getPublicContentPage(params.slug, controller.signal)
      .then((data) => {
        setPage(data);
        setError("");
      })
      .catch((requestError) => {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Không thể tải nội dung",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center text-[#78866B]">
        <LoaderCircle className="mr-2 animate-spin" size={22} />
        Đang tải nội dung...
      </div>
    );
  }

  if (!page || error) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <FileText size={42} className="text-[#C9894B]" />
        <h1 className="mt-4 text-2xl font-bold text-[#2A211D]">
          Trang chưa sẵn sàng
        </h1>
        <p className="mt-2 text-[#78866B]">{error}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#4A2C20] px-5 py-3 text-sm font-semibold text-white"
        >
          <ArrowLeft size={17} /> Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F5] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#E9E1D8] bg-white shadow-sm">
        <div className="border-b border-[#E9E1D8] bg-gradient-to-br from-[#FFF8F0] to-white px-6 py-9 sm:px-10 sm:py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#9A6032] hover:text-[#4A2C20]"
          >
            <ArrowLeft size={16} /> Trang chủ
          </Link>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#1F1B18] sm:text-4xl">
            {page.title}
          </h1>
          {page.summary && (
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#78866B] sm:text-lg">
              {page.summary}
            </p>
          )}
          <p className="mt-5 flex items-center gap-2 text-xs text-[#A0968F]">
            <Clock3 size={14} /> Cập nhật{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(new Date(page.updatedAt))}
          </p>
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <ContentBody content={page.content} />
        </div>
      </article>
    </div>
  );
}
