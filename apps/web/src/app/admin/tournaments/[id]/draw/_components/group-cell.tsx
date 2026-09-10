"use client";
import { Check, Lock } from "lucide-react";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

interface GroupCellProps {
  code: string;
  teams: Array<{ id: string; name: string; pot: number; position: number; associationCode: string }>;
  isCurrent?: boolean;
  highlight?: boolean;
}

/**
 * Ô bảng đấu theo phong cách scoreboard sân vận động.
 *
 * Cấu trúc:
 *  - Top color stripe: xanh emerald cho bảng đang bốc, xanh success cho bảng đầy,
 *    xám cho bảng chưa bắt đầu.
 *  - Header: chữ cái bảng to trong circle badge + counter 0/4.
 *  - 4 slot: số áo cầu thủ (jersey number) tròn bên trái + tên đội + mã liên đoàn.
 *  - Slot trống có icon `Lock` mờ + đường kẻ dashed — gợi cảm giác "ghế trống".
 */
export default function GroupCell({ code, teams, isCurrent, highlight }: GroupCellProps) {
  const slots = [1, 2, 3, 4];
  const filledCount = teams.length;
  const isComplete = filledCount >= 4;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border-2 bg-card transition-all duration-300",
        // Đang bốc (current) → glow primary
        isCurrent && "border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/20",
        // Bảng đầy → success
        !isCurrent && isComplete && "border-success/50 shadow-md shadow-success/10",
        // Bảng chưa bắt đầu
        !isCurrent && !isComplete && "border-border",
        // Highlight mà không phải current
        highlight && !isCurrent && "border-primary/40"
      )}
    >
      {/* Top color stripe */}
      <div
        className={cn(
          "h-1 w-full",
          isCurrent
            ? "bg-gradient-to-r from-primary/60 via-primary to-primary/60"
            : isComplete
            ? "bg-success"
            : "bg-muted-foreground/20"
        )}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          {/* Group letter badge (jersey style) */}
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-black shadow-md ring-2",
              isCurrent
                ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-primary/30 ring-primary/30"
                : isComplete
                ? "bg-gradient-to-br from-success to-success/70 text-success-foreground shadow-success/30 ring-success/30"
                : "bg-muted text-muted-foreground ring-border"
            )}
          >
            {code}
          </div>
          <div className="flex flex-col leading-tight">
            <span
              className={cn(
                "font-display text-[10px] font-extrabold tracking-[0.1em] uppercase",
                isCurrent
                  ? "text-primary"
                  : isComplete
                  ? "text-success-foreground"
                  : "text-muted-foreground"
              )}
            >
              Bảng {code}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground">
              {filledCount}/4 đội
            </span>
          </div>
        </div>

        {/* Status indicator */}
        {isCurrent ? (
          <span className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest text-primary uppercase">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live
          </span>
        ) : isComplete ? (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest text-success-foreground uppercase">
            <Check className="h-2.5 w-2.5" />
            Xong
          </span>
        ) : null}
      </div>

      {/* Slots */}
      <div className="space-y-1 px-2 pb-2">
        {slots.map((pos) => {
          const team = teams.find((t) => t.position === pos);
          const isFilled = !!team;

          return (
            <div
              key={pos}
              className={cn(
                "group relative flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all",
                isFilled
                  ? "border-border bg-secondary/20 hover:border-primary/40 hover:bg-secondary/40"
                  : "border-dashed border-border/30 bg-muted/10"
              )}
            >
              {/* Jersey number */}
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-black tabular-nums ring-1",
                  isFilled
                    ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground ring-primary/30"
                    : "bg-muted text-muted-foreground/40 ring-border/40"
                )}
              >
                {pos}
              </span>

              {team ? (
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[11px] font-bold leading-tight"
                    title={team.name}
                  >
                    {team.name}
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[9px] leading-tight text-muted-foreground">
                    <span
                      className={cn(
                        "rounded px-1 text-[8px] font-bold",
                        team.pot === 1 && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                        team.pot === 2 && "bg-info/15 text-info-foreground",
                        team.pot === 3 && "bg-violet-500/15 text-violet-700 dark:text-violet-300",
                        team.pot === 4 && "bg-primary/15 text-primary"
                      )}
                    >
                      P{team.pot}
                    </span>
                    <span>{team.associationCode}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center gap-1.5">
                  <Lock className="h-3 w-3 text-muted-foreground/30" />
                  <span className="text-[10px] italic text-muted-foreground/40">
                    chờ bốc
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Subtle corner glow for current group */}
      {isCurrent && (
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
      )}
    </div>
  );
}
