"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";
import { trpc, getErrorMessage } from "@/utils/trpc";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";
import { Input } from "@topEleven-gamepress/ui/components/input";

interface Props {
  params: Promise<{ id: string }>;
}

export default function SchedulePage({ params }: Props) {
  const { id: tournamentId } = use(params);
  const queryClient = useQueryClient();

  const { data: tournament } = useQuery(
    trpc.tournament.getById.queryOptions({ id: tournamentId })
  );
  const { data: matches } = useQuery(
    trpc.match.listByTournament.queryOptions({
      tournamentId,
      stage: "group",
    })
  );

  const updateDate = useMutation(
    trpc.match.updateDate.mutationOptions({
      onSuccess: () => {
        toast.success("Ngày thi đấu đã cập nhật");
        queryClient.invalidateQueries(trpc.match.listByTournament.queryOptions({ tournamentId }));
      },
      onError: (e: unknown) => toast.error(getErrorMessage(e)),
    })
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  const startEdit = (match: { id: string; matchDate: string; matchTime: string | null }) => {
    setEditingId(match.id);
    const d = new Date(match.matchDate);
    setEditDate(d.toISOString().split("T")[0]);
    setEditTime(match.matchTime ?? "");
  };

  const saveEdit = (matchId: string) => {
    if (!editDate) return;
    updateDate.mutate({
      matchId,
      matchDate: new Date(editDate).toISOString(),
      matchTime: editTime || undefined,
    });
    setEditingId(null);
  };

  if (!tournament) return <div className="p-8">Đang tải...</div>;

  // Group matches by round
  const rounds: Record<number, typeof matches> = {};
  for (const m of matches ?? []) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round]!.push(m);
  }

  const roundNames: Record<number, string> = {
    1: "Vòng 1 (Lượt đi)",
    2: "Vòng 2 (Lượt đi)",
    3: "Vòng 3 (Lượt đi)",
    4: "Vòng 1 (Lượt về)",
    5: "Vòng 2 (Lượt về)",
    6: "Vòng 3 (Lượt về)",
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/admin/tournaments/${tournamentId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay Lại Giải Đấu
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Lịch Thi Đấu</h1>
        <p className="text-muted-foreground">Nhấn vào trận đấu để thay đổi ngày và giờ thi đấu.</p>
      </div>

      <div className="space-y-6">
        {[1, 2, 3, 4, 5, 6].map((round) => {
          const roundMatches = rounds[round] ?? [];
          if (roundMatches.length === 0) return null;

          return (
            <Card key={round}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  {roundNames[round] ?? `Vòng ${round}`}
                </CardTitle>
                <CardDescription>{roundMatches.length} trận</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {roundMatches.map((m) => {
                    const isEditing = editingId === m.id;
                    const matchDate = new Date(m.matchDate);

                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                          isEditing ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {m.group && (
                            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                              Bảng {m.group.code}
                            </span>
                          )}
                          <span className="text-sm font-medium">
                            {m.homeTeam?.name} vs {m.awayTeam?.name}
                          </span>
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30">
                            Lượt {m.leg}
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="h-8 w-40"
                            />
                            <Input
                              type="time"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="h-8 w-28"
                            />
                            <Button size="sm" onClick={() => saveEdit(m.id)}>
                              Lưu
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              Hủy
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-sm text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(m)}
                          >
                            {matchDate.toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "short",
                            })}
                            {m.matchTime && ` · ${m.matchTime}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
