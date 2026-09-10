"use client";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, CalendarDays, Globe, Users, Shuffle, ClipboardList, Group } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Badge } from "@topEleven-gamepress/ui/components/badge";

const STATUS_LABELS: Record<string, string> = {
  setup: "Khởi tạo",
  draw_in_progress: "�ang bốc thăm",
  draw_completed: "Bốc thăm xong",
  group_stage: "Vòng bảng",
  knockout: "Loại trực tiếp",
  completed: "Hoàn thành",
};

const STATUS_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  setup: "secondary",
  draw_in_progress: "warning",
  draw_completed: "default",
  group_stage: "success",
  knockout: "default",
  completed: "outline",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default function PublicTournamentPage({ params }: Props) {
  const { id: tournamentId } = use(params);

  const { data: tournament } = useQuery(
    trpc.tournament.getById.queryOptions({ id: tournamentId })
  );

  if (!tournament) {
    return (
      <div className="cn-page max-w-5xl">
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      </div>
    );
  }

  // Sau khi admin xác nhận bốc thăm (status = draw_completed) trở đi thì
  // mới mở khoá các nội dung vòng bảng cho người dùng công khai xem.
  const isReadyForView =
    tournament.status === "draw_completed" ||
    tournament.status === "group_stage" ||
    tournament.status === "knockout" ||
    tournament.status === "completed";

  return (
    <div className="cn-page max-w-5xl">
      {/* Header */}
      <header className="mb-8">
        <Link
          href="/tournaments"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tất Cả Giải Đấu
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight">{tournament.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(tournament.startDate).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  {tournament.groups?.length ?? 0} bảng đấu
                </span>
              </div>
            </div>
          </div>
          <Badge
            variant={STATUS_BADGE_VARIANTS[tournament.status] ?? "secondary"}
            className="text-sm"
          >
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </Badge>
        </div>
      </header>

      {!isReadyForView && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Đang chờ admin xác nhận bốc thăm.</strong> Lịch thi đấu, kết
          quả và bảng xếp hạng sẽ được công bố sau khi ban tổ chức xác nhận.
        </div>
      )}

      {/* Nav cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={(isReadyForView ? `/tournaments/${tournamentId}/groups` : "#") as never}
          aria-disabled={!isReadyForView}
          tabIndex={isReadyForView ? 0 : -1}
        >
          <Card
            className={
              isReadyForView
                ? "cn-card-hover cursor-pointer"
                : "cursor-not-allowed opacity-50"
            }
          >
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Group className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Bảng Đấu</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {isReadyForView
                  ? "Xem bảng xếp hạng và lịch thi đấu vòng bảng"
                  : "Chờ admin xác nhận bốc thăm"}
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={(isReadyForView ? `/tournaments/${tournamentId}/schedule` : "#") as never}
          aria-disabled={!isReadyForView}
          tabIndex={isReadyForView ? 0 : -1}
        >
          <Card
            className={
              isReadyForView
                ? "cn-card-hover cursor-pointer"
                : "cursor-not-allowed opacity-50"
            }
          >
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Lịch Thi Đấu</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {isReadyForView
                  ? "Ngày và giờ thi đấu từng trận"
                  : "Chờ admin xác nhận bốc thăm"}
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={(isReadyForView ? `/tournaments/${tournamentId}/standings` : "#") as never}
          aria-disabled={!isReadyForView}
          tabIndex={isReadyForView ? 0 : -1}
        >
          <Card
            className={
              isReadyForView
                ? "cn-card-hover cursor-pointer"
                : "cursor-not-allowed opacity-50"
            }
          >
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Xếp Hạng</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {isReadyForView
                  ? "Bảng xếp hạng và luật tie-break"
                  : "Chờ admin xác nhận bốc thăm"}
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={(isReadyForView ? `/tournaments/${tournamentId}/knockout` : "#") as never}
          aria-disabled={!isReadyForView}
          tabIndex={isReadyForView ? 0 : -1}
        >
          <Card
            className={
              isReadyForView
                ? "cn-card-hover cursor-pointer"
                : "cursor-not-allowed opacity-50"
            }
          >
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Shuffle className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Loại Trực Tiếp</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {isReadyForView
                  ? "Cặp đấu knockout và kết quả"
                  : "Chờ admin xác nhận bốc thăm"}
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
