"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Trophy, CalendarDays } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";
import { Badge } from "@topEleven-gamepress/ui/components/badge";

const STATUS_LABELS: Record<string, string> = {
  setup: "Khởi tạo",
  draw_in_progress: "Đang bốc thăm",
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

export default function PublicTournamentListPage() {
  const { data: tournaments } = useQuery(
    trpc.tournament.list.queryOptions({ onlyPublic: true, activeOnly: true })
  );

  return (
    <div className="cn-page max-w-4xl">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight">Giải Đấu</h1>
            <p className="text-muted-foreground">Các mùa giải đang diễn ra</p>
          </div>
        </div>
      </header>

      {!tournaments || tournaments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">Chưa có giải đấu công khai nào.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card className="cn-card-hover group cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-xl group-hover:text-primary transition-colors">
                      {t.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {new Date(t.startDate).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={STATUS_BADGE_VARIANTS[t.status] ?? "secondary"}
                    className="shrink-0"
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
