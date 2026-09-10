"use client";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

interface GroupScoreboardProps {
  groupCode: string;
  teams: Array<{
    name: string;
    associationCode: string;
    position: number;
  }>;
  compact?: boolean;
}

/**
 * Scoreboard-style hiển thị một bảng đấu:
 * - Group letter ở giữa kiểu số áo cầu thủ (circle badge lớn).
 * - 4 vị trí hiển thị dạng mini-row với số thứ tự + tên đội + mã liên đoàn.
 * - Vị trí trống hiển thị placeholder gạch ngang + "—" để rõ là chưa có đội.
 */
export default function GroupScoreboard({
  groupCode,
  teams,
  compact = false,
}: GroupScoreboardProps) {
  const slots = [1, 2, 3, 4];
  const filledCount = teams.length;
  const isComplete = filledCount >= 4;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 bg-card transition-all",
        isComplete
          ? "border-success/40 shadow-lg shadow-success/10"
          : "border-border shadow-sm"
      )}
    >
      {/* Top color stripe */}
      <div
        className={cn(
          "h-1.5 w-full",
          isComplete ? "bg-success" : "bg-gradient-to-r from-primary/60 via-primary to-primary/60"
        )}
      />

      <div className={cn("flex flex-col", compact ? "gap-1.5 p-2.5" : "gap-2 p-3")}>
        {/* Group letter badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 font-display font-black text-primary-foreground shadow-md shadow-primary/30 ring-2 ring-primary/20",
                compact ? "h-7 w-7 text-sm" : "h-9 w-9 text-base"
              )}
            >
              {groupCode}
            </div>
            <div className="flex flex-col leading-tight">
              <span
                className={cn(
                  "font-display font-extrabold tracking-tight",
                  compact ? "text-xs" : "text-sm"
                )}
              >
                BẢNG {groupCode}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {filledCount}/4 đội
              </span>
            </div>
          </div>
          {isComplete && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] font-bold text-success">
              ✓ XONG
            </span>
          )}
        </div>

        {/* 4 position slots */}
        <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5")}>
          {slots.map((pos) => {
            const t = teams.find((tm) => tm.position === pos);
            return (
              <div
                key={pos}
                className={cn(
                  "flex items-center gap-2 rounded-md border transition-all",
                  t
                    ? "border-border bg-secondary/30"
                    : "border-dashed border-border/40 bg-muted/20",
                  compact ? "px-2 py-1" : "px-2.5 py-1.5"
                )}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-full font-display font-black tabular-nums",
                    t
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground/50",
                    compact ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs"
                  )}
                >
                  {pos}
                </span>
                {t ? (
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate font-bold leading-tight",
                        compact ? "text-[11px]" : "text-xs"
                      )}
                      title={t.name}
                    >
                      {t.name}
                    </p>
                    <p className="font-mono text-[9px] leading-tight text-muted-foreground">
                      {t.associationCode}
                    </p>
                  </div>
                ) : (
                  <span className="text-[11px] italic text-muted-foreground/50">
                    — chờ —
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
