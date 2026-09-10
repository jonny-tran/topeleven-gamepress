"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Edit } from "lucide-react";
import { toast } from "sonner";
import { trpc, getErrorMessage } from "@/utils/trpc";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";
import { Input } from "@topEleven-gamepress/ui/components/input";
import { Label } from "@topEleven-gamepress/ui/components/label";

interface Props {
  params: Promise<{ id: string }>;
}

export default function MatchResultsPage({ params }: Props) {
  const { id: tournamentId } = use(params);
  const queryClient = useQueryClient();

  const { data: matches } = useQuery(
    trpc.match.listByTournament.queryOptions({ tournamentId, stage: "group" })
  );

  const updateResult = useMutation(
    trpc.match.updateResult.mutationOptions({
      onSuccess: () => {
        toast.success("Kết quả đã lưu!");
        queryClient.invalidateQueries(trpc.match.listByTournament.queryOptions({ tournamentId }));
        setEditingId(null);
      },
      onError: (e: unknown) => toast.error(getErrorMessage(e)),
    })
  );

  const updateStatus = useMutation(
    trpc.match.updateStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Trạng thái trận đấu đã cập nhật.");
        queryClient.invalidateQueries(trpc.match.listByTournament.queryOptions({ tournamentId }));
      },
      onError: (e: unknown) => toast.error(getErrorMessage(e)),
    })
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    homeScore: 0,
    awayScore: 0,
    homeYellowCards: 0,
    homeRedCards2Y: 0,
    homeRedCardsDirect: 0,
    awayYellowCards: 0,
    awayRedCards2Y: 0,
    awayRedCardsDirect: 0,
  });

  const startEdit = (match: { id: string; result?: { homeScore: number | null; awayScore: number | null; homeYellowCards: number | null; homeRedCards2Y: number | null; homeRedCardsDirect: number | null; awayYellowCards: number | null; awayRedCards2Y: number | null; awayRedCardsDirect: number | null } | null }) => {
    setEditingId(match.id);
    setForm({
      homeScore: match.result?.homeScore ?? 0,
      awayScore: match.result?.awayScore ?? 0,
      homeYellowCards: match.result?.homeYellowCards ?? 0,
      homeRedCards2Y: match.result?.homeRedCards2Y ?? 0,
      homeRedCardsDirect: match.result?.homeRedCardsDirect ?? 0,
      awayYellowCards: match.result?.awayYellowCards ?? 0,
      awayRedCards2Y: match.result?.awayRedCards2Y ?? 0,
      awayRedCardsDirect: match.result?.awayRedCardsDirect ?? 0,
    });
  };

  const save = (matchId: string) => {
    updateResult.mutate({ matchId, ...form });
  };

  // Group by round
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
        <h1 className="text-3xl font-bold tracking-tight">Kết Quả Trận Đấu</h1>
        <p className="text-muted-foreground">Nhập tỷ số và số thẻ phạt cho từng trận đấu.</p>
      </div>

      <div className="space-y-6">
        {[1, 2, 3, 4, 5, 6].map((round) => {
          const roundMatches = rounds[round] ?? [];
          if (roundMatches.length === 0) return null;

          return (
            <Card key={round}>
              <CardHeader>
                <CardTitle className="text-base">{roundNames[round] ?? `Vòng ${round}`}</CardTitle>
                <CardDescription>{roundMatches.length} trận</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {roundMatches.map((m) => {
                  const isEditing = editingId === m.id;
                  const isCompleted = m.status === "completed";
                  const matchDate = new Date(m.matchDate);

                  return (
                    <div key={m.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {m.group && (
                            <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                              Bảng {m.group.code}
                            </span>
                          )}
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30">
                            Lượt {m.leg}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {matchDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                        {isCompleted ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">Hoàn thành</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(m)}
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            {isEditing ? "Hủy" : "Nhập Kết Quả"}
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1 text-right">
                          <p className="font-medium">{m.homeTeam?.name}</p>
                          {m.result && (
                            <p className="text-xs text-muted-foreground">
                              {(m.result.homeYellowCards ?? 0) > 0 && `${m.result.homeYellowCards}V `}
                              {(m.result.homeRedCards2Y ?? 0) > 0 && `${m.result.homeRedCards2Y}Đ2 `}
                              {(m.result.homeRedCardsDirect ?? 0) > 0 && `${m.result.homeRedCardsDirect}ĐĐ `}
                            </p>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={form.homeScore}
                              onChange={(e) => setForm((f) => ({ ...f, homeScore: Number(e.target.value) }))}
                              className="h-8 w-16 text-center"
                            />
                            <span className="text-lg font-bold">–</span>
                            <Input
                              type="number"
                              min="0"
                              value={form.awayScore}
                              onChange={(e) => setForm((f) => ({ ...f, awayScore: Number(e.target.value) }))}
                              className="h-8 w-16 text-center"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold">
                              {m.result?.homeScore ?? "–"}
                            </span>
                            <span className="text-2xl text-muted-foreground">–</span>
                            <span className="text-2xl font-bold">
                              {m.result?.awayScore ?? "–"}
                            </span>
                          </div>
                        )}

                        <div className="flex-1">
                          <p className="font-medium">{m.awayTeam?.name}</p>
                          {m.result && (
                            <p className="text-xs text-muted-foreground">
                              {(m.result.awayYellowCards ?? 0) > 0 && `${m.result.awayYellowCards}V `}
                              {(m.result.awayRedCards2Y ?? 0) > 0 && `${m.result.awayRedCards2Y}Đ2 `}
                              {(m.result.awayRedCardsDirect ?? 0) > 0 && `${m.result.awayRedCardsDirect}ĐĐ `}
                            </p>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-4 grid grid-cols-4 gap-4">
                          {(["home", "away"] as const).map((side) => (
                            <div key={side} className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Thẻ {side === "home" ? m.homeTeam?.name : m.awayTeam?.name}
                              </p>
                              <div className="flex gap-1">
                                <div>
                                  <Label className="text-xs">Vàng</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={form[`${side}YellowCards` as keyof typeof form] as number}
                                    onChange={(e) =>
                                      setForm((f) => ({ ...f, [`${side}YellowCards`]: Number(e.target.value) }))
                                    }
                                    className="h-7 w-14"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Đỏ 2V</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={form[`${side}RedCards2Y` as keyof typeof form] as number}
                                    onChange={(e) =>
                                      setForm((f) => ({ ...f, [`${side}RedCards2Y`]: Number(e.target.value) }))
                                    }
                                    className="h-7 w-14"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Đỏ Đ</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={form[`${side}RedCardsDirect` as keyof typeof form] as number}
                                    onChange={(e) =>
                                      setForm((f) => ({ ...f, [`${side}RedCardsDirect`]: Number(e.target.value) }))
                                    }
                                    className="h-7 w-14"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="col-span-4 flex justify-end gap-2">
                            <Button
                              onClick={() => save(m.id)}
                              disabled={updateResult.isPending}
                              size="sm"
                            >
                              Lưu Kết Quả
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
