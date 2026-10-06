"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  ChevronLeft,
  ChevronRight,
  Medal,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { cn } from "@topEleven-gamepress/ui/lib/utils";
import { Badge } from "@topEleven-gamepress/ui/components/badge";
import { Tabs, TabsList, TabsTrigger } from "@topEleven-gamepress/ui/components/tabs";

interface Props {
  params: Promise<{ id: string }>;
}

const GROUP_CODES = ["A", "B", "C", "D", "E", "F"] as const;

export default function StandingsPage({ params }: Props) {
  const { id: tournamentId } = use(params);
  const [activeGroup, setActiveGroup] = useState<string>("A");

  const { data: tournament } = useQuery(
    trpc.tournament.getById.queryOptions({ id: tournamentId })
  );
  const { data: allStandings } = useQuery(
    trpc.ranking.getAllStandings.queryOptions({ tournamentId })
  );
  const { data: teams } = useQuery(
    trpc.team.list.queryOptions({ tournamentId })
  );

  if (!tournament) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const groups = tournament.groups ?? [];
  const totalTeams = teams?.filter((t) => t.groupId !== null).length ?? 0;
  const hasStandings = allStandings && Object.keys(allStandings).length > 0;

  return (
    <div className="flex min-h-full flex-col">
      {/* ─── Sticky Page Header ─── */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3">
          {/* Breadcrumb row */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/tournaments/${tournamentId}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Quay lại
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="font-display text-sm font-bold">{tournament.name}</span>
            </div>

            {/* Status badge */}
            <StatusBadge status={tournament.status} />
          </div>

          {/* Title + meta */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-black tracking-tight leading-tight">
                    Bảng Xếp Hạng
                  </h1>
                  <p className="cn-section-title">Vòng bảng · Tiêu chí: Điểm → Đối đầu → Hiệu Số → Bàn Thắng → Fair-Play</p>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="hidden items-center gap-3 sm:flex">
              <MiniStat
                icon={<Target className="h-3.5 w-3.5 text-primary" />}
                label="Đội"
                value={`${totalTeams}/24`}
                tone="primary"
              />
              <MiniStat
                icon={<TrendingUp className="h-3.5 w-3.5 text-success" />}
                label="Bảng"
                value={`${groups.length}/6`}
                tone="success"
              />
              <MiniStat
                icon={<Medal className="h-3.5 w-3.5 text-amber-500" />}
                label="Trạng thái"
                value={tournament.status === "group_stage" ? "Đang đấu" : "Chờ"}
                tone="warning"
              />
            </div>
          </div>
        </div>

        {/* Group selector tabs */}
        <div className="mx-auto max-w-6xl px-4">
          <Tabs
            value={activeGroup}
            onValueChange={setActiveGroup}
            className="w-full"
          >
            <TabsList className="h-auto w-full justify-start gap-1 rounded-none bg-transparent p-0 overflow-x-auto">
              {GROUP_CODES.map((code) => {
                const standings = allStandings?.[code] ?? [];
                const isComplete = standings.length >= 4;
                return (
                  <TabsTrigger
                    key={code}
                    value={code}
                    className={cn(
                      "relative flex h-11 flex-col items-center justify-center gap-0 rounded-b-lg px-4 transition-all",
                      "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary",
                      "data-[state=active]:font-black",
                      !isComplete && "text-muted-foreground"
                    )}
                  >
                    <span className="font-display text-base font-black">{code}</span>
                    <span className="cn-section-title text-[9px]">
                      {standings.length > 0 ? `${standings.length} đội` : "—"}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {!hasStandings ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {GROUP_CODES.map((code) => {
              const standings = allStandings?.[code] ?? [];
              if (standings.length === 0) return null;
              return (
                <GroupScoreboard
                  key={code}
                  code={code}
                  standings={standings}
                  isActive={code === activeGroup}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Group Scoreboard ───────────────────────── */

function GroupScoreboard({
  code,
  standings,
  isActive,
}: {
  code: string;
  standings: Array<{
    teamId: string;
    teamName: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    fairPlayPoints: number;
    needsManualDecision: boolean;
  }>;
  isActive: boolean;
}) {
  if (!isActive) return null;

  const hasManual = standings.some((s) => s.needsManualDecision);

  return (
    <div className="space-y-3">
      {/* Group header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-xl font-black text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/20">
            {code}
          </div>
          <div>
            <h2 className="font-display text-lg font-black tracking-tight">
              Bảng {code}
            </h2>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border-2 shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-[2.5rem_1fr_3rem_3rem_3rem_3rem_3.5rem_3.5rem_3.5rem_4rem_3.5rem] gap-1 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center justify-center">#</span>
          <span>Đội</span>
          <span className="text-center">Tr</span>
          <span className="text-center">T</span>
          <span className="text-center">H</span>
          <span className="text-center">B</span>
          <span className="text-center">BT</span>
          <span className="text-center">BC</span>
          <span className="text-center">HS</span>
          <span className="text-center font-black text-primary">Đ</span>
          <span className="text-center">FL</span>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-border/60 bg-card">
          {standings.map((s, idx) => {
            const pos = idx + 1;
            const isKnockout = pos <= 2;
            const isPlayoff = pos === 3;

            return (
              <div
                key={s.teamId}
                className={cn(
                  "grid grid-cols-[2.5rem_1fr_3rem_3rem_3rem_3rem_3.5rem_3.5rem_3.5rem_4rem_3.5rem] gap-1 px-4 py-3 transition-colors",
                  "hover:bg-muted/40",
                  isKnockout && "bg-success/5",
                  isPlayoff && "bg-info/5"
                )}
              >
                {/* Position */}
                <span className="flex items-center justify-center">
                  <PositionBadge position={pos} />
                </span>

                {/* Team name */}
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-sm leading-tight" title={s.teamName}>
                      {s.teamName}
                    </div>
                  </div>
                  {isKnockout && (
                    <Badge variant="success" className="hidden shrink-0 text-[9px] sm:flex">
                      KO
                    </Badge>
                  )}
                  {isPlayoff && (
                    <Badge variant="primary" className="hidden shrink-0 text-[9px] sm:flex">
                      V16
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                <StatCell value={s.played} />
                <StatCell value={s.won} tone="success" />
                <StatCell value={s.drawn} />
                <StatCell value={s.lost} tone="destructive" />
                <StatCell value={s.goalsFor} />
                <StatCell value={s.goalsAgainst} />
                <GoalDiffCell diff={s.goalDiff} />
                <span className="flex items-center justify-center font-display text-sm font-black tabular-nums text-primary">
                  {s.points}
                </span>
                <StatCell
                  value={s.fairPlayPoints}
                  tone={s.fairPlayPoints < 0 ? "warning" : "muted"}
                />
              </div>
            );
          })}

          {standings.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Chưa có trận nào hoàn thành.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Helper Components ───────────────────────── */

function PositionBadge({ position }: { position: number }) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full font-display text-xs font-black shadow-sm ring-1",
        position === 1 && "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-400/40 ring-amber-500/40",
        position === 2 && "bg-gradient-to-br from-zinc-300 to-zinc-500 text-white shadow-zinc-300/40 ring-zinc-400/40",
        position === 3 && "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-orange-400/40 ring-orange-500/40",
        position === 4 && "bg-muted text-muted-foreground ring-border"
      )}
    >
      {position}
    </div>
  );
}

function StatCell({
  value,
  tone = "muted",
}: {
  value: number;
  tone?: "muted" | "success" | "destructive" | "warning";
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center font-mono text-sm tabular-nums leading-tight",
        tone === "success" && "text-success-foreground font-semibold",
        tone === "destructive" && "text-destructive-foreground",
        tone === "warning" && "text-warning-foreground",
        tone === "muted" && "text-muted-foreground"
      )}
    >
      {value}
    </span>
  );
}

function GoalDiffCell({ diff }: { diff: number }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center font-mono text-sm font-semibold tabular-nums leading-tight",
        diff > 0 && "text-success-foreground",
        diff < 0 && "text-destructive-foreground",
        diff === 0 && "text-muted-foreground"
      )}
    >
      {diff > 0 ? `+${diff}` : diff}
    </span>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "default";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
        tone === "primary" && "border-primary/20 bg-primary/5",
        tone === "success" && "border-success/20 bg-success/5",
        tone === "warning" && "border-warning/20 bg-warning/5",
        tone === "default" && "border-border bg-muted/30"
      )}
    >
      {icon}
      <div className="flex flex-col leading-tight">
        <span className="cn-section-title text-[9px]">{label}</span>
        <span className="font-display text-xs font-bold">{value}</span>
      </div>
    </div>
  );
}

function LegendChip({
  tone,
  label,
}: {
  tone: "success" | "info";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider",
        tone === "success" && "border-success/30 bg-success/10 text-success-foreground",
        tone === "info" && "border-primary/30 bg-primary/10 text-primary"
      )}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "default" }> = {
    group_stage:       { label: "Đang thi đấu",   variant: "success" },
    draw_completed:    { label: "Chờ khởi tranh", variant: "default" },
    knockout:          { label: "Vòng loại",        variant: "warning" },
    completed:         { label: "Hoàn thành",       variant: "default" },
    draw_in_progress:  { label: "Đang bốc thăm",  variant: "warning" },
    setup:             { label: "Khởi tạo",         variant: "default" },
  };
  const meta = map[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Award className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="font-display text-lg font-bold">Chưa có dữ liệu xếp hạng</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Hoàn thành các trận đấu vòng bảng để xếp hạng tự động được cập nhật.
      </p>
    </div>
  );
}
