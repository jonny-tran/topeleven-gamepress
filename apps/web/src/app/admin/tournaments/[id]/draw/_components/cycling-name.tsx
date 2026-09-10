"use client";
import { useEffect, useState } from "react";

interface CyclingProps {
  /** Teams to cycle through while drawing. */
  candidates: Array<{ id: string; name: string; associationCode: string }>;
  /** Whether cycling should be active. */
  active: boolean;
  /** Interval (ms) between cycles. Smaller = faster. */
  intervalMs?: number;
}

/**
 * Hiển thị một "roulette" các team name xoay vòng — dùng để tạo cảm giác
 * xáo trộn ngẫu nhiên trước khi reveal đội được chọn.
 *
 * Sử dụng CSS transition + setInterval, không phụ thuộc thư viện animation.
 */
export default function CyclingName({
  candidates,
  active,
  intervalMs = 70,
}: CyclingProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || candidates.length === 0) return;
    setIndex(0);
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % candidates.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, candidates.length, intervalMs]);

  if (!active || candidates.length === 0) return null;

  const current = candidates[index];
  if (!current) return null;

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground uppercase">
        Đang bốc…
      </p>
      <div
        key={`${active ? "active" : "idle"}-${current.id}`}
        className="mt-4 flex h-48 items-center justify-center"
      >
        <p className="text-center font-mono font-bold text-7xl tracking-tight text-foreground sm:text-8xl">
          {current.name}
        </p>
      </div>
      <p className="mt-3 font-mono text-lg text-muted-foreground">
        {current.associationCode}
      </p>
    </div>
  );
}
