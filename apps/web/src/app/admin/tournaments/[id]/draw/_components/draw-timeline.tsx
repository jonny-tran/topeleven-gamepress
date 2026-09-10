"use client";
import { Trophy } from "lucide-react";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

interface DrawTimelineProps {
  entries: Array<{
    name: string;
    associationCode: string;
    groupCode: string;
    position: number;
  }>;
}

/**
 * Timeline dọc cho lịch sử bốc thăm – gợi cảm giác "match events":
 * - Đường line dọc ở giữa kết nối các event.
 * - Mỗi event là 1 dot + chip màu (group + position) + tên đội.
 * - Event mới nhất nằm trên cùng, có hiệu ứng nổi bật.
 */
export default function DrawTimeline({ entries }: DrawTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
        <Trophy className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground/60 italic">
          Chưa có lượt bốc nào.
        </p>
        <p className="text-[10px] text-muted-foreground/40">
          Các đội được bốc sẽ hiện ở đây.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-y-auto pr-1">
      {/* Vertical timeline line */}
      <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />

      <ol className="relative flex flex-col gap-2 py-1">
        {entries.map((entry, idx) => {
          const isLatest = idx === 0;
          return (
            <li
              key={`${entry.name}-${idx}`}
              className={cn(
                "group relative flex items-start gap-2.5 rounded-lg border bg-card/50 pl-1 pr-2.5 py-2 transition-all",
                isLatest
                  ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border/60 hover:border-primary/30 hover:bg-card"
              )}
            >
              {/* Timeline dot */}
              <div className="relative flex shrink-0 items-center justify-center pl-0.5 pt-0.5">
                <div
                  className={cn(
                    "relative h-3 w-3 rounded-full ring-2 ring-card",
                    isLatest
                      ? "bg-primary"
                      : "bg-muted-foreground/30 group-hover:bg-primary/60"
                  )}
                >
                  {isLatest && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold",
                      isLatest
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {entry.groupCode}·{entry.position}
                  </span>
                  <span
                    className={cn(
                      "truncate font-bold leading-tight",
                      isLatest ? "text-sm" : "text-xs"
                    )}
                    title={entry.name}
                  >
                    {entry.name}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {entry.associationCode}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
