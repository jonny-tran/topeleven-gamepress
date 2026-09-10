"use client";
import { useEffect, useRef, useState } from "react";

interface ConfettiProps {
  /** Kích hoạt khi show=true. Khi show chuyển từ true→false cũng reset. */
  show: boolean;
}

/**
 * Confetti rơi từ trên xuống — 40 mảnh giấy màu rơi ngẫu nhiên.
 * Dùng CSS animation, tự dọn dẹp khi tắt.
 */
export default function Confetti({ show }: ConfettiProps) {
  const [pieces, setPieces] = useState<
    Array<{ id: number; left: number; delay: number; duration: number; color: string; rotate: number }>
  >([]);

  useEffect(() => {
    if (!show) {
      setPieces([]);
      return;
    }
    const colors = [
      "oklch(0.72 0.18 155)", // primary
      "oklch(0.78 0.17 75)", // warning
      "oklch(0.6 0.18 245)", // info
      "oklch(0.58 0.2 290)", // violet
      "oklch(0.6 0.22 25)", // rose
    ];
    const next = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 1.4,
      color: colors[i % colors.length] ?? colors[0]!,
      rotate: Math.random() * 360,
    }));
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 3500);
    return () => clearTimeout(t);
  }, [show]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 block h-3 w-2"
          style={{
            left: `${p.left}%`,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
