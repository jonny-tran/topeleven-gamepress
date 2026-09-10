"use client";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

interface JerseyCardProps {
  index: number;
  name: string;
  associationCode: string;
  pot: number;
  highlighted?: boolean;
  dimmed?: boolean;
}

/**
 * Team "jersey" card – hiển thị một đội trong pot hiện tại.
 * Mỗi pot có màu sắc riêng (amber / blue / violet / emerald) để phân biệt
 * trực quan ngay lập tức. Layout gợi áo đấu với số thứ tự + tên đội + mã
 * liên đoàn.
 *
 * - `highlighted`: đội đang được focus trong cycling animation
 * - `dimmed`: đội xung đột liên đoàn (hiển thị mờ + viền cảnh báo)
 */
export default function JerseyCard({
  index,
  name,
  associationCode,
  pot,
  highlighted = false,
  dimmed = false,
}: JerseyCardProps) {
  return (
    <div
      className={cn(
        "group relative flex items-stretch overflow-hidden rounded-lg border transition-all duration-200",
        // Base look
        "bg-card shadow-sm",
        // Highlighted
        highlighted &&
          "border-primary shadow-md shadow-primary/30 ring-2 ring-primary/40 scale-[1.02]",
        // Dimmed (xung đột)
        dimmed && "opacity-50 grayscale",
        // Default hover
        !highlighted &&
          !dimmed &&
          "hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
      )}
    >
      {/* Jersey stripe (pot color) */}
      <div
        className={cn(
          "flex w-10 shrink-0 flex-col items-center justify-center font-display font-black",
          `pot-${pot}`
        )}
      >
        <span className="font-mono text-[10px] font-bold leading-none opacity-80">
          P{pot}
        </span>
        <span className="mt-0.5 text-lg leading-none">{index + 1}</span>
      </div>

      {/* Team info */}
      <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
        <p className="truncate text-sm font-bold leading-tight">{name}</p>
        <p className="font-mono text-[10px] leading-tight text-muted-foreground">
          {associationCode}
        </p>
      </div>

      {/* Vertical accent stripe on right edge */}
      <div
        className={cn(
          "w-1 shrink-0",
          `pot-${pot}`,
          "opacity-40 group-hover:opacity-70"
        )}
      />
    </div>
  );
}
