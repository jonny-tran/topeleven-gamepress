import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, CheckCircle2, Mail, Shield, Trophy, User } from "lucide-react";

import SignOutButton from "@/components/sign-out-button";
import { authClient } from "@/lib/auth-client";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";

export default async function DashboardPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionAny = session as any;
  if (!sessionAny?.user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { user } = sessionAny as { user: { name?: string; email: string; emailVerified: boolean; createdAt?: Date; id: string } };

  // Format the creation date
  const createdAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  // Get user initials for avatar
  const initials = (user.name || user.email || "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8 dark:from-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bảng Điều Khiển</h1>
            <p className="text-muted-foreground">Chào mừng trở lại trang quản trị</p>
          </div>
          <SignOutButton />
        </div>

        {/* Profile Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-xl font-bold text-primary-foreground">
                {initials}
              </div>
              <div>
                <CardTitle className="text-2xl">{user.name || "Người Dùng"}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Tài Khoản Quản Trị
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Email */}
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="truncate font-medium">{user.email}</p>
                </div>
              </div>

              {/* Account Status */}
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Trạng thái</p>
                  <p className="font-medium">
                    {user.emailVerified ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" /> Đã xác minh
                      </span>
                    ) : (
                      <span className="text-yellow-600">Chờ xác minh</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Member Since */}
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tham Gia Từ</p>
                  <p className="font-medium">{createdAt}</p>
                </div>
              </div>

              {/* User ID */}
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="truncate font-mono text-xs">{user.id}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Thao Tác Nhanh</CardTitle>
            <CardDescription>Các tác vụ quản trị thường dùng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/admin/tournaments">
                <Button variant="outline" className="h-20 w-full flex-col gap-2 text-sm">
                  <Trophy className="h-5 w-5" />
                  Quản Lý Giải Đấu
                </Button>
              </Link>
              <Link href="/admin/tournaments/new">
                <Button variant="outline" className="h-20 w-full flex-col gap-2 text-sm">
                  <User className="h-5 w-5" />
                  Tạo Giải Đấu Mới
                </Button>
              </Link>
              <Link href="/tournaments">
                <Button variant="outline" className="h-20 w-full flex-col gap-2 text-sm">
                  <Mail className="h-5 w-5" />
                  Xem Giải Đấu Công Khai
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
