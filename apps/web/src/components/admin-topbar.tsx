"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

import { authClient } from "@/lib/auth-client";
import { Button } from "@topEleven-gamepress/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@topEleven-gamepress/ui/components/dropdown-menu";
import { useSidebar } from "@/components/sidebar-context";
import { useViewer } from "@/hooks/use-viewer";

/**
 * Top bar slim cho khu vực quản lý — thay thế sidebar cũ.
 *
 * Cấu trúc: [logo] ............ [user]
 *
 * Khi trang con (Bốc Thăm) bật fullscreen, top bar cũng ẩn để người dùng tập
 * trung vào sân khấu bốc thăm — tận dụng lại `hidden` state của sidebar
 * context cũ.
 *
 * Nhãn vai trò đọc từ `useViewer()`: admin toàn cục thì hiện "Quản trị viên",
 * tài khoản thường thì hiện "Ban tổ chức" (vì họ quản lý giải của riêng mình).
 */
export default function AdminTopbar({ userName }: { userName?: string }) {
  const router = useRouter();
  const { hidden } = useSidebar();
  const { isAdmin } = useViewer();

  if (hidden) return null;

  const roleLabel = isAdmin ? "Quản trị viên" : "Ban tổ chức";

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
        },
      },
    });
  };

  const initials = (userName ?? "U")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6",
        "supports-[backdrop-filter]:bg-background/70"
      )}
    >
      {/* Logo */}
      <Link
        href="/admin/tournaments"
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20">
          <Trophy className="h-4 w-4" />
        </div>
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="font-display text-sm font-extrabold tracking-tight">
            topEleven
          </span>
          <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {isAdmin ? "Admin" : "Ban tổ chức"}
          </span>
        </div>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      {userName && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 px-2 hover:bg-muted"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 font-display text-xs font-bold text-primary ring-1 ring-primary/30">
                  {initials}
                </div>
                <span className="hidden text-sm font-medium sm:inline">
                  {userName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium">{userName}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {roleLabel}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/")}
              className="text-xs"
            >
              <Trophy className="mr-2 h-3.5 w-3.5" />
              Về trang chủ
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-xs text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
