"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Eraser,
  Layers,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { trpc, getErrorMessage } from "@/utils/trpc";
import { cn } from "@topEleven-gamepress/ui/lib/utils";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Input } from "@topEleven-gamepress/ui/components/input";
import { Badge } from "@topEleven-gamepress/ui/components/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@topEleven-gamepress/ui/components/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@topEleven-gamepress/ui/components/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsPanel,
} from "@topEleven-gamepress/ui/components/tabs";

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

const POTS = [1, 2, 3, 4] as const;
const TEAMS_PER_POT = 6;
const TOTAL_TEAMS = POTS.length * TEAMS_PER_POT; // 24

/** Label cơ bản cho mỗi pot — không có phân loại mạnh/yếu. */
const POT_META: Record<number, { label: string }> = {
  1: { label: "Pot 1" },
  2: { label: "Pot 2" },
  3: { label: "Pot 3" },
  4: { label: "Pot 4" },
};

function createEmptyTeams(): TeamRow[] {
  const rows: TeamRow[] = [];
  for (const pot of POTS) {
    for (let i = 0; i < TEAMS_PER_POT; i++) {
      rows.push({ name: "", coachName: "", associationName: "", associationCode: "", pot });
    }
  }
  return rows;
}

export default function TeamEntryPage({ params }: Props) {
  const { id: tournamentId } = use(params);
  const queryClient = useQueryClient();

  const { data: tournament } = useQuery(
    trpc.tournament.getById.queryOptions({ id: tournamentId })
  );
  const { data: existingTeams } = useQuery(
    trpc.team.list.queryOptions({ tournamentId })
  );

  /* ─── Form state ─── */
  const [teams, setTeams] = useState<TeamRow[]>(createEmptyTeams);
  const [activePot, setActivePot] = useState<number>(1);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirtyMap, setDirtyMap] = useState<Set<number>>(new Set());

  /* ─── Track whether we've seeded the form from existing data ─── */
  const seededKeyRef = useRef<string | null>(null);
  // Mirror teams vào ref để effect dưới đây không phụ thuộc vào `teams` —
  // tránh việc re-run khi user gõ phím và ghi đè dữ liệu đang nhập.
  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  // Pre-fill when existing data arrives. Chỉ chạy đúng một lần cho mỗi
  // `tournamentId` và CHỈ khi form còn trống — tránh ghi đè thay đổi của
  // người dùng khi cache refresh ngầm (refetch) hoặc khi query chậm.
  useEffect(() => {
    if (!existingTeams) return;
    const isFormEmpty = teamsRef.current.every(
      (t) =>
        t.name === "" &&
        t.coachName === "" &&
        t.associationName === "" &&
        t.associationCode === ""
    );
    if (!isFormEmpty) return;

    const key = `${tournamentId}::${existingTeams.length}`;
    if (seededKeyRef.current === key) return;
    seededKeyRef.current = key;

    if (existingTeams.length === 0) return;

    const prefill = createEmptyTeams();
    existingTeams.forEach((et) => {
      const idx = prefill.findIndex((t) => t.pot === et.pot && t.name === "");
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
  }, [existingTeams, tournamentId]);

  /* ─── Mutations ─── */
  const saveBulk = useMutation(
    trpc.team.createBulk.mutationOptions({
      onSuccess: (result: { noChange?: boolean; count?: number }) => {
        if (result.noChange) {
          toast.info("Không có thay đổi nào so với danh sách đội hiện tại.");
        } else {
          toast.success(`Đã lưu ${result.count ?? 0} đội bóng thành công!`);
          queryClient.invalidateQueries(trpc.team.list.queryOptions({ tournamentId }));
        }
        setLastSavedAt(new Date());
        setDirtyMap(new Set());
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
        setDirtyMap(new Set());
        seededKeyRef.current = `${tournamentId}::0`;
      },
    })
  );

  /* ─── Derived stats ─── */
  const stats_ = useMemo(() => {
    const perPot: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const duplicateNames = new Set<string>();
    const seenNames = new Set<string>();
    let filled = 0;

    teams.forEach((t) => {
      const nameKey = t.name.trim().toLowerCase();
      if (nameKey) {
        if (seenNames.has(nameKey)) duplicateNames.add(nameKey);
        seenNames.add(nameKey);
      }
      // Một row được tính là "filled" khi cả 4 trường đều có giá trị
      const isComplete =
        t.name.trim() !== "" &&
        t.coachName.trim() !== "" &&
        t.associationName.trim() !== "" &&
        t.associationCode.trim() !== "";
      if (isComplete) {
        perPot[t.pot] = (perPot[t.pot] ?? 0) + 1;
        filled += 1;
      }
    });

    return {
      filled,
      perPot,
      duplicateNames,
      total: TOTAL_TEAMS,
      progressPct: Math.round((filled / TOTAL_TEAMS) * 100),
      allReady: filled === TOTAL_TEAMS && duplicateNames.size === 0,
    };
  }, [teams]);

  const isRowComplete = (t: TeamRow) =>
    t.name.trim() !== "" &&
    t.coachName.trim() !== "" &&
    t.associationName.trim() !== "" &&
    t.associationCode.trim() !== "";

  const updateTeam = (index: number, field: keyof TeamRow, value: string) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirtyMap((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const clearRow = (index: number) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = { name: "", coachName: "", associationName: "", associationCode: "", pot: next[index].pot };
      return next;
    });
    setDirtyMap((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    toast.info("Đã xóa dòng này.");
  };

  const handleSave = () => {
    // Lấy các row hoàn chỉnh (4 trường) — những row chưa điền xem như chưa tồn tại
    const validTeams = teams.filter(isRowComplete);
    if (validTeams.length !== TOTAL_TEAMS) {
      toast.error(`Cần nhập đủ ${TOTAL_TEAMS} đội. Hiện tại: ${stats_.filled}/${TOTAL_TEAMS}`);
      return;
    }
    for (const pot of POTS) {
      const potCount = validTeams.filter((t) => t.pot === pot).length;
      if (potCount !== TEAMS_PER_POT) {
        const meta = POT_META[pot];
        toast.error(`${meta.label} phải có đúng ${TEAMS_PER_POT} đội. Hiện tại: ${potCount}`);
        return;
      }
    }
    if (stats_.duplicateNames.size > 0) {
      toast.error(`Có tên đội bị trùng: ${[...stats_.duplicateNames].join(", ")}`);
      return;
    }
    saveBulk.mutate({ tournamentId, teams: validTeams });
  };

  /* ─── Bulk paste handler ─── */
  const handleBulkPaste = (pot: number, raw: string) => {
    // Tách theo dòng, mỗi dòng là 1 đội với các cột tab-separated
    // Hỗ trợ 1-4 cột (name, coachName, associationName, associationCode)
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.info("Không có dữ liệu hợp lệ trong bộ nhớ tạm.");
      return;
    }
    if (lines.length > TEAMS_PER_POT) {
      toast.error(`Tối đa ${TEAMS_PER_POT} đội mỗi pot. Bạn đang dán ${lines.length} dòng.`);
      return;
    }

    setTeams((prev) => {
      const next = [...prev];
      const startIdx = (pot - 1) * TEAMS_PER_POT;
      lines.forEach((line, i) => {
        const cols = line.split(/\t|\s{2,}|\|/).map((c) => c.trim()).filter(Boolean);
        const target = startIdx + i;
        const existing = next[target] ?? { name: "", coachName: "", associationName: "", associationCode: "", pot };
        next[target] = {
          pot,
          coachName: existing.coachName,
          associationName: existing.associationName,
          associationCode: existing.associationCode,
          name: cols[0] ?? existing.name,
          ...(cols[1] !== undefined ? { coachName: cols[1] } : {}),
          ...(cols[2] !== undefined ? { associationName: cols[2] } : {}),
          ...(cols[3] !== undefined ? { associationCode: cols[3].toUpperCase() } : {}),
        };
      });
      return next;
    });

    // Đánh dấu các row đã thay đổi là dirty
    setDirtyMap((prev) => {
      const next = new Set(prev);
      const startIdx = (pot - 1) * TEAMS_PER_POT;
      for (let i = 0; i < lines.length; i++) next.add(startIdx + i);
      return next;
    });

    toast.success(`Đã dán ${lines.length} đội vào ${POT_META[pot].label}.`);
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* ────────────────────────── Sticky page header ────────────────────────── */}
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
              <span className="font-display text-sm font-bold">
                {tournament?.name ?? "Giải đấu"}
              </span>
            </div>
            {lastSavedAt && (
              <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Đã lưu lúc {lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {/* Title + meta + actions */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-xl font-black tracking-tight leading-tight">
                  Nhập Đội Bóng
                </h1>
                <p className="cn-section-title">
                  Nhập đủ {TOTAL_TEAMS} đội · 4 pot · {TEAMS_PER_POT} đội / pot
                </p>
              </div>
            </div>

            {/* Stats + actions */}
            <div className="flex flex-wrap items-center gap-2">
              <ProgressPill
                filled={stats_.filled}
                total={stats_.total}
                pct={stats_.progressPct}
                allReady={stats_.allReady}
              />
              <Button
                onClick={handleSave}
                disabled={saveBulk.isPending || !stats_.allReady}
                size="default"
                className={cn(
                  "h-9 px-4 font-bold shadow-md",
                  stats_.allReady
                    ? "shadow-primary/30"
                    : "opacity-90"
                )}
              >
                {saveBulk.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                {saveBulk.isPending ? "Đang lưu..." : "Lưu Tất Cả"}
              </Button>

              {(existingTeams?.length ?? 0) > 0 && (
                <DeleteAllDialog
                  onConfirm={() => deleteAll.mutate({ tournamentId })}
                  isPending={deleteAll.isPending}
                />
              )}
            </div>
          </div>
        </div>

        {/* ────────────────── Tab bar (per-pot navigation) ────────────────── */}
        <div className="mx-auto max-w-6xl px-4">
          <Tabs
            value={String(activePot)}
            onValueChange={(v) => setActivePot(Number(v))}
          >
            <TabsList className="h-auto w-full justify-start gap-2 rounded-none bg-transparent p-0 overflow-x-auto">
              {POTS.map((pot) => {
                const meta = POT_META[pot];
                const count = stats_.perPot[pot] ?? 0;
                const isFull = count === TEAMS_PER_POT;
                return (
                  <TabsTrigger
                    key={pot}
                    value={String(pot)}
                    className={cn(
                      "group relative flex h-12 items-center gap-2 rounded-t-lg border-b-2 border-transparent px-3 transition-all",
                      "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      "data-[state=active]:border-primary data-[state=active]:bg-muted/40 data-[state=active]:text-foreground"
                    )}
                  >
                    <div className="flex flex-col items-start leading-tight">
                      <span className="font-display text-sm font-black">{meta.label}</span>
                      <span className="cn-section-title text-[10px] tabular-nums">
                        {count}/{TEAMS_PER_POT} đội
                      </span>
                    </div>
                    {isFull && (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-label="Hoàn thành" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* ────────────────────────── Main content ────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Top alert — duplicate names */}
        {stats_.duplicateNames.size > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Phát hiện tên đội bị trùng</p>
              <p className="text-xs text-muted-foreground">
                {[...stats_.duplicateNames].join(", ")} — mỗi đội phải có tên riêng biệt trước khi lưu.
              </p>
            </div>
          </div>
        )}

        {/* Empty-state hint khi chưa có dữ liệu */}
        {stats_.filled === 0 && (
          <EmptyStateGuide />
        )}

        {/* Per-pot panels */}
        <Tabs
          value={String(activePot)}
          onValueChange={(v) => setActivePot(Number(v))}
        >
          {POTS.map((pot) => (
            <TabsPanel key={pot} value={String(pot)} className="mt-0">
              <PotPanel
                pot={pot}
                teams={teams}
                dirtyMap={dirtyMap}
                onChange={updateTeam}
                onClearRow={clearRow}
                onBulkPaste={handleBulkPaste}
              />
            </TabsPanel>
          ))}
        </Tabs>

        {/* Bottom hint: per-pot progress summary */}
        <PotSummaryGrid
          perPot={stats_.perPot}
          activePot={activePot}
          onJumpToPot={(pot) => {
            setActivePot(pot);
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  PotPanel — table cho một pot
 * ════════════════════════════════════════════════════════════════════════ */

function PotPanel({
  pot,
  teams,
  dirtyMap,
  onChange,
  onClearRow,
  onBulkPaste,
}: {
  pot: number;
  teams: TeamRow[];
  dirtyMap: Set<number>;
  onChange: (index: number, field: keyof TeamRow, value: string) => void;
  onClearRow: (index: number) => void;
  onBulkPaste: (pot: number, raw: string) => void;
}) {
  const startIdx = (pot - 1) * TEAMS_PER_POT;
  const meta = POT_META[pot];
  const filledCount = teams
    .slice(startIdx, startIdx + TEAMS_PER_POT)
    .filter((t) =>
      t.name.trim() !== "" &&
      t.coachName.trim() !== "" &&
      t.associationName.trim() !== "" &&
      t.associationCode.trim() !== ""
    ).length;
  const isFull = filledCount === TEAMS_PER_POT;

  return (
    <div className="space-y-3">
      {/* Pot header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-gradient-to-br from-card via-card to-muted/40 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-black tracking-tight">
                {meta.label}
              </h2>
              {isFull && (
                <Badge variant="success" className="gap-1">
                  <Check className="h-3 w-3" />
                  Đầy đủ
                </Badge>
              )}
            </div>
            <p className="cn-section-title">{TEAMS_PER_POT} đội / pot</p>
          </div>
        </div>

        {/* Per-pot progress bar */}
        <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                isFull
                  ? "bg-gradient-to-r from-success to-emerald-400"
                  : "bg-gradient-to-r from-primary to-primary/70"
              )}
              style={{ width: `${(filledCount / TEAMS_PER_POT) * 100}%` }}
            />
          </div>
          <span className="font-mono text-sm font-bold tabular-nums">
            {filledCount}/{TEAMS_PER_POT}
          </span>
        </div>

        <BulkPasteButton pot={pot} onPaste={onBulkPaste} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border-2 shadow-sm">
        {/* Table header — sticky trên desktop */}
        <div className="hidden border-b bg-muted/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid md:grid-cols-[2.5rem_1.6fr_1.4fr_1.4fr_6rem_3rem] md:gap-3">
          <span className="flex items-center justify-center">#</span>
          <span>Tên Đội *</span>
          <span>Huấn Luyện Viên *</span>
          <span>Liên Đoàn *</span>
          <span>Mã FIFA *</span>
          <span className="text-center">Sửa</span>
        </div>

        <div className="divide-y divide-border/60 bg-card">
          {Array.from({ length: TEAMS_PER_POT }).map((_, i) => {
            const teamIdx = startIdx + i;
            const t = teams[teamIdx];
            const complete = t && isCompleteRow(t);
            const isDirty = dirtyMap.has(teamIdx);
            return (
              <TeamRowEditor
                key={i}
                indexInPot={i}
                rowIndex={teamIdx}
                row={t ?? { name: "", coachName: "", associationName: "", associationCode: "", pot }}
                complete={!!complete}
                isDirty={isDirty && !complete}
                onChange={onChange}
                onClear={onClearRow}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function isCompleteRow(t: TeamRow) {
  return (
    t.name.trim() !== "" &&
    t.coachName.trim() !== "" &&
    t.associationName.trim() !== "" &&
    t.associationCode.trim() !== ""
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  TeamRowEditor — responsive row với input fields
 * ════════════════════════════════════════════════════════════════════════ */

function TeamRowEditor({
  indexInPot,
  rowIndex,
  row,
  complete,
  isDirty,
  onChange,
  onClear,
}: {
  indexInPot: number;
  rowIndex: number;
  row: TeamRow;
  complete: boolean;
  isDirty: boolean;
  onChange: (index: number, field: keyof TeamRow, value: string) => void;
  onClear: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 px-4 py-3 transition-colors md:grid-cols-[2.5rem_1.6fr_1.4fr_1.4fr_6rem_3rem] md:gap-3 md:py-2.5",
        complete
          ? "bg-success/5 hover:bg-success/10"
          : isDirty
          ? "bg-warning/5 hover:bg-warning/10"
          : "hover:bg-muted/40"
      )}
    >
      {/* Position chip */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-black shadow-sm ring-1",
            complete
              ? "bg-gradient-to-br from-success to-emerald-500 text-success-foreground shadow-success/30 ring-success/40"
              : "bg-muted text-muted-foreground ring-border"
          )}
        >
          {complete ? <Check className="h-3.5 w-3.5" /> : indexInPot + 1}
        </span>
        <span className="cn-section-title md:hidden">Đội #{indexInPot + 1}</span>
      </div>

      <Field
        label="Tên đội"
        value={row.name}
        placeholder="VD: Manchester United"
        onChange={(v) => onChange(rowIndex, "name", v)}
      />

      <Field
        label="Huấn luyện viên"
        value={row.coachName}
        placeholder="VD: Pep Guardiola"
        onChange={(v) => onChange(rowIndex, "coachName", v)}
      />

      <Field
        label="Liên đoàn"
        value={row.associationName}
        placeholder="VD: Hiệp hội bóng đá Anh"
        onChange={(v) => onChange(rowIndex, "associationName", v)}
      />

      <Field
        label="Mã FIFA"
        value={row.associationCode}
        placeholder="VFF"
        onChange={(v) => onChange(rowIndex, "associationCode", v.toUpperCase())}
        maxLength={6}
        mono
      />

      {/* Actions */}
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Xóa dòng này"
          onClick={() => onClear(rowIndex)}
          disabled={
            row.name === "" &&
            row.coachName === "" &&
            row.associationName === "" &&
            row.associationCode === ""
          }
          className="text-muted-foreground hover:text-destructive"
        >
          <Eraser className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  Field — labeled input có icon + focus glow
 * ════════════════════════════════════════════════════════════════════════ */

function Field({
  label,
  value,
  placeholder,
  onChange,
  maxLength,
  mono = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  maxLength?: number;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="cn-section-title md:hidden">{label}</label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className={cn(
          "h-9 w-full px-2.5 text-sm transition-shadow",
          mono && "font-mono uppercase tracking-wider",
          value && "ring-1 ring-primary/20"
        )}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  ProgressPill — badge tròn hiển thị tổng số đội đã nhập
 * ════════════════════════════════════════════════════════════════════════ */

function ProgressPill({
  filled,
  total,
  pct,
  allReady,
}: {
  filled: number;
  total: number;
  pct: number;
  allReady: boolean;
}) {
  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors sm:flex",
        allReady
          ? "border-success/40 bg-success/10"
          : filled === 0
          ? "border-border bg-muted/30"
          : "border-primary/30 bg-primary/8"
      )}
    >
      <Layers
        className={cn(
          "h-4 w-4",
          allReady ? "text-success" : filled === 0 ? "text-muted-foreground" : "text-primary"
        )}
      />
      <div className="flex flex-col leading-tight">
        <span className="cn-section-title text-[9px]">Tiến độ</span>
        <span className="font-display text-sm font-bold tabular-nums">
          {filled}/{total}
        </span>
      </div>
      <div className="ml-1 flex h-6 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all duration-500",
            allReady
              ? "bg-gradient-to-r from-success to-emerald-400"
              : "bg-gradient-to-r from-primary to-primary/70"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  PotSummaryGrid — 4 mini-card bên dưới để jump giữa các pot
 * ════════════════════════════════════════════════════════════════════════ */

function PotSummaryGrid({
  perPot,
  activePot,
  onJumpToPot,
}: {
  perPot: Record<number, number>;
  activePot: number;
  onJumpToPot: (pot: number) => void;
}) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {POTS.map((pot) => {
        const meta = POT_META[pot];
        const count = perPot[pot] ?? 0;
        const isFull = count === TEAMS_PER_POT;
        const isActive = activePot === pot;
        return (
          <button
            key={pot}
            onClick={() => onJumpToPot(pot)}
            className={cn(
              "group flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all hover:shadow-md",
              isActive
                ? "border-2 border-primary shadow-sm"
                : "hover:border-primary/30"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-display text-xs font-bold">{meta.label}</span>
                {isFull && <CheckCircle2 className="h-3 w-3 text-success" />}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {count}/{TEAMS_PER_POT}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      isFull
                        ? "bg-gradient-to-r from-success to-emerald-400"
                        : "bg-gradient-to-r from-primary to-primary/70"
                    )}
                    style={{ width: `${(count / TEAMS_PER_POT) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  EmptyStateGuide — gợi ý thân thiện khi form trống
 * ════════════════════════════════════════════════════════════════════════ */

function EmptyStateGuide() {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/8 via-card to-primary/3">
      <div className="grid gap-4 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-2 ring-primary/30 shadow-md shadow-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-base font-black tracking-tight">
            Bắt đầu nhập 24 đội cho giải đấu của bạn
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi pot chứa 6 đội — chọn tab ở trên để chuyển giữa các nhóm. Có thể{" "}
            <span className="font-bold text-foreground">dán từ bảng tính</span> vào từng pot để nhập nhanh.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  BulkPasteButton — modal dán nhanh dữ liệu cho 1 pot
 * ════════════════════════════════════════════════════════════════════════ */

function BulkPasteButton({
  pot,
  onPaste,
}: {
  pot: number;
  onPaste: (pot: number, raw: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const handlePaste = () => {
    onPaste(pot, text);
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <ClipboardPaste className="h-3.5 w-3.5" />
            Dán nhanh
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-base font-bold">
            Dán nhanh cho {POT_META[pot].label}
          </DialogTitle>
          <DialogDescription>
            Mỗi dòng là một đội. Tối đa {TEAMS_PER_POT} dòng. Có thể dán từ Google
            Sheets, Excel — phân cách cột bằng <kbd className="cn-pill border">Tab</kbd>{" "}
            hoặc <kbd className="cn-pill border">|</kbd>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <p className="font-bold text-foreground">Định dạng mỗi dòng:</p>
            <code className="mt-1 block font-mono">
              Tên đội | HLV | Tên liên đoàn | Mã FIFA
            </code>
            <p className="mt-1">Mã FIFA sẽ tự động viết hoa. Thiếu cột thì giữ trống phần đó.</p>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Real Madrid | Carlo Ancelotti | Tây Ban Nha | RFEF\nBarcelona | Xavi | Catalunya | FCF\n..."}
            className="w-full resize-none rounded-md border bg-background p-2 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
          />

          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Cần lưu lại bằng nút "Lưu Tất Cả" sau khi dán.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handlePaste} disabled={!text.trim()}>
            <ClipboardPaste className="mr-1.5 h-4 w-4" />
            Áp dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  DeleteAllDialog — alert-dialog thay cho native confirm()
 * ════════════════════════════════════════════════════════════════════════ */

function DeleteAllDialog({
  onConfirm,
  isPending,
}: {
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="default"
            className="h-9 px-3"
            disabled={isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Xóa tất cả
          </Button>
        }
      />
      <AlertDialogContent size="sm" className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 ring-2 ring-destructive/30">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center font-display text-base font-black">
            Xóa toàn bộ đội bóng?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Hành động này sẽ xóa tất cả các đội đã nhập trong giải đấu này và
            <strong className="text-foreground"> không thể hoàn tác</strong>. Bạn sẽ phải nhập lại từ đầu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            Xóa tất cả
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}