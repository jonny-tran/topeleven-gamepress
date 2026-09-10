import { cn } from "@topEleven-gamepress/ui/lib/utils";
import * as React from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * Badge – pill status chip cho trạng thái giải đấu, pot, bảng, v.v.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Variants:
 *   default   – nền muted, chữ muted-foreground (mặc định)
 *   primary   – nền primary nhạt, chữ primary
 *   secondary – nền secondary, chữ secondary-foreground
 *   success   – nền success nhạt, chữ success
 *   warning   – nền warning nhạt, chữ warning
 *   destructive – nền destructive nhạt, chữ destructive
 *   outline   – viền, nền trong suốt
 *
 * Sizes: default | sm
 * ─────────────────────────────────────────────────────────────────────────── */

const badgeVariants = {
  default:
    "border-transparent bg-muted text-muted-foreground",
  primary:
    "border-transparent bg-primary/12 text-primary dark:bg-primary/20",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground",
  success:
    "border-transparent bg-success/12 text-success dark:bg-success/20",
  warning:
    "border-transparent bg-warning/12 text-warning dark:bg-warning/20",
  destructive:
    "border-transparent bg-destructive/12 text-destructive dark:bg-destructive/20",
  outline:
    "border-border bg-transparent text-foreground",
} as const;

const badgeSizes = {
  default: "h-5 px-2 text-[11px] font-medium leading-none",
  sm: "h-4 px-1.5 text-[10px] font-medium leading-none",
} as const;

type BadgeVariant = keyof typeof badgeVariants;
type BadgeSize = keyof typeof badgeSizes;

function Badge({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"span"> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
}) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium leading-none tracking-wide transition-colors",
        badgeVariants[variant],
        badgeSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants, type BadgeVariant, type BadgeSize };
