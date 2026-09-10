"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@topEleven-gamepress/ui/lib/utils";

interface DrawSlotProps {
  /** Teams to spin through. The last one in the array is the winning team. */
  teams: Array<{ id: string; name: string; associationCode: string }>;
  /** When true, start the spinning animation. */
  active: boolean;
  /** When false, freeze and show the last team (winner). */
  spin: boolean;
}

/**
 * Slot-machine style roulette for the draw ceremony.
 *
 * - While `spin === true`: cycles through candidates rapidly with a vertical scroll.
 * - When `spin` flips to false: decelerates and lands on the LAST team in the array.
 * - Visual: vertical window with top/bottom gradient masks, center spotlight, gold guidelines.
 */
export default function DrawSlot({
  teams,
  active,
  spin,
}: DrawSlotProps) {
  const [highlightIdx, setHighlightIdx] = useState(0);

  // ── Fast cycling phase ──
  useEffect(() => {
    if (!active || !spin) return;
    setHighlightIdx(0);
    const id = setInterval(() => {
      setHighlightIdx((i) => (i + 1) % Math.max(teams.length, 1));
    }, 75);
    return () => clearInterval(id);
  }, [active, spin, teams.length]);

  // ── Reveal phase: when spin is false, show the winning team (last) ──
  useEffect(() => {
    if (!active) return;
    if (spin) return;
    setHighlightIdx(teams.length - 1);
  }, [active, spin, teams.length]);

  if (!active || teams.length === 0) return null;

  const winner = teams[teams.length - 1];
  const current = teams[highlightIdx] ?? teams[0];

  return (
    <div className="relative w-full max-w-md">
      {/* Outer frame with gold trim */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-card via-primary/5 to-card shadow-2xl shadow-primary/20">
        {/* Top header strip */}
        <div className="flex items-center justify-center gap-2 border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 px-6 py-3">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <p className="font-display text-sm font-bold tracking-[0.25em] text-primary uppercase">
            {spin ? "Đang bốc…" : "Đã chọn xong"}
          </p>
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        </div>

        {/* Slot window */}
        <div className="relative h-[260px] overflow-hidden bg-gradient-to-b from-card/40 via-primary/5 to-card/40">
          {/* Top gradient mask */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-card via-card/80 to-transparent" />
          {/* Bottom gradient mask */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-card via-card/80 to-transparent" />
          {/* Center spotlight line */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y-2 border-primary/50 bg-primary/5 shadow-[0_0_30px_rgba(255,200,0,0.3)]" />
          {/* Side gold accents */}
          <div className="pointer-events-none absolute left-0 top-1/2 z-30 h-12 w-1 -translate-y-1/2 bg-gradient-to-b from-transparent via-primary to-transparent" />
          <div className="pointer-events-none absolute right-0 top-1/2 z-30 h-12 w-1 -translate-y-1/2 bg-gradient-to-b from-transparent via-primary to-transparent" />

          {/* Cycling list — vertically scrolling */}
          <div
            className={cn(
              "absolute inset-x-0 flex flex-col items-center transition-transform duration-150",
              spin ? "ease-linear" : "ease-out duration-500"
            )}
            style={{
              transform: `translateY(calc(50% - ${(highlightIdx + 0.5) * 56}px))`,
            }}
          >
            {teams.map((t, i) => {
              const isHighlight = i === highlightIdx;
              const distance = Math.abs(i - highlightIdx);
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex h-14 items-center justify-center transition-all duration-150",
                    isHighlight
                      ? "scale-110 opacity-100"
                      : distance === 1
                      ? "scale-95 opacity-50"
                      : "scale-90 opacity-20"
                  )}
                >
                  <p
                    className={cn(
                      "truncate px-6 text-center font-display font-bold tracking-tight",
                      isHighlight
                        ? "text-4xl text-foreground drop-shadow-[0_2px_8px_rgba(255,200,0,0.5)] sm:text-5xl"
                        : "text-2xl text-muted-foreground"
                    )}
                  >
                    {t.name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom strip — code + winner badge */}
        <div className="flex items-center justify-between border-t border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-3">
          <span className="font-mono text-base font-bold text-primary">
            {current.associationCode}
          </span>
          {!spin && winner && (
            <div className="flex items-center gap-1.5 rounded-full bg-success/20 px-3 py-1 text-xs font-bold text-success">
              <Sparkles className="h-3 w-3" />
              ĐỘI ĐƯỢC CHỌN
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
