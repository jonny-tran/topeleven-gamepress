"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc, getErrorMessage } from "@/utils/trpc";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@topEleven-gamepress/ui/components/card";
import { Input } from "@topEleven-gamepress/ui/components/input";
import { Label } from "@topEleven-gamepress/ui/components/label";

interface TeamRow {
  name: string;
  coachName: string;
  associationName: string;
  associationCode: string;
  pot: number;
}

interface Props {
  params: Promise<{ id: string }>;
}

const POT_LABELS = ["", "Nhóm Hạt Giống (Pot 1)", "Pot 2", "Pot 3", "Pot 4"];

export default function TeamEntryPage({ params }: Props) {
  const { id: tournamentId } = use(params);
  const queryClient = useQueryClient();

  const { data: existingTeams } = useQuery(
    trpc.team.list.queryOptions({ tournamentId })
  );

  const saveBulk = useMutation(
    trpc.team.createBulk.mutationOptions({
      onSuccess: (result: { noChange?: boolean; count?: number }) => {
        if (result.noChange) {
          toast.info("Không có thay đổi nào so với danh sách đội hiện tại.");
        } else {
          toast.success(`Đã lưu ${result.count ?? 0} đội bóng thành công!`);
          queryClient.invalidateQueries(trpc.team.list.queryOptions({ tournamentId }));
        }
      },
      onError: (err: unknown) => {
        toast.error(getErrorMessage(err));
      },
    })
  );

  const deleteAll = useMutation(
    trpc.team.deleteAll.mutationOptions({
      onSuccess: () => {
        toast.success("Đã xóa tất cả đội.");
        queryClient.invalidateQueries(trpc.team.list.queryOptions({ tournamentId }));
        setTeams(createEmptyTeams());
      },
    })
  );

  // Initialize form data
  const createEmptyTeams = (): TeamRow[] => {
    const rows: TeamRow[] = [];
    for (let pot = 1; pot <= 4; pot++) {
      for (let i = 0; i < 6; i++) {
        rows.push({ name: "", coachName: "", associationName: "", associationCode: "", pot });
      }
    }
    return rows;
  };

  const [teams, setTeams] = useState<TeamRow[]>(createEmptyTeams);

  // Pre-fill from existing teams
  if (existingTeams && existingTeams.length > 0 && teams.every((t) => t.name === "")) {
    const prefill = createEmptyTeams();
    existingTeams.forEach((et) => {
      const idx = prefill.findIndex(
        (t) => t.pot === et.pot && t.name === ""
      );
      if (idx !== -1) {
        prefill[idx] = {
          name: et.name,
          coachName: et.coachName,
          associationName: et.associationName,
          associationCode: et.associationCode,
          pot: et.pot,
        };
      }
    });
    setTeams(prefill);
  }

  const updateTeam = (index: number, field: keyof TeamRow, value: string) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    const validTeams = teams.filter((t) => t.name.trim() !== "");
    if (validTeams.length !== 24) {
      toast.error(`Vui lòng nhập đủ 24 đội. Hiện tại: ${validTeams.length}/24`);
      return;
    }

    for (let pot = 1; pot <= 4; pot++) {
      const potCount = validTeams.filter((t) => t.pot === pot).length;
      if (potCount !== 6) {
        toast.error(`${POT_LABELS[pot]} phải có đúng 6 đội. Hiện tại: ${potCount}`);
        return;
      }
    }

    saveBulk.mutate({ tournamentId, teams: validTeams });
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
        <h1 className="text-3xl font-bold tracking-tight">Nhập Đội Bóng</h1>
        <p className="text-muted-foreground">Nhập đủ 24 đội vào 4 nhóm (pot), mỗi pot 6 đội.</p>
      </div>

      <div className="mb-4 flex gap-3">
        <Button onClick={handleSave} disabled={saveBulk.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveBulk.isPending ? "Đang lưu..." : "Lưu Tất Cả Đội"}
        </Button>
        {existingTeams && existingTeams.length > 0 && (
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Xóa tất cả đội và đặt lại?")) {
                deleteAll.mutate({ tournamentId });
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa Tất Cả
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {[1, 2, 3, 4].map((pot) => {
          const startIdx = (pot - 1) * 6;
          return (
            <Card key={pot}>
              <CardHeader>
                <CardTitle className="text-lg">{POT_LABELS[pot]}</CardTitle>
                <CardDescription>6 đội mỗi nhóm</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 text-left font-medium">#</th>
                        <th className="pb-2 text-left font-medium">Tên Đội</th>
                        <th className="pb-2 text-left font-medium">Huấn Luyện Viên</th>
                        <th className="pb-2 text-left font-medium">Tên Liên Đoàn</th>
                        <th className="pb-2 text-left font-medium">Mã Liên Đoàn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 6 }).map((_, i) => {
                        const teamIdx = startIdx + i;
                        const t = teams[teamIdx];
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 pr-2">
                              <Input
                                value={t?.name ?? ""}
                                onChange={(e) => updateTeam(teamIdx, "name", e.target.value)}
                                placeholder="Tên đội bóng"
                                className="h-8"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                value={t?.coachName ?? ""}
                                onChange={(e) => updateTeam(teamIdx, "coachName", e.target.value)}
                                placeholder="Tên HLV"
                                className="h-8"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                value={t?.associationName ?? ""}
                                onChange={(e) => updateTeam(teamIdx, "associationName", e.target.value)}
                                placeholder="Tên liên đoàn"
                                className="h-8"
                              />
                            </td>
                            <td className="py-2">
                              <Input
                                value={t?.associationCode ?? ""}
                                onChange={(e) => updateTeam(teamIdx, "associationCode", e.target.value.toUpperCase())}
                                placeholder="VD: VFF"
                                className="h-8 w-24 font-mono uppercase"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
