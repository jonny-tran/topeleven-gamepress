"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RefreshCw,
  Swords,
  Undo2,
} from "lucide-react";
import { trpc, getErrorMessage } from "@/utils/trpc";

import { Button } from "@topEleven-gamepress/ui/components/button";
import { Badge } from "@topEleven-gamepress/ui/components/badge";
import { cn } from "@topEleven-gamepress/ui/lib/utils";
import { useSidebar } from "@/components/sidebar-context";

import CyclingName from "./_components/cycling-name";
import Confetti from "./_components/confetti";
import BigTeamCard from "./_components/big-team-card";
import GroupCell from "./_components/group-cell";

const GROUP_CODES = ["A", "B", "C", "D", "E", "F"] as const;

interface Props {
  params: Promise<{ id: string }>;
}

interface SkipEntry {
  name: string;
  association: string;
  reason: string;
}

interface DrawnEntry {
  name: string;
  associationCode: string;
  groupCode: string;
  position: number;
}

export default function DrawPage({ params }: Props) {
  const { id: tournamentId } = use(params);
  const queryClient = useQueryClient();
  const {
    collapsed: sidebarCollapsed,
    hidden: sidebarHidden,
    toggle: toggleSidebar,
    setHidden: setSidebarHidden,
  } = useSidebar();
  const [fullscreen, setFullscreen] = useState(false);

  // Đồng bộ sidebar với fullscreen state trong useEffect (chạy SAU render)
  // để tránh lỗi "Cannot update a component while rendering a different component".
  // - fullscreen = true  → ẩn sidebar hoàn toàn (kể cả nút toggle)
  // - fullscreen = false → hiện sidebar lại; nếu đang collapsed thì expand
  useEffect(() => {
    if (fullscreen && !sidebarHidden) {
      setSidebarHidden(true);
    } else if (!fullscreen && sidebarHidden) {
      setSidebarHidden(false);
      if (sidebarCollapsed) toggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  const toggleFullscreen = () => {
    setFullscreen((prev) => !prev);
  };

  // Bốc thăm state — chỉ persist history ở client, không lưu DB
  const [skipLog, setSkipLog] = useState<SkipEntry[]>([]);
  const [drawnHistory, setDrawnHistory] = useState<DrawnEntry[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  /**
   * `displayedGroupCode` là bảng UI đang hiển thị trên panel RIGHT — tách biệt
   * khỏi `state.currentGroupCode` của server. Khi server tự động advance sang
   * bảng kế sau khi đủ 4 đội, client vẫn giữ bảng cũ cho đến khi admin chủ
   * động bấm nút "TIẾP TỤC BẢNG MỚI".
   */
  const [displayedGroupCode, setDisplayedGroupCode] = useState<string | null>(null);
  const [drawnDisplayMap, setDrawnDisplayMap] = useState<Record<string, Array<{ name: string; associationCode: string; groupCode: string; position: number }>>>({});

  // Polling draw state từ server
  const { data: drawState, isLoading } = useQuery({
    ...trpc.draw.getState.queryOptions({ tournamentId }),
    refetchInterval: 2000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.draw.getState.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.tournament.getById.queryKey() });
  };

  const autoPick = useMutation(
    trpc.draw.autoPick.mutationOptions({
      onSuccess: (
        result: {
          success: boolean;
          error?: string | null;
          drawnTeam?: { name: string; associationCode: string; groupCode: string; position: number } | null;
          isComplete?: boolean;
          skipped?: string[];
          state?: { currentGroupCode: string; currentPot: number };
        }
      ) => {
        if (!result.success) {
          toast.error(result.error ?? "Bốc thăm thất bại");
        } else if (result.drawnTeam) {
          const t = result.drawnTeam;
          // Ghi vào history
          setDrawnHistory((prev) => [
            ...prev,
            {
              name: t.name,
              associationCode: t.associationCode,
              groupCode: t.groupCode,
              position: t.position,
            },
          ]);
          // Đẩy đội vừa bốc vào drawnDisplayMap để panel RIGHT hiển thị đúng
          // ngay cả khi server đã advance sang bảng mới.
          setDrawnDisplayMap((prev) => {
            const list = prev[t.groupCode] ?? [];
            // Tránh duplicate nếu server đã ghi vào state.groups rồi.
            const exists = list.some(
              (x) => x.position === t.position && x.name === t.name,
            );
            if (exists) return prev;
            return {
              ...prev,
              [t.groupCode]: [...list, t],
            };
          });
          // Log skipped teams (nếu có)
          if (result.skipped && result.skipped.length > 0) {
            setSkipLog((prev) => [
              ...prev,
              ...result.skipped!.map((s) => ({
                name: s,
                association: s,
                reason: `Xung đột liên đoàn với đội đã có trong Bảng ${t.groupCode}`,
              })),
            ]);
          }
          // Confetti khi hoàn tất
          if (result.isComplete) {
            setShowConfetti(true);
            toast.success("🎉 Bốc thăm hoàn tất!", { duration: 4000 });
          } else {
            toast.success(
              `Bốc: ${t.name} → Bảng ${t.groupCode} · vị trí ${t.position}`,
              { duration: 2500 }
            );
          }
        }
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const shufflePot = useMutation(
    trpc.draw.shufflePot.mutationOptions({
      onSuccess: (data: { teams: Array<{ id: string; name: string; associationCode: string }> }) => {
        setShuffledTeams(data.teams);
      },
    })
  );

  const confirmDraw = useMutation(
    trpc.draw.confirmDraw.mutationOptions({
      onSuccess: () => {
        toast.success("Bốc thăm đã xác nhận! Đã tạo lịch thi đấu.");
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const resetDraw = useMutation(
    trpc.draw.resetDraw.mutationOptions({
      onSuccess: () => {
        toast.success("Đã đặt lại bốc thăm.");
        setSkipLog([]);
        setDrawnHistory([]);
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const undoLastDraw = useMutation(
    trpc.draw.undoLastDraw.mutationOptions({
      onSuccess: (
        result: {
          success: boolean;
          undoneTeam?: {
            id: string;
            name: string;
            associationCode: string;
            groupCode: string;
            position: number;
            pot: number;
          };
        }
      ) => {
        const u = result.undoneTeam;
        if (u) {
          // Gỡ đội ra khỏi lịch sử bốc + display map
          setDrawnHistory((prev) => {
            // Tìm index cuối cùng có cùng name+groupCode để tránh xoá nhầm
            // trong trường hợp trùng tên hiếm gặp.
            let lastIdx = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i]!.name === u.name && prev[i]!.groupCode === u.groupCode) {
                lastIdx = i;
                break;
              }
            }
            if (lastIdx === -1) return prev;
            return [...prev.slice(0, lastIdx), ...prev.slice(lastIdx + 1)];
          });
          setDrawnDisplayMap((prev) => {
            const list = prev[u.groupCode] ?? [];
            return {
              ...prev,
              [u.groupCode]: list.filter((x) => x.position !== u.position),
            };
          });
          // Nếu undo trả về đúng bảng đang hiển thị thì cũng reset
          // displayedGroupCode để effect đồng bộ lấy lại vị trí server.
          if (displayedGroupCode === u.groupCode) {
            // không reset ngay, để useEffect tự xử lý
          }
          toast.success(
            `Đã hoàn tác: ${u.name} (Bảng ${u.groupCode} · vị trí ${u.position})`,
            { duration: 2500 },
          );
        }
        invalidate();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err)),
    })
  );

  const [shuffledTeams, setShuffledTeams] = useState<
    Array<{ id: string; name: string; associationCode: string }>
  >([]);

  // Cờ đánh dấu đang fill nguyên Bảng F (silent). Khi cờ này true, UI sẽ
  // không hiển thị cycling animation cho F — thay vào đó hiển thị "Hoàn tất".
  const [isFillingLastGroup, setIsFillingLastGroup] = useState(false);

  const fillLastGroup = useMutation(
    trpc.draw.fillLastGroup.mutationOptions({
      onSuccess: (result: { success: boolean; drawn?: Array<{ id: string; name: string; associationCode: string; position: number }> }) => {
        if (result.success) {
          // Cập nhật lịch sử + display map cho Bảng F để UI render ngay
          // đầy đủ 4 đội mà không cần đợi polling tiếp theo.
          setDrawnHistory((prev) => [
            ...prev,
            ...(result.drawn ?? []).map((t) => ({
              name: t.name,
              associationCode: t.associationCode,
              groupCode: "F",
              position: t.position,
            })),
          ]);
          setDrawnDisplayMap((prev) => ({
            ...prev,
            F: (result.drawn ?? []).map((t) => ({
              name: t.name,
              associationCode: t.associationCode,
              groupCode: "F",
              position: t.position,
            })),
          }));
          setShowConfetti(true);
          toast.success("🎉 Bốc thăm hoàn tất!", { duration: 4000 });
        }
        setIsFillingLastGroup(false);
        invalidate();
      },
      onError: (err: unknown) => {
        setIsFillingLastGroup(false);
        toast.error(getErrorMessage(err));
      },
    })
  );

  // Auto-shuffle / auto-pick logic
  useEffect(() => {
    if (!drawState || drawState.isComplete) return;
    if (!drawState.canProceed) return;

    const isLastGroup = drawState.currentGroupCode === "F";
    if (isLastGroup) {
      // Bảng F: skip toàn bộ UI cycling, fill nguyên bảng trong 1 lần gọi.
      // Tránh gọi lặp lại khi effect re-run giữa lúc đang pending.
      if (!fillLastGroup.isPending && !isFillingLastGroup) {
        setIsFillingLastGroup(true);
        fillLastGroup.mutate({ tournamentId });
      }
      return;
    }

    shufflePot.mutate({ tournamentId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawState?.currentPot, drawState?.currentGroupCode]);

  // Đồng bộ `displayedGroupCode` với `state.currentGroupCode`:
  // - Lần đầu load (displayedGroupCode === null): set theo server.
  // - Khi user đã chuyển sang bảng mới (displayedGroupCode khớp server trước đó
  //   và server đã advance tiếp): KHÔNG tự động đuổi theo, giữ nguyên bảng cũ.
  // - Khi user vừa bấm "TIẾP TỤC BẢNG MỚI" và `displayedGroupCode` đã bằng
  //   `currentGroupCode` hiện tại: effect này chỉ no-op.
  useEffect(() => {
    if (!drawState) return;
    if (displayedGroupCode === null) {
      setDisplayedGroupCode(drawState.currentGroupCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawState?.currentGroupCode]);

  if (isLoading || !drawState || displayedGroupCode === null) {
    return (
      <div className="flex h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải trạng thái bốc thăm…</p>
        </div>
      </div>
    );
  }

  const state = drawState;
  // Khi đang fill Bảng F (silent), UI cũng phải treat như complete để ẩn
  // toàn bộ cycling animation và hiển thị "Hoàn tất".
  const isComplete = state.isComplete || isFillingLastGroup;
  const completedSteps = state.completedSteps;
  const totalSteps = state.totalSteps;
  const progressPct = (completedSteps / totalSteps) * 100;

  // Tournament-level fields needed for reset guard
  const tournamentStatus = state.tournamentStatus ?? "setup";
  const isTournamentPublic = state.isPublic ?? false;
  // Cho phép reset khi bốc thăm đã hoàn tất (24 đội đã phân bảng) nhưng giải chưa
  // được xác nhận (chưa tạo lịch) và chưa công khai.
  const canResetAfterComplete =
    state.isComplete && !isTournamentPublic && tournamentStatus !== "draw_completed";

  // ── Bảng UI đang hiển thị trên panel RIGHT ──
  // Kết hợp dữ liệu từ server (`state.groups`) với override client-side
  // (`drawnDisplayMap`) để các đội vừa bốc hiển thị đầy đủ kể cả khi server
  // đã advance sang bảng kế.
  const serverGroupTeams = (state.groups[displayedGroupCode] ?? []) as unknown as Array<{
    name: string;
    associationCode: string;
    groupCode: string;
    position: number;
  }>;
  const clientOverrideTeams = drawnDisplayMap[displayedGroupCode] ?? [];
  const displayedGroupTeams = [...serverGroupTeams];
  for (const ov of clientOverrideTeams) {
    if (!displayedGroupTeams.some((t) => t.position === ov.position)) {
      displayedGroupTeams.push(ov);
    }
  }
  displayedGroupTeams.sort((a, b) => a.position - b.position);
  const displayedGroupFull = displayedGroupTeams.length >= 4;
  // Server đã advance sang bảng mới nhưng user vẫn chưa bấm "Tiếp tục"
  const isWaitingForNextGroup =
    !isComplete &&
    displayedGroupCode !== state.currentGroupCode &&
    displayedGroupFull;

  const lastDrawn = drawnHistory[drawnHistory.length - 1];
  const isPicking = autoPick.isPending;
  const showCycling = isPicking && state.validTeamsForCurrentGroup.length > 0;

  return (
    <div
      className={cn(
        "min-h-svh bg-background transition-all",
        fullscreen ? "px-6 py-4" : "px-4 py-6 sm:px-6 lg:px-8"
      )}
    >
      <Confetti show={showConfetti} />

      <div
        className={cn(
          "space-y-6",
          fullscreen
            ? "px-2 py-2"
            : "mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
        )}
      >
        {/* ─── Top Status Bar ─── */}
        <header className={cn("cn-admin-header", !fullscreen && "-mx-4 -mt-6 sm:-mx-6 lg:-mx-8")}>
          <div className="flex items-center gap-3">
            <Link href={`/admin/tournaments/${tournamentId}`}>
              <Button variant="ghost" size="icon-sm" aria-label="Quay lại">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            {/* LIVE badge */}
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1 ring-1 ring-destructive/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive"></span>
              </span>
              <span className="font-mono text-[11px] font-bold tracking-widest text-destructive uppercase">
                Live
              </span>
            </div>

            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-xs text-muted-foreground">Bốc Thăm</span>
              <span className="font-display text-base font-bold">
                {isComplete ? "Hoàn tất" : `Bảng ${state.currentGroupCode} · Pot ${state.currentPot}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={fullscreen ? "default" : "outline"}
              size="sm"
              onClick={toggleFullscreen}
              title={fullscreen ? "Thoát chế độ phóng to" : "Phóng to / thu nhỏ"}
            >
              {fullscreen ? (
                <>
                  <Minimize2 className="mr-1.5 h-4 w-4" />
                  Thu nhỏ
                </>
              ) : (
                <>
                  <Maximize2 className="mr-1.5 h-4 w-4" />
                  Phóng to
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Hoàn tác lượt bốc cuối?\n\nĐội gần nhất sẽ được trả về Pot ban đầu. Bạn có thể bấm BỐC THĂM lại để thử kết quả khác.\n\nNếu vẫn kẹt, bấm Hoàn tác thêm lần nữa hoặc dùng Đặt lại để bốc từ đầu.",
                  )
                ) {
                  undoLastDraw.mutate({ tournamentId });
                }
              }}
              disabled={
                undoLastDraw.isPending ||
                isComplete ||
                completedSteps === 0
              }
              title="Hoàn tác lượt bốc cuối cùng"
            >
              <Undo2 className="mr-1.5 h-4 w-4" />
              Hoàn tác
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Đặt lại bốc thăm?\n\nTất cả phân bảng sẽ bị xóa. Bạn có thể bốc thăm lại từ đầu.",
                  )
                ) {
                  resetDraw.mutate({ tournamentId });
                }
              }}
              disabled={resetDraw.isPending || (!canResetAfterComplete && !isComplete && completedSteps === 0)}
              className={cn(
                "text-muted-foreground",
                canResetAfterComplete && "text-destructive hover:text-destructive"
              )}
              title={
                canResetAfterComplete
                  ? "Đặt lại bốc thăm để bốc lại từ đầu"
                  : isTournamentPublic
                  ? "Không thể đặt lại: giải đấu đã công khai"
                  : undefined
              }
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Đặt lại
            </Button>
          </div>
        </header>

        {/* ─── Hero: Current Step ─── */}
        <section
          className={cn(
            "rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 px-6 py-5 shadow-lg shadow-primary/5 sm:px-8 sm:py-6",
            !isComplete && "ring-2 ring-primary/30"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <p className="cn-section-title">Giai đoạn</p>
              {isComplete ? (
                <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Hoàn Tất
                </h1>
              ) : (
                <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  <span className="text-primary">Bảng {state.currentGroupCode}</span>
                  <span className="mx-2 text-muted-foreground/40">·</span>
                  <span>Pot {state.currentPot}</span>
                </h1>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <p className="cn-section-title">Tiến độ</p>
              <p className="cn-stat-number text-2xl font-bold sm:text-3xl">
                <span className="text-primary">{completedSteps}</span>
                <span className="text-muted-foreground/40">/</span>
                <span>{totalSteps}</span>
              </p>
            </div>
          </div>

          {/* Progress bar — làm to + rõ để dễ theo dõi khi đang bốc */}
          <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-secondary shadow-inner">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-end text-xs text-muted-foreground">
            <span>
              {completedSteps} / {totalSteps} lượt bốc
            </span>
          </div>
        </section>

        {/* ─── 3-Column Draw Stage ─── */}
        {!isComplete ? (
          <div className="grid items-stretch gap-4 lg:grid-cols-6 lg:gap-6">
            {/* ── LEFT: Pot hiện tại + Lịch sử bốc thăm (2/6) ── */}
            <aside className="flex h-[460px] flex-col gap-3 lg:h-[480px] lg:col-span-2">
              {/* Pot panel — co lại theo nội dung */}
              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="cn-section-title">Pot {state.currentPot}</p>
                  <Badge variant="primary">{shuffledTeams.length}</Badge>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Danh sách đội khả dụng (đã shuffle)
                </p>
                {shuffledTeams.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {shuffledTeams.map((t, idx) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-lg border bg-secondary/30 px-2.5 py-1.5 text-sm"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-mono font-bold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="truncate">{t.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div
                        key={i}
                        className="h-9 animate-pulse rounded-lg border border-dashed bg-muted/30"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Lịch sử bốc thăm — chiếm phần còn lại */}
              <div className="flex min-h-0 flex-1 flex-col rounded-2xl border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="cn-section-title">Lịch sử bốc thăm</p>
                  {drawnHistory.length > 0 && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {drawnHistory.length}
                    </Badge>
                  )}
                </div>
                {drawnHistory.length > 0 ? (
                  <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {drawnHistory
                      .slice(-12)
                      .reverse()
                      .map((d, i) => (
                        <div
                          key={`${d.name}-${i}`}
                          className="flex items-center gap-2.5 rounded border bg-card/50 px-2.5 py-2 text-sm"
                        >
                          <Badge variant="success" className="shrink-0 px-1.5 py-0 text-[10px]">
                            {d.groupCode}·{d.position}
                          </Badge>
                          <span className="truncate font-medium">{d.name}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground/60 italic">
                    Chưa có lượt bốc nào.
                  </div>
                )}
              </div>
            </aside>

            {/* ── CENTER: Khung bốc thăm (3/6 = 1/2) ── */}
            <section className="lg:col-span-3">
              <div className="flex h-full flex-col">
                {/* Stage card — chiều cao cố định để không nhảy khi cycling */}
                <div className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-2xl shadow-primary/5 h-[460px] lg:h-[480px]">
                  {/* Cycling overlay */}
                  {showCycling && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/95 backdrop-blur-sm">
                      <CyclingName
                        candidates={state.validTeamsForCurrentGroup}
                        active={showCycling}
                      />
                      <p className="mt-4 font-display text-xl font-bold text-primary">
                        Đang chọn đội…
                      </p>
                    </div>
                  )}

                  {/* Vừa bốc xong → reveal big card */}
                  {lastDrawn && !isPicking && (
                    <div className="flex flex-1 items-center justify-center px-6 py-6 overflow-hidden">
                      <BigTeamCard
                        label="⚽ VỪA BỐC"
                        teamName={lastDrawn.name}
                        associationCode={lastDrawn.associationCode}
                        destination={`Bảng ${lastDrawn.groupCode} · Vị trí ${lastDrawn.position}/4`}
                      />
                    </div>
                  )}

                  {/* Lần đầu vào chưa bốc gì */}
                  {!lastDrawn && !showCycling && (
                    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                      <Swords className="h-20 w-20 text-primary/60" />
                      <p className="mt-4 text-2xl font-bold">Sẵn sàng bốc thăm</p>
                      <p className="mt-2 max-w-md text-sm text-muted-foreground">
                        Nhấn <strong>BỐC THĂM</strong> bên dưới để chọn ngẫu nhiên một đội từ{" "}
                        <strong>Pot {state.currentPot}</strong> cho{" "}
                        <strong>Bảng {state.currentGroupCode}</strong>.
                      </p>
                    </div>
                  )}

                  {/* ── Nút BỐC THĂM ở đáy khung ── */}
                  <div className="border-t border-primary/20 bg-card/50 p-5">
                    {!state.canProceed && state.currentGroupCode !== "F" ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-center text-sm font-medium text-warning-foreground">
                          <strong>Không thể bốc:</strong> tất cả đội còn lại trong Pot{" "}
                          {state.currentPot} đều cùng liên đoàn với đội đã có trong Bảng{" "}
                          {state.currentGroupCode}.
                        </div>
                        {completedSteps > 0 && (
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                              if (
                                confirm(
                                  "Hoàn tác lượt bốc cuối để mở khoá?\n\nĐội gần nhất sẽ được trả về Pot ban đầu. Sau đó bấm BỐC THĂM để thử lại.",
                                )
                              ) {
                                undoLastDraw.mutate({ tournamentId });
                              }
                            }}
                            disabled={undoLastDraw.isPending}
                            className="h-12 w-full text-base font-bold"
                          >
                            <Undo2 className="mr-2 h-5 w-5" />
                            {undoLastDraw.isPending ? "Đang hoàn tác…" : "Hoàn Tác Lượt Cuối"}
                          </Button>
                        )}
                      </div>
                    ) : isWaitingForNextGroup ? (
                      /* Đã đầy bảng hiện tại + server đã advance sang bảng mới:
                         disable nút BỐC THĂM, hiển thị nút TIẾP TỤC để user
                         chủ động chuyển sang bảng mới. */
                      <div className="space-y-3">
                        <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-center text-sm font-bold text-success">
                          ✓ Bảng {displayedGroupCode} đã đủ 4 đội
                        </div>
                        <Button
                          size="lg"
                          onClick={() => {
                            setDisplayedGroupCode(state.currentGroupCode);
                            setDrawnDisplayMap((prev) => {
                              const next = { ...prev };
                              delete next[displayedGroupCode];
                              return next;
                            });
                          }}
                          className="h-14 w-full text-xl font-black tracking-wide"
                        >
                          <ArrowLeft className="mr-2 h-6 w-6 rotate-180" />
                          TIẾP TỤC BẢNG {state.currentGroupCode}
                        </Button>
                      </div>
                    ) : state.currentGroupCode !== "F" ? (
                      <Button
                        size="lg"
                        onClick={() => autoPick.mutate({ tournamentId })}
                        disabled={!state.canProceed || isPicking || isWaitingForNextGroup}
                        className="h-14 w-full text-xl font-black tracking-wide"
                      >
                        {isPicking ? (
                          <>
                            <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
                            ĐANG BỐC…
                          </>
                        ) : (
                          <>
                            <Swords className="mr-2 h-6 w-6" />
                            BỐC THĂM
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-primary/5 p-4 text-sm font-medium text-primary">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Hệ thống đang tự động điền Bảng F — Pot {state.currentPot}
                      </div>
                    )}
                  </div>
                </div>

                {/* Thông tin lần bốc tiếp theo */}
                {state.canProceed && state.currentGroupCode !== "F" && (
                  <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
                    Lần bốc tiếp theo sẽ thêm vào vị trí{" "}
                    <span className="font-display text-base font-bold text-foreground">
                      {state.currentPosition}/4
                    </span>{" "}
                    trong Bảng {state.currentGroupCode}
                  </p>
                )}
              </div>
            </section>

            {/* ── RIGHT: Bảng đấu hiện tại (1/6) — chiều cao bằng khung bốc ── */}
            <aside className="lg:col-span-1">
              <div className="flex h-[460px] flex-col rounded-2xl border bg-card p-5 lg:h-[480px]">
                <div className="mb-4 flex items-center justify-between">
                  <p className="cn-section-title">Bảng {displayedGroupCode}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono",
                      displayedGroupFull && "border-success text-success"
                    )}
                  >
                    {displayedGroupTeams.length}/4
                  </Badge>
                </div>
                <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
                  {[1, 2, 3, 4].map((pos) => {
                    const t = displayedGroupTeams.find((t) => t.position === pos);
                    return (
                      <div
                        key={pos}
                        className={cn(
                          "flex flex-1 items-center gap-3 rounded-lg border p-3",
                          t ? "bg-secondary/30" : "border-dashed bg-muted/30"
                        )}
                      >
                        <span className="cn-stat-number w-6 text-center text-base font-bold text-muted-foreground">
                          {pos}
                        </span>
                        {t ? (
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{t.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {t.associationCode}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground/60 italic">
                            Trống
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* ─── COMPLETE STATE ─── */
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border-2 border-success/40 bg-gradient-to-br from-success/10 via-card to-success/5 p-10 text-center shadow-2xl shadow-success/10">
              <div className="absolute top-4 right-4">
                <Badge variant="success" className="text-sm">HOÀN TẤT</Badge>
              </div>
              <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
              <h2 className="mt-4 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
                Bốc Thăm Hoàn Tất
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                24 đội đã được phân vào 6 bảng.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Xác nhận để tạo lịch thi đấu vòng bảng.
              </p>
              <Button
                size="lg"
                className="mt-6 text-base font-bold"
                onClick={() => confirmDraw.mutate({ tournamentId })}
                disabled={confirmDraw.isPending}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                {confirmDraw.isPending ? "Đang tạo lịch…" : "Xác Nhận & Tạo Lịch Thi Đấu"}
              </Button>
              {canResetAfterComplete && (
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-4 ml-3 text-base font-bold border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (
                      confirm(
                        "Đặt lại bốc thăm?\n\nTất cả phân bảng sẽ bị xóa. Bạn có thể bốc thăm lại từ đầu.",
                      )
                    ) {
                      resetDraw.mutate({ tournamentId });
                    }
                  }}
                  disabled={resetDraw.isPending}
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  {resetDraw.isPending ? "Đang đặt lại…" : "Đặt Lại Bốc Thăm"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ─── All Groups Grid ─── */}
        <section className="overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
          {/* Header strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card/50 px-5 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/30">
                <LayoutGrid className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="cn-section-title">Sân đấu</p>
                <p className="font-display text-base font-extrabold tracking-tight">
                  Tất Cả Bảng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Progress mini */}
              <div className="flex items-center gap-2 rounded-full border bg-background/60 px-2.5 py-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Tiến độ
                </span>
                <span className="font-display text-sm font-bold tabular-nums">
                  <span className="text-primary">{completedSteps}</span>
                  <span className="text-muted-foreground/40">/</span>
                  <span>{totalSteps}</span>
                </span>
              </div>
              <Badge variant="primary" className="font-mono text-[10px]">
                {Math.round((completedSteps / totalSteps) * 100)}%
              </Badge>
            </div>
          </div>

          {/* Subtle pitch background */}
          <div className="bg-pitch-stripes p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {GROUP_CODES.map((code) => (
                <GroupCell
                  key={code}
                  code={code}
                  teams={state.groups[code] ?? []}
                  isCurrent={!isComplete && code === state.currentGroupCode}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
