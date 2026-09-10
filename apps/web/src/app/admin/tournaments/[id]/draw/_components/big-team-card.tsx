"use client";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

interface BigTeamCardProps {
  label: string;
  teamName?: string;
  associationCode?: string;
  coachName?: string;
  destination?: string;
  pending?: boolean;
  reason?: string;
}

/**
 * Card lớn hiển thị đội vừa bốc — dành cho live stream.
 * Text cỡ lớn, contrast cao, có animation khi vừa xuất hiện.
 */
export default function BigTeamCard({
  label,
  teamName,
  associationCode,
  coachName,
  destination,
  pending = false,
  reason,
}: BigTeamCardProps) {
  if (pending) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">{label}</p>
        <p className="mt-3 font-mono text-sm text-muted-foreground">Đang xử lý…</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-4 zoom-in-95 relative overflow-hidden rounded-2xl border-2 border-primary/30 p-5 shadow-xl shadow-primary/20 duration-500",
        "bg-gradient-to-br from-primary/10 via-card to-primary/5"
      )}
    >
      <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">{label}</p>
      <p className="mt-2 text-center font-display font-extrabold text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
        {teamName ?? "—"}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
        {associationCode && (
          <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-secondary-foreground">
            {associationCode}
          </span>
        )}
        {coachName && (
          <span className="text-muted-foreground">
            HLV: <span className="font-medium text-foreground">{coachName}</span>
          </span>
        )}
      </div>
      {destination && (
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-primary/20 pt-3">
          <span className="text-xl text-primary">→</span>
          <p className="font-display text-xl font-bold sm:text-2xl">{destination}</p>
        </div>
      )}
      {reason && (
        <p className="mt-2 text-center text-xs text-muted-foreground italic">{reason}</p>
      )}
    </div>
  );
}
