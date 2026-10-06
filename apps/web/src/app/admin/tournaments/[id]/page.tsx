"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  Group,
  Pencil,
  Shuffle,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { trpc, getErrorMessage } from "@/utils/trpc";
import { Button } from "@topEleven-gamepress/ui/components/button";
import { Input } from "@topEleven-gamepress/ui/components/input";
import { Badge } from "@topEleven-gamepress/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@topEleven-gamepress/ui/components/dropdown-menu";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_META: Record<string, { label: string; tone: string; emoji: string }> = {
  setup:            { label: "Khởi tạo",       tone: "muted",     emoji: "📋" },
  draw_in_progress: { label: "Đang bốc thăm",  tone: "warning",   emoji: "🎲" },
  draw_completed:   { label: "Bốc thăm xong",  tone: "info",      emoji: "✅" },
  group_stage:      { label: "Vòng bảng",      tone: "primary",   emoji: "⚽" },
  knockout:         { label: "Loại trực tiếp", tone: "primary",   emoji: "🏆" },
  completed:        { label: "Hoàn thành",     tone: "success",   emoji: "🏁" },
};

const TONE: Record<string, string> = {
  muted: "bg-muted text-muted-foreground border-border",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  info: "bg-info/15 text-info-foreground border-info/40",
  primary: "bg-primary/15 text-primary border-primary/40",
  success: "bg-success/15 text-success-foreground border-success/40",
};

export default function TournamentDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: tournament, isLoading } = useQuery(
    trpc.tournament.getById.queryOptions({ id })
  );
  const { data: teams } = useQuery(trpc.team.list.queryOptions({ tournamentId: id }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.tournament.getById.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.tournament.list.queryKey() });
  };

  const copyMut = useMutation(
    trpc.tournament.copy.mutationOptions({
      onSuccess: (data: { id: string; name: string }) => {
        toast.success(`Đã sao chép thành "${data.name}"`);
        router.push(`/admin/tournaments/${data.id}`);
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );
  const archiveMut = useMutation(
    trpc.tournament.archive.mutationOptions({
      onSuccess: () => { toast.success("Đã lưu trữ."); invalidate(); router.push("/admin/tournaments"); },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );
  const restoreMut = useMutation(
    trpc.tournament.restore.mutationOptions({
      onSuccess: () => { toast.success("Đã khôi phục."); invalidate(); },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );
  const deleteMut = useMutation(
    trpc.tournament.softDelete.mutationOptions({
      onSuccess: () => { toast.success("Đã xoá."); invalidate(); router.push("/admin/tournaments"); },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );
  const restoreDeletedMut = useMutation(
    trpc.tournament.restoreDeleted.mutationOptions({
      onSuccess: () => { toast.success("Đã khôi phục từ thùng rác."); invalidate(); },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );
  const closeMut = useMutation(
    trpc.tournament.close.mutationOptions({
      onSuccess: () => { toast.success("Đã đóng kết thúc."); invalidate(); },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );
  const publishMut = useMutation(
    trpc.tournament.publish.mutationOptions({
      onSuccess: () => { toast.success("Đã công khai."); invalidate(); },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );
  const unpublishMut = useMutation(
    trpc.tournament.unpublish.mutationOptions({
      onSuccess: () => { toast.success("Đã ẩn khỏi trang công khai."); invalidate(); },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const renameMut = useMutation(
    trpc.tournament.rename.mutationOptions({
      onSuccess: () => {
        toast.success("Đã đổi tên.");
        setEditingName(false);
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">Không tìm thấy giải đấu.</p>
        <Link href="/admin/tournaments" className="mt-4 inline-block">
          <Button variant="outline">← Quay lại</Button>
        </Link>
      </div>
    );
  }

  const meta = STATUS_META[tournament.status] ?? { label: tournament.status, tone: "muted", emoji: "•" };
  const assignedTeams = teams?.filter((t) => t.groupId !== null).length ?? 0;
  const totalTeams = teams?.length ?? 0;
  const teamsComplete = totalTeams >= 24;

  /**
   * Server đã quyết định quyền cho trang này (xem `access.ts`): `true` khi
   * người đang xem là chủ sở hữu hoặc admin. Người xem chỉ có quyền đọc sẽ
   * không thấy các thao tác quản lý bên dưới — và nếu gọi API bằng tay thì
   * server vẫn từ chối, vì `canManage` ở đây chỉ dùng để ẩn/hiện nút.
   */
  const canManage = tournament.canManage;

  // ── Primary action theo status ──
  let primaryAction: { label: string; href: string; icon: typeof Shuffle; description: string; emphasis: boolean } | null = null;
  if (canManage && !tournament.deletedAt && !tournament.archivedAt) {
    if (tournament.status === "setup") {
      primaryAction = {
        label: teamsComplete ? "Bắt đầu bốc thăm" : `Nhập ${24 - totalTeams} đội nữa`,
        href: teamsComplete
          ? `/admin/tournaments/${id}/draw`
          : `/admin/tournaments/${id}/teams`,
        icon: teamsComplete ? Shuffle : Users,
        description: teamsComplete
          ? `Đã có ${totalTeams}/24 đội — sẵn sàng bốc thăm.`
          : `Mới có ${totalTeams}/24 đội — cần nhập thêm để bắt đầu.`,
        emphasis: teamsComplete,
      };
    } else if (tournament.status === "draw_in_progress") {
      primaryAction = {
        label: "Tiếp tục bốc thăm",
        href: `/admin/tournaments/${id}/draw`,
        icon: Shuffle,
        description: `${assignedTeams}/24 đội đã được phân bảng.`,
        emphasis: true,
      };
    } else if (tournament.status === "draw_completed") {
      primaryAction = {
        label: "Xem kết quả bốc thăm",
        href: `/admin/tournaments/${id}/draw`,
        icon: Trophy,
        description: `Đã phân 24 đội vào 6 bảng. Có thể xác nhận để tạo lịch.`,
        emphasis: false,
      };
    } else if (tournament.status === "group_stage") {
      primaryAction = {
        label: "Mở vòng bảng",
        href: `/admin/tournaments/${id}/draw`,
        icon: Trophy,
        description: "Đang thi đấu vòng bảng.",
        emphasis: false,
      };
    } else if (tournament.status === "knockout") {
      primaryAction = {
        label: "Mở vòng loại trực tiếp",
        href: `/admin/tournaments/${id}/draw`,
        icon: Trophy,
        description: "Đang thi đấu vòng knock-out.",
        emphasis: false,
      };
    }
  }

  const formattedDate = new Date(tournament.startDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Tạm ẩn các mục chưa dùng. Xoá key khỏi mảng để hiển thị lại.
  const HIDDEN_ADVANCED_TILES = ["schedule", "matches", "knockout"];

  const advancedTiles = [
    { key: "teams",     href: `/admin/tournaments/${id}/teams`,     icon: Users,         label: "Đội bóng" },
    { key: "schedule",  href: `/admin/tournaments/${id}/schedule`,  icon: Calendar,      label: "Lịch thi đấu" },
    { key: "matches",   href: `/admin/tournaments/${id}/matches`,   icon: ClipboardList, label: "Kết quả" },
    { key: "standings", href: `/admin/tournaments/${id}/standings`, icon: Group,         label: "Bảng xếp hạng" },
    { key: "knockout",  href: `/admin/tournaments/${id}/knockout`,  icon: Trophy,        label: "Loại trực tiếp" },
  ].filter((tile) => !HIDDEN_ADVANCED_TILES.includes(tile.key));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ─── Back link ─── */}
      <Link
        href="/admin/tournaments"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tất cả giải đấu
      </Link>

      {/* ─── Status banner nếu đã xoá / archived ─── */}
      {tournament.deletedAt && (
        <Banner tone="destructive">
          Giải đấu đã bị xoá mềm. Dùng nút <strong>Khôi phục</strong> ở cuối trang
          để khôi phục.
        </Banner>
      )}
      {tournament.archivedAt && !tournament.deletedAt && (
        <Banner tone="warning">
          Giải đấu đang được lưu trữ. Dùng nút <strong>Khôi phục</strong> ở cuối
          trang để đưa về danh sách hoạt động.
        </Banner>
      )}

      {/* ─── Không phải chủ giải: chỉ xem, không thao tác được ─── */}
      {!canManage && (
        <Banner tone="info">
          Bạn đang xem giải đấu công khai của ban tổ chức khác — chỉ có quyền
          xem. Muốn quản lý, hãy đăng nhập bằng tài khoản chủ sở hữu.
        </Banner>
      )}

      {/* ─── Tournament header ─── */}
      <div className="mb-6 flex items-start gap-4">
        {/* Initial badge */}
        <div
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-display text-3xl font-black shadow-lg ring-2",
            meta.tone === "warning"
              ? "from-warning to-warning/70 text-warning-foreground shadow-warning/30 ring-warning/40"
              : meta.tone === "info"
              ? "from-info to-info/70 text-info-foreground shadow-info/30 ring-info/40"
              : meta.tone === "success"
              ? "from-success to-success/70 text-success-foreground shadow-success/30 ring-success/40"
              : "from-primary to-primary/70 text-primary-foreground shadow-primary/30 ring-primary/40"
          )}
        >
          {tournament.name.charAt(0).toUpperCase()}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (nameInput.trim()) renameMut.mutate({ id, name: nameInput.trim() });
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-10 max-w-md font-display text-xl font-bold"
                autoFocus
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditingName(false);
                }}
              />
              <Button type="submit" size="sm" disabled={!nameInput.trim() || renameMut.isPending}>
                {renameMut.isPending ? "…" : "Lưu"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingName(false)}>
                Hủy
              </Button>
            </form>
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="font-display text-3xl font-extrabold tracking-tight">
                {tournament.name}
              </h1>
              {!tournament.deletedAt && canManage && (
                <button
                  onClick={() => {
                    setNameInput(tournament.name);
                    setEditingName(true);
                  }}
                  className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                  aria-label="Đổi tên"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className={cn("font-mono text-[10px] uppercase", TONE[meta.tone])}>
              {meta.emoji} {meta.label}
            </Badge>
            {!tournament.isPublic && !tournament.deletedAt && (
              <Badge variant="outline" className="text-[10px]">
                Bản nháp
              </Badge>
            )}
            {tournament.isPublic && (
              <Badge variant="outline" className="bg-success/15 text-[10px] text-success-foreground border-success/40">
                Công khai
              </Badge>
            )}
            <span className="text-muted-foreground">· Khởi tranh {formattedDate}</span>
          </div>
        </div>

        {/* Kebab menu */}
        {!tournament.deletedAt && canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hành động"
                  className="text-muted-foreground"
                />
              }
            >
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => copyMut.mutate({ id })}>
                <Copy className="mr-2 h-4 w-4" />
                Sao chép
              </DropdownMenuItem>
              {!tournament.archivedAt && tournament.status !== "completed" && (
                <>
                  <DropdownMenuSeparator />
                  {!tournament.isPublic && tournament.status !== "setup" && (
                    <DropdownMenuItem onClick={() => publishMut.mutate({ id })}>
                      <Eye className="mr-2 h-4 w-4" />
                      Công khai
                    </DropdownMenuItem>
                  )}
                  {tournament.isPublic && (
                    <DropdownMenuItem onClick={() => unpublishMut.mutate({ id })}>
                      <EyeOff className="mr-2 h-4 w-4" />
                      Ẩn khỏi trang công khai
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => closeMut.mutate({ id })}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Đóng kết thúc
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => archiveMut.mutate({ id })}>
                    <Archive className="mr-2 h-4 w-4" />
                    Lưu trữ
                  </DropdownMenuItem>
                </>
              )}
              {tournament.archivedAt && (
                <DropdownMenuItem onClick={() => restoreMut.mutate({ id })}>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Khôi phục từ lưu trữ
                </DropdownMenuItem>
              )}
              {tournament.status === "completed" && !tournament.archivedAt && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => deleteMut.mutate({ id })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xoá
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ─── Primary action card ─── */}
      {primaryAction && (
        <div
          className={cn(
            "mb-6 rounded-2xl border-2 p-6 shadow-lg",
            primaryAction.emphasis
              ? "border-warning/40 bg-gradient-to-br from-warning/15 via-card to-warning/5 shadow-warning/10"
              : "border-primary/30 bg-gradient-to-br from-primary/10 via-card to-primary/5 shadow-primary/5"
          )}
        >
          <p className="cn-section-title">Hành động chính</p>
          <p className="mt-2 text-base text-muted-foreground">
            {primaryAction.description}
          </p>
          <Link href={primaryAction.href as never} className="mt-4 inline-block">
            <Button
              size="lg"
              className={cn(
                "h-14 px-8 text-lg font-black tracking-wide shadow-lg",
                primaryAction.emphasis
                  ? "bg-warning text-warning-foreground shadow-warning/40 hover:bg-warning/90 animate-pulse-glow"
                  : "shadow-primary/30"
              )}
            >
              <primaryAction.icon className="mr-2 h-5 w-5" />
              {primaryAction.label}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ─── Standings / Groups quick access card ─── */}
      {(tournament.status === "draw_completed" || tournament.status === "group_stage" || tournament.status === "knockout" || tournament.status === "completed") && (
        <div className="mb-6 overflow-hidden rounded-2xl border-2 border-success/30 bg-gradient-to-br from-success/8 via-card to-success/5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-success/25 to-success/5 ring-2 ring-success/20 shadow-success/20">
                <Trophy className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="cn-section-title">Xem bảng đấu</p>
                <p className="font-display text-base font-bold leading-tight">
                  Theo dõi bảng xếp hạng 6 bảng
                </p>
                <p className="cn-section-title mt-0.5">
                  Cập nhật tự động sau mỗi trận hoàn thành
                </p>
              </div>
            </div>
            <Link href={`/admin/tournaments/${id}/standings`}>
              <Button size="lg" className="h-12 px-6 shadow-md shadow-success/20">
                <Group className="mr-2 h-5 w-5" />
                Mở bảng xếp hạng
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ─── Quick stats (chỉ chủ giải / admin — tránh lộ trạng thái nội bộ) ─── */}
      {canManage && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatTile label="Đội đã nhập" value={`${totalTeams}/24`} tone={teamsComplete ? "success" : "warning"} />
          <StatTile label="Đã bốc" value={`${assignedTeams}/24`} tone="primary" />
          <StatTile
            label="Công khai"
            value={tournament.isPublic ? "Có" : "Không"}
            tone={tournament.isPublic ? "success" : "muted"}
          />
        </div>
      )}

      {/* ─── Advanced (collapsed) ─── */}
      {canManage && (
      <div className="rounded-2xl border bg-card">
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm font-bold transition-colors hover:bg-muted/40"
        >
          <span className="text-muted-foreground">Tùy chọn khác</span>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {showAdvanced && (
          <div className="border-t p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Các trang quản lý chi tiết — chỉ cần khi muốn điều chỉnh thủ công.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {advancedTiles.map((tile) => (
                <Link key={tile.key} href={tile.href as never}>
                  <AdvancedTile icon={tile.icon} label={tile.label} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ─── Restore button cho deleted ─── */}
      {tournament.deletedAt && canManage && (
        <div className="mt-6">
          <Button
            size="lg"
            variant="outline"
            onClick={() => restoreDeletedMut.mutate({ id })}
            className="w-full font-bold"
          >
            <ArchiveRestore className="mr-2 h-5 w-5" />
            Khôi phục từ thùng rác
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Small UI helpers ───────────────────────── */

function Banner({
  tone,
  children,
}: {
  tone: "warning" | "destructive" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
      : tone === "warning"
      ? "border-warning/40 bg-warning/10 text-warning-foreground"
      : "border-info/40 bg-info/10 text-info-foreground";
  return (
    <div className={cn("mb-4 rounded-lg border px-4 py-3 text-sm", cls)}>
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "warning" | "success" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "border-primary/30 bg-primary/5 text-primary"
      : tone === "warning"
      ? "border-warning/40 bg-warning/5 text-warning-foreground"
      : tone === "success"
      ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
      : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className={cn("rounded-xl border p-3 text-center", cls)}>
      <p className="cn-section-title">{label}</p>
      <p className="cn-stat-number mt-1 text-xl font-bold sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function AdvancedTile({
  icon: Icon,
  label,
}: {
  icon: typeof Users;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{label}</span>
      <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
    </div>
  );
}
