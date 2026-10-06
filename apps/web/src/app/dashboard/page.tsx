"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Mail,
  Shield,
  Trophy,
  User,
} from "lucide-react";

import SignOutButton from "@/components/sign-out-button";
import { Button } from "@topEleven-gamepress/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@topEleven-gamepress/ui/components/card";
import { Badge } from "@topEleven-gamepress/ui/components/badge";
import { Skeleton } from "@topEleven-gamepress/ui/components/skeleton";
import { trpc } from "@/utils/trpc";
import { useViewer } from "@/hooks/use-viewer";

const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị viên toàn cục",
  user: "Ban tổ chức",
};

const STATUS_LABEL: Record<string, string> = {
  setup: "Khởi tạo",
  draw_in_progress: "Đang bốc thăm",
  draw_completed: "Bốc thăm xong",
  group_stage: "Vòng bảng",
  knockout: "Loại trực tiếp",
  completed: "Hoàn thành",
};

export default function DashboardPage() {
  const router = useRouter();
  const { viewer, isAdmin, isLoggedIn, isLoading } = useViewer();

  // Chỉ "Giải của tôi" — không phụ thuộc quyền admin.
  const { data: myTournaments } = useQuery(
    trpc.tournament.list.queryOptions(
      {
        scope: "mine",
        includeArchived: true,
        includeDeleted: false,
      },
      // Chưa đăng nhập thì đừng gọi: server sẽ trả 401.
      { enabled: isLoggedIn }
    )
  );

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoading, isLoggedIn, router]);

  if (isLoading || !isLoggedIn || !viewer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8 dark:from-slate-900 dark:to-slate-800">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const initials = (viewer.name || viewer.email || "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const tournaments = myTournaments ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8 dark:from-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bảng Điều Khiển</h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Bạn có quyền quản trị toàn bộ giải đấu của hệ thống."
                : "Quản lý các giải đấu thuộc sở hữu của bạn."}
            </p>
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
                <CardTitle className="text-2xl">
                  {viewer.name || "Người Dùng"}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  {ROLE_LABEL[viewer.role] ?? viewer.role}
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
                  <p className="truncate font-medium">{viewer.email}</p>
                </div>
              </div>

              {/* Quyền */}
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Quyền</p>
                  <p className="font-medium">
                    {isAdmin ? (
                      <span className="text-green-600">
                        Quản trị mọi giải đấu
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Chỉ quản lý giải của mình
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* User ID */}
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="truncate font-mono text-xs">{viewer.id}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Giải của tôi */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Giải Đấu Của Tôi</CardTitle>
            <CardDescription>
              {tournaments.length === 0
                ? "Bạn chưa sở hữu giải đấu nào."
                : `Bạn đang phụ trách ${tournaments.length} giải đấu.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tournaments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Bấm <span className="font-medium">Tạo Giải Mới</span> để bắt đầu.
              </p>
            ) : (
              <ul className="divide-y">
                {tournaments.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/tournaments/${t.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {t.name}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Thao Tác Nhanh</CardTitle>
            <CardDescription>Các tác vụ thường dùng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/admin/tournaments">
                <Button variant="outline" className="h-20 w-full flex-col gap-2 text-sm">
                  <Trophy className="h-5 w-5" />
                  {isAdmin ? "Tất cả Giải Đấu" : "Giải Đấu Của Tôi"}
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