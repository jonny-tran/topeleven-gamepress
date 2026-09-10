"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { toast } from "sonner";
import { trpc, getErrorMessage } from "@/utils/trpc";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";

interface Props {
  params: Promise<{ id: string }>;
}

function BracketMatch({
  slot,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  pendingDraw,
  matchId,
  onAdvance,
}: {
  slot: string;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  pendingDraw: boolean;
  matchId: string | null;
  onAdvance: (matchId: string) => void;
}) {
  const isReady = homeTeam && awayTeam;
  return (
    <div className={`rounded-lg border p-3 ${!isReady ? "opacity-50" : ""}`}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{slot}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className={homeScore !== null && homeScore > (awayScore ?? 0) ? "font-bold" : ""}>
            {homeTeam?.name ?? "—"}
          </span>
          <span className="font-mono font-bold">{homeScore ?? "–"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={awayScore !== null && awayScore > (homeScore ?? 0) ? "font-bold" : ""}>
            {awayTeam?.name ?? "—"}
          </span>
          <span className="font-mono font-bold">{awayScore ?? "–"}</span>
        </div>
      </div>
      {isReady && !pendingDraw && homeScore !== null && awayScore !== null && matchId && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => onAdvance(matchId)}
        >
          Xác Nhận Đội Thắng
        </Button>
      )}
      {pendingDraw && matchId && (
        <p className="mt-2 text-xs text-yellow-600">Chờ: hòa, admin quyết định</p>
      )}
    </div>
  );
}

export default function KnockoutPage({ params }: Props) {
  const { id: tournamentId } = use(params);
  const queryClient = useQueryClient();

  const { data: tournament } = useQuery(
    trpc.tournament.getById.queryOptions({ id: tournamentId })
  );
  const { data: bracket } = useQuery(
    trpc.knockout.getBracket.queryOptions({ tournamentId })
  );

  const generateBracket = useMutation(
    trpc.knockout.generateBracket.mutationOptions({
      onSuccess: (result: { success: boolean; matchesCreated?: number }) => {
        toast.success(`Đã tạo ${result.matchesCreated ?? 0} cặp đấu knockout thành công!`);
        queryClient.invalidateQueries(trpc.knockout.getBracket.queryOptions({ tournamentId }));
      },
      onError: (e: unknown) => toast.error(getErrorMessage(e)),
    })
  );

  const advanceWinner = useMutation(
    trpc.knockout.advanceWinner.mutationOptions({
      onSuccess: (result: { success: boolean; winnerId?: string; pendingDraw?: boolean; message?: string }) => {
        if (!result.success && result.pendingDraw) {
          toast.warning(result.message ?? "Hòa! Admin phải chọn đội thắng.");
        } else if (!result.success) {
          toast.error(result.message ?? "Không thể xác nhận đội thắng.");
        } else {
          toast.success("Đội thắng đã được xác nhận!");
        }
        queryClient.invalidateQueries(trpc.knockout.getBracket.queryOptions({ tournamentId }));
      },
      onError: (e: unknown) => toast.error(getErrorMessage(e)),
    })
  );

  const [manualWinner, setManualWinner] = useState<{
    matchId: string;
    homeId: string;
    awayId: string;
  } | null>(null);

  if (!tournament) return <div className="p-8">Đang tải...</div>;

  const status = tournament.status;

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
        <h1 className="text-3xl font-bold tracking-tight">Vòng Loại Trực Tiếp</h1>
        <p className="text-muted-foreground">
          Thể thức 2 lượt: V16 &rarr; Tứ kết &rarr; Bán kết &rarr; Chung kết
        </p>
      </div>

      {status !== "knockout" && status !== "completed" && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="font-medium">Cặp đấu loại trực tiếp chưa được tạo.</p>
              <p className="text-sm text-muted-foreground">
                Tất cả các trận vòng bảng phải hoàn thành trước.
              </p>
            </div>
            <Button
              onClick={() => generateBracket.mutate({ tournamentId })}
              disabled={generateBracket.isPending}
            >
              <Trophy className="mr-2 h-4 w-4" />
              {generateBracket.isPending ? "Đang tạo..." : "Tạo Cặp Đấu"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {/* Vòng 16 đội */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">VÒNG 16 ĐỘI</h3>
          <div className="space-y-2">
            {["R16_1", "R16_2", "R16_3", "R16_4", "R16_5", "R16_6", "R16_7", "R16_8"].map((slot) => {
              const m = bracket?.[slot];
              return (
                <BracketMatch
                  key={slot}
                  slot={slot}
                  homeTeam={m?.homeTeam ?? null}
                  awayTeam={m?.awayTeam ?? null}
                  homeScore={m?.homeScore ?? null}
                  awayScore={m?.awayScore ?? null}
                  pendingDraw={m?.pendingDraw ?? false}
                  matchId={m?.matchId ?? null}
                  onAdvance={(matchId) => advanceWinner.mutate({ matchId })}
                />
              );
            })}
          </div>
        </div>

        {/* Tứ kết */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">TỨ KẾT</h3>
          <div className="space-y-2">
            {["QF_A1", "QF_A2", "QF_B1", "QF_B2"].map((slot) => {
              const m = bracket?.[slot];
              return (
                <BracketMatch
                  key={slot}
                  slot={slot}
                  homeTeam={m?.homeTeam ?? null}
                  awayTeam={m?.awayTeam ?? null}
                  homeScore={m?.homeScore ?? null}
                  awayScore={m?.awayScore ?? null}
                  pendingDraw={m?.pendingDraw ?? false}
                  matchId={m?.matchId ?? null}
                  onAdvance={(matchId) => advanceWinner.mutate({ matchId })}
                />
              );
            })}
          </div>
        </div>

        {/* Bán kết */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">BÁN KẾT</h3>
          <div className="space-y-2">
            {["SF_1", "SF_2"].map((slot) => {
              const m = bracket?.[slot];
              return (
                <BracketMatch
                  key={slot}
                  slot={slot}
                  homeTeam={m?.homeTeam ?? null}
                  awayTeam={m?.awayTeam ?? null}
                  homeScore={m?.homeScore ?? null}
                  awayScore={m?.awayScore ?? null}
                  pendingDraw={m?.pendingDraw ?? false}
                  matchId={m?.matchId ?? null}
                  onAdvance={(matchId) => advanceWinner.mutate({ matchId })}
                />
              );
            })}
          </div>
        </div>

        {/* Chung kết + Hạng 3 */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">CHUNG KẾT & HẠNG 3</h3>
          <div className="space-y-2">
            <div className="rounded-lg border border-primary bg-primary/5 p-3">
              <p className="mb-2 text-xs font-bold text-primary">CHUNG KẾT</p>
              {bracket?.["FINAL"]?.homeTeam && bracket?.["FINAL"]?.awayTeam ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{bracket["FINAL"].homeTeam!.name}</span>
                    <span className="font-mono font-bold">{bracket["FINAL"].homeScore ?? "–"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{bracket["FINAL"].awayTeam!.name}</span>
                    <span className="font-mono font-bold">{bracket["FINAL"].awayScore ?? "–"}</span>
                  </div>
                  {bracket["FINAL"].winner && (
                    <p className="mt-2 text-center text-xs font-medium text-green-600">
                      <Trophy className="mr-1 inline h-3 w-3" />
                      {bracket["FINAL"].winner!.name}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Đang chờ đội thắng bán kết...</p>
              )}
            </div>
            <div className="rounded-lg border p-3 opacity-70">
              <p className="mb-2 text-xs font-bold text-muted-foreground">HẠNG 3</p>
              <p className="text-xs text-muted-foreground">—</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual winner picker for pending draws */}
      {manualWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Giải Quyết Hòa</CardTitle>
              <CardDescription>Hai lượt hòa nhau. Chọn đội thắng.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => {
                  advanceWinner.mutate({ matchId: manualWinner.matchId, winnerTeamId: manualWinner.homeId });
                  setManualWinner(null);
                }}
              >
                Đội nhà thắng
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => {
                  advanceWinner.mutate({ matchId: manualWinner.matchId, winnerTeamId: manualWinner.awayId });
                  setManualWinner(null);
                }}
              >
                Đội khách thắng
              </Button>
              <Button variant="ghost" onClick={() => setManualWinner(null)} className="w-full">
                Hủy
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
