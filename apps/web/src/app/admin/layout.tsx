'use client';

import {
  useEffect,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import AdminHeader from '@/components/admin/admin-header';
import AdminSidebar from '@/components/admin/admin-sidebar';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const accessToken =
        sessionStorage.getItem(
          'accessToken',
        );

      const storedUser =
        sessionStorage.getItem(
          'user',
        );

      if (
        !accessToken ||
        !storedUser
      ) {
        router.replace(
          '/login',
        );

        return;
      }

      try {
        const user =
          JSON.parse(storedUser);

        // Frontend chỉ chặn UI, backend vẫn là nơi kiểm tra quyền thật
        if (
          user.role !==
          'ADMIN'
        ) {
          sessionStorage.removeItem(
            'accessToken',
          );

          sessionStorage.removeItem(
            'user',
          );

          router.replace(
            '/login',
          );

          return;
        }

        setAuthorized(true);
      } catch {
        sessionStorage.removeItem(
          'accessToken',
        );

        sessionStorage.removeItem(
          'user',
        );

        router.replace(
          '/login',
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
        <p className="text-sm text-[#78866B]">
          Đang kiểm tra đăng nhập...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      <div className="min-h-screen lg:pl-64">
        <AdminHeader
          onOpenSidebar={() =>
            setSidebarOpen(true)
          }
        />

        <main className="px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}