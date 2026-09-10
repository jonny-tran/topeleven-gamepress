"use client";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PublicKnockoutPage({ params }: Props) {
  const { id: tournamentId } = use(params);

  const { data: tournament } = useQuery(
    trpc.tournament.getById.queryOptions({ id: tournamentId })
  );
  const { data: bracket } = useQuery(
    trpc.knockout.getBracket.queryOptions({ tournamentId })
  );

  if (!tournament) return <div className="p-8">Đang tải...</div>;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/tournaments/${tournamentId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay Lại {tournament.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Vòng Loại Trực Tiếp</h1>
      </div>

      {tournament.status !== "knockout" && tournament.status !== "completed" ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Vòng loại trực tiếp chưa bắt đầu.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {/* Vòng 16 đội */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-muted-foreground">VÒNG 16 ĐỘI</h3>
            <div className="space-y-2">
              {["R16_1", "R16_2", "R16_3", "R16_4", "R16_5", "R16_6", "R16_7", "R16_8"].map((slot) => {
                const m = bracket?.[slot];
                return (
                  <div key={slot} className={`rounded-lg border p-3 ${!m?.homeTeam || !m?.awayTeam ? "opacity-50" : ""}`}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{slot}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={m?.homeScore !== null && m?.homeScore !== undefined && m?.homeScore > (m?.awayScore ?? 0) ? "font-bold" : ""}>
                          {m?.homeTeam?.name ?? "—"}
                        </span>
                        <span className="font-mono font-bold">{m?.homeScore ?? "–"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className={m?.awayScore !== null && m?.awayScore !== undefined && m?.awayScore > (m?.homeScore ?? 0) ? "font-bold" : ""}>
                          {m?.awayTeam?.name ?? "—"}
                        </span>
                        <span className="font-mono font-bold">{m?.awayScore ?? "–"}</span>
                      </div>
                    </div>
                  </div>
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
                  <div key={slot} className={`rounded-lg border p-3 ${!m?.homeTeam || !m?.awayTeam ? "opacity-50" : ""}`}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{slot}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{m?.homeTeam?.name ?? "—"}</span>
                        <span className="font-mono font-bold">{m?.homeScore ?? "–"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>{m?.awayTeam?.name ?? "—"}</span>
                        <span className="font-mono font-bold">{m?.awayScore ?? "–"}</span>
                      </div>
                    </div>
                  </div>
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
                  <div key={slot} className={`rounded-lg border p-3 ${!m?.homeTeam || !m?.awayTeam ? "opacity-50" : ""}`}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{slot}</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{m?.homeTeam?.name ?? "—"}</span>
                        <span className="font-mono font-bold">{m?.homeScore ?? "–"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>{m?.awayTeam?.name ?? "—"}</span>
                        <span className="font-mono font-bold">{m?.awayScore ?? "–"}</span>
                      </div>
                    </div>
                  </div>
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
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </div>
              <div className="rounded-lg border p-3 opacity-70">
                <p className="mb-2 text-xs font-bold text-muted-foreground">HẠNG 3</p>
                <p className="text-xs text-muted-foreground">—</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
