"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { trpc, getErrorMessage } from "@/utils/trpc";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Card, CardContent } from "@topEleven-gamepress/ui/components/card";
import { Badge } from "@topEleven-gamepress/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@topEleven-gamepress/ui/components/dropdown-menu";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

/* ───────────────────────── Status helpers ───────────────────────── */

type Status =
  | "setup"
  | "draw_in_progress"
  | "draw_completed"
  | "group_stage"
  | "knockout"
  | "completed";

const STATUS_META: Record<
  Status,
  {
    label: string;
    tone: "muted" | "warning" | "info" | "primary" | "success" | "destructive";
    accent: "muted" | "amber" | "blue" | "emerald" | "violet" | "rose";
  }
> = {
  setup:            { label: "Khởi tạo",         tone: "muted",     accent: "muted"   },
  draw_in_progress: { label: "Đang bốc thăm",    tone: "warning",   accent: "amber"   },
  draw_completed:   { label: "Bốc thăm xong",    tone: "info",      accent: "blue"    },
  group_stage:      { label: "Vòng bảng",        tone: "primary",   accent: "emerald" },
  knockout:         { label: "Loại trực tiếp",   tone: "primary",   accent: "violet"  },
  completed:        { label: "Hoàn thành",       tone: "success",   accent: "emerald" },
};

const TONE_BADGE: Record<string, string> = {
  muted:       "bg-muted text-muted-foreground border-border",
  warning:     "bg-warning/15 text-warning-foreground border-warning/40",
  info:        "bg-info/15 text-info-foreground border-info/40",
  primary:     "bg-primary/15 text-primary border-primary/40",
  success:     "bg-success/15 text-success-foreground border-success/40",
  destructive: "bg-destructive/15 text-destructive-foreground border-destructive/40",
};

/* ───────────────────────── Primary action per status ───────────────────────── */
/** Mỗi status có 1 CTA chính — admin chỉ cần bấm vào là xong. */
function getPrimaryAction(t: {
  id: string;
  status: string;
}): { label: string; href: string; variant: "draw" | "primary" | "secondary"; icon: typeof Sparkles; desc: string } | null {
  switch (t.status as Status) {
    case "setup":
      return {
        label: "Nhập đội bóng",
        href: `/admin/tournaments/${t.id}/teams`,
        variant: "secondary",
        icon: Users,
        desc: "Cần 24 đội trước khi bốc thăm.",
      };
    case "draw_in_progress":
      return {
        label: "Tiếp tục bốc thăm",
        href: `/admin/tournaments/${t.id}/draw`,
        variant: "draw",
        icon: Shuffle,
        desc: "Mở sân khấu bốc thăm đang dở.",
      };
    case "draw_completed":
      return {
        label: "Xem kết quả",
        href: `/admin/tournaments/${t.id}/draw`,
        variant: "primary",
        icon: Sparkles,
        desc: "Đã phân 24 đội vào 6 bảng.",
      };
    case "group_stage":
      return {
        label: "Vòng bảng",
        href: `/admin/tournaments/${t.id}/draw`,
        variant: "primary",
        icon: Trophy,
        desc: "Đang thi đấu vòng bảng.",
      };
    case "knockout":
      return {
        label: "Vòng loại trực tiếp",
        href: `/admin/tournaments/${t.id}/draw`,
        variant: "primary",
        icon: Trophy,
        desc: "Đang thi đấu vòng knock-out.",
      };
    case "completed":
      return {
        label: "Xem tổng kết",
        href: `/admin/tournaments/${t.id}/draw`,
        variant: "secondary",
        icon: CheckCircle2,
        desc: "Mùa giải đã kết thúc.",
      };
    default:
      return null;
  }
}

/* ───────────────────────── Page ───────────────────────── */

export default function TournamentListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: tournaments, isLoading } = useQuery(
    trpc.tournament.list.queryOptions({
      includeArchived: true,
      includeDeleted: true,
    })
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.tournament.list.queryKey() });
  };

  const copyMut = useMutation(
    trpc.tournament.copy.mutationOptions({
      onSuccess: (data: { id: string; name: string }) => {
        toast.success(`Đã sao chép thành "${data.name}"`);
        invalidate();
        router.push(`/admin/tournaments/${data.id}`);
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const archiveMut = useMutation(
    trpc.tournament.archive.mutationOptions({
      onSuccess: () => {
        toast.success("Đã lưu trữ.");
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const restoreMut = useMutation(
    trpc.tournament.restore.mutationOptions({
      onSuccess: () => {
        toast.success("Đã khôi phục từ lưu trữ.");
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const deleteMut = useMutation(
    trpc.tournament.softDelete.mutationOptions({
      onSuccess: () => {
        toast.success("Đã xoá giải đấu.");
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const restoreDeletedMut = useMutation(
    trpc.tournament.restoreDeleted.mutationOptions({
      onSuccess: () => {
        toast.success("Đã khôi phục từ thùng rác.");
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const renameMut = useMutation(
    trpc.tournament.rename.mutationOptions({
      onSuccess: () => {
        toast.success("Đã đổi tên.");
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const handleCopy = (id: string) => copyMut.mutate({ id });
  const handleArchive = (id: string, name: string) => {
    if (!window.confirm(`Lưu trữ giải đấu "${name}"?`)) return;
    archiveMut.mutate({ id });
  };
  const handleRestore = (id: string) => restoreMut.mutate({ id });
  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Xoá giải đấu "${name}"?\n\nDữ liệu vẫn được lưu và có thể khôi phục từ menu ⋯.`))
      return;
    deleteMut.mutate({ id });
  };
  const handleRestoreDeleted = (id: string) => restoreDeletedMut.mutate({ id });
  const handleRename = (id: string, currentName: string) => {
    const next = window.prompt("Đổi tên giải đấu", currentName);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentName) return;
    renameMut.mutate({ id, name: trimmed });
  };

  const activeList = (tournaments ?? []).filter((t) => !t.deletedAt && !t.archivedAt);
  const archivedList = (tournaments ?? []).filter((t) => t.archivedAt && !t.deletedAt);
  const deletedList = (tournaments ?? []).filter((t) => t.deletedAt);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ─── Header ─── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="cn-section-title">Quản trị</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Giải Đấu
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý các mùa giải. Tạo mới, nhập đội và bốc thăm.
          </p>
        </div>
        <Link href="/admin/tournaments/new">
          <Button size="default" className="font-bold">
            <Plus className="mr-1.5 h-4 w-4" />
            Tạo Giải Mới
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeList.length === 0 && archivedList.length === 0 && deletedList.length === 0 ? (
        /* ── Empty state ── */
        <Card className="border-2 border-dashed bg-gradient-to-br from-primary/5 via-card to-primary/5">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-2 ring-primary/30">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              Bắt đầu mùa giải đầu tiên
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Tạo giải đấu, nhập 24 đội bóng, bốc thăm chia bảng. Chỉ cần 3 bước.
            </p>
            <Link href="/admin/tournaments/new" className="mt-6">
              <Button size="lg" className="px-8 font-bold shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-5 w-5" />
                Tạo Giải Đấu
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* ── Active tournaments ── */}
          <Section
            title="Đang hoạt động"
            count={activeList.length}
            emptyHint="Chưa có giải đấu nào. Bấm Tạo Giải Mới ở trên."
            isEmpty={activeList.length === 0}
          >
            {activeList.map((t) => (
              <TournamentRow
                key={t.id}
                t={t}
                onCopy={handleCopy}
                onRename={handleRename}
                onArchive={handleArchive}
                onDelete={handleDelete}
                getPrimaryAction={getPrimaryAction}
              />
            ))}
          </Section>

          {/* ── Archived ── */}
          {archivedList.length > 0 && (
            <Section
              title="Đã lưu trữ"
              count={archivedList.length}
              isEmpty={false}
            >
              {archivedList.map((t) => (
                <TournamentRow
                  key={t.id}
                  t={t}
                  onCopy={handleCopy}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                  getPrimaryAction={getPrimaryAction}
                />
              ))}
            </Section>
          )}

          {/* ── Deleted ── */}
          {deletedList.length > 0 && (
            <Section
              title="Đã xoá"
              count={deletedList.length}
              isEmpty={false}
            >
              {deletedList.map((t) => (
                <TournamentRow
                  key={t.id}
                  t={t}
                  onCopy={handleCopy}
                  onRestoreDeleted={handleRestoreDeleted}
                  getPrimaryAction={getPrimaryAction}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Section wrapper ───────────────────────── */

function Section({
  title,
  count,
  children,
  isEmpty,
  emptyHint,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyHint?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-extrabold tracking-tight">
          {title}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      </div>
      {isEmpty && emptyHint ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <div className="grid gap-3">{children}</div>
      )}
    </section>
  );
}

/* ───────────────────────── Tournament row ───────────────────────── */

interface TournamentRowProps {
  t: {
    id: string;
    name: string;
    startDate: Date | string;
    status: string;
    archivedAt?: Date | string | null;
    deletedAt?: Date | string | null;
    closedAt?: Date | string | null;
    isPublic?: boolean;
  };
  onCopy: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onArchive?: (id: string, name: string) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string, name: string) => void;
  onRestoreDeleted?: (id: string) => void;
  getPrimaryAction: (t: { id: string; status: string }) => {
    label: string;
    href: string;
    variant: "draw" | "primary" | "secondary";
    icon: typeof Sparkles;
    desc: string;
  } | null;
}

function TournamentRow({
  t,
  onCopy,
  onRename,
  onArchive,
  onRestore,
  onDelete,
  onRestoreDeleted,
  getPrimaryAction,
}: TournamentRowProps) {
  const router = useRouter();
  const meta = STATUS_META[t.status as Status];
  const action = getPrimaryAction({ id: t.id, status: t.status });
  const isDeleted = !!t.deletedAt;
  const isArchived = !!t.archivedAt;
  const isInDraw = t.status === "draw_in_progress";
  const formattedDate = new Date(t.startDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <Card
      className={cn(
        "cn-card-hover relative overflow-hidden",
        isInDraw && "border-warning/50 shadow-lg shadow-warning/10",
        isDeleted && "opacity-60"
      )}
    >
      {/* Status accent stripe */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isInDraw
            ? "bg-warning"
            : isDeleted
            ? "bg-destructive"
            : isArchived
            ? "bg-muted-foreground"
            : meta?.tone === "success"
            ? "bg-success"
            : meta?.tone === "primary"
            ? "bg-primary"
            : meta?.tone === "info"
            ? "bg-info"
            : "bg-muted-foreground/40"
        )}
      />

      <CardContent className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {/* Group letter avatar */}
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-display text-xl font-black shadow-md ring-2",
              isInDraw
                ? "from-warning to-warning/70 text-warning-foreground shadow-warning/30 ring-warning/40"
                : isDeleted
                ? "from-destructive to-destructive/70 text-destructive-foreground ring-destructive/40"
                : meta?.tone === "success"
                ? "from-success to-success/70 text-success-foreground ring-success/40"
                : "from-primary to-primary/70 text-primary-foreground shadow-primary/20 ring-primary/30"
            )}
            title={t.name}
          >
            {t.name.charAt(0).toUpperCase()}
          </div>

          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-base font-extrabold tracking-tight sm:text-lg">
                {t.name}
              </h3>
              {isInDraw && (
                <span className="flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-warning-foreground uppercase">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
                  </span>
                  Live
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {meta && (
                <Badge
                  variant="outline"
                  className={cn("font-mono text-[10px] uppercase", TONE_BADGE[meta.tone])}
                >
                  {meta.label}
                </Badge>
              )}
              <span className="text-muted-foreground">
                Khởi tranh {formattedDate}
              </span>
              {isArchived && (
                <Badge variant="outline" className="text-[10px]">
                  <Archive className="mr-1 h-3 w-3" />
                  Lưu trữ
                </Badge>
              )}
              {isDeleted && (
                <Badge variant="outline" className="text-[10px]">
                  <X className="mr-1 h-3 w-3" />
                  Đã xoá
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right: primary action + more menu */}
        <div className="flex items-center gap-2 sm:shrink-0">
          {action && !isDeleted && !isArchived && (
            <Link href={action.href as `/admin/tournaments/${string}/draw`}>
              <Button
                size="default"
                className={cn(
                  "font-bold",
                  action.variant === "draw" &&
                    "bg-warning text-warning-foreground shadow-lg shadow-warning/30 hover:bg-warning/90 animate-pulse-glow",
                  action.variant === "primary" && "shadow-md shadow-primary/20",
                  action.variant === "secondary" && ""
                )}
                title={action.desc}
              >
                <action.icon className="mr-1.5 h-4 w-4" />
                {action.label}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          )}

          {/* Restore button for archived */}
          {isArchived && onRestore && (
            <Button
              size="default"
              variant="outline"
              onClick={() => onRestore(t.id)}
              className="font-bold"
            >
              <ArchiveRestore className="mr-1.5 h-4 w-4" />
              Khôi phục
            </Button>
          )}

          {/* Restore button for deleted */}
          {isDeleted && onRestoreDeleted && (
            <Button
              size="default"
              variant="outline"
              onClick={() => onRestoreDeleted(t.id)}
              className="font-bold"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Khôi phục
            </Button>
          )}

          {/* Kebab menu — secondary actions */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hành động khác"
                  className="text-muted-foreground hover:text-foreground"
                />
              }
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {!isDeleted && !isArchived && (
                <>
                  <DropdownMenuItem
                    onClick={() => router.push(`/admin/tournaments/${t.id}`)}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Chi tiết
                  </DropdownMenuItem>
                  {onRename && (
                    <DropdownMenuItem onClick={() => onRename(t.id, t.name)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Đổi tên
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onCopy(t.id)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Sao chép
                  </DropdownMenuItem>
                  {onArchive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onArchive(t.id, t.name)}>
                        <Archive className="mr-2 h-4 w-4" />
                        Lưu trữ
                      </DropdownMenuItem>
                    </>
                  )}
                  {onDelete && t.status === "completed" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(t.id, t.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xoá
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
              {isArchived && (
                <DropdownMenuItem onClick={() => onCopy(t.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Sao chép
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
