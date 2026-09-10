import { headers } from "next/headers";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent } from "@topEleven-gamepress/ui/components/card";

/**
 * Root page — server component.
 * - Đã sign-in → redirect thẳng vào /admin/tournaments
 * - Chưa sign-in → public landing page
 */
export default async function HomePage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session as any)?.user) {
    redirect("/admin/tournaments");
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* ── Public header ── */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">topEleven</span>
        </div>
        <Link href="/login">
          <Button variant="outline">Đăng Nhập</Button>
        </Link>
      </header>

      {/* ── Landing content ── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Hero */}
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Hệ thống quản lý giải đấu
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Tạo và quản lý giải đấu bóng đá theo thể thức vòng bảng — knockout.
              Theo dõi bảng xếp hạng, kết quả, và lịch thi đấu theo thời gian thực.
            </p>
          </div>

          {/* Quick info cards */}
          <div className="grid gap-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Xem giải đấu công khai</p>
                  <p className="text-xs text-muted-foreground">
                    Duyệt danh sách, bảng xếp hạng và kết quả
                  </p>
                </div>
                <Link href="/tournaments" className="ml-auto shrink-0">
                  <Button variant="ghost" size="sm">Xem ngay</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <p className="text-sm text-muted-foreground">
            Bạn là quản trị viên?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Đăng nhập
            </Link>{" "}
            để quản lý giải đấu.
          </p>
        </div>
      </main>
    </div>
  );
}
