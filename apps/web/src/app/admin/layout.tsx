import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import AdminTopbar from "@/components/admin-topbar";
import { SidebarProvider } from "@/components/sidebar-context";

/**
 * Admin layout — server component.
 *
 * Cấu trúc mới (draw-first):
 *  - Top bar slim ở trên cùng (AdminTopbar) chỉ có logo + user menu.
 *  - Phần thân trang chiếm phần lớn viewport.
 *  - SidebarProvider vẫn được wrap để trang Bốc Thăm dùng cho chế độ
 *    fullscreen (ẩn top bar khi cần).
 *
 * - Kiểm tra session phía server; không có session → redirect /login.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session as any)?.user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userName = (session as any).user?.name as string | undefined;

  return (
    <SidebarProvider>
      <div className="flex h-svh flex-col overflow-hidden bg-background">
        <AdminTopbar userName={userName} />
        <main className="flex flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
