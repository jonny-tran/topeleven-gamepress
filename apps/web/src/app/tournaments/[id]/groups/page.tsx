"use client";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PublicGroupsPage({ params }: Props) {
  const { id: tournamentId } = use(params);

  const { data: tournament } = useQuery(trpc.tournament.getById.queryOptions({ id: tournamentId }));
  const { data: allStandings } = useQuery(trpc.ranking.getAllStandings.queryOptions({ tournamentId }));
  const { data: matches } = useQuery(
    trpc.match.listByTournament.queryOptions({ tournamentId, stage: "group" })
  );

  if (!tournament) return <div className="p-8">Đang tải...</div>;
  const groups = tournament.groups ?? [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/tournaments/${tournamentId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay Lại {tournament.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Vòng Bảng</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {groups.map((group) => {
          const standings = allStandings?.[group.code] ?? [];
          return (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="text-lg">Bảng {group.code}</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left">#</th>
                      <th className="pb-2 text-left">Đội</th>
                      <th className="pb-2 text-center">Tr</th>
                      <th className="pb-2 text-center">T</th>
                      <th className="pb-2 text-center">H</th>
                      <th className="pb-2 text-center">B</th>
                      <th className="pb-2 text-center">HS</th>
                      <th className="pb-2 text-center font-medium">Đ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, idx) => (
                      <tr key={s.teamId} className={`border-b last:border-0 ${idx < 2 ? "bg-green-50 dark:bg-green-950/20" : idx === 2 ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}>
                        <td className="py-1.5 pr-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-1.5 font-medium">{s.teamName}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.played}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.won}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.drawn}</td>
                        <td className="py-1.5 text-center text-muted-foreground">{s.lost}</td>
                        <td className={`py-1.5 text-center ${s.goalDiff > 0 ? "text-green-600" : s.goalDiff < 0 ? "text-red-600" : ""}`}>
                          {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                        </td>
                        <td className="py-1.5 text-center font-bold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
