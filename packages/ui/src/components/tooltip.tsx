import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@topEleven-gamepress/ui/lib/utils";
import * as React from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * Tooltip – dùng cho icon-only buttons, gợi ý trạng thái
 * ════════════════════════════════════════════════════════════════════════════ */

function TooltipProvider({ children, ...props }: React.ComponentProps<"div">) {
  return (
    <TooltipPrimitive.Provider {...props}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      className={cn("cursor-default", className)}
      {...props}
    />
  );
}

function TooltipPopup({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={6}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-popup"
          className={cn(
            "z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

function TooltipArrow({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Arrow>) {
  return (
    <TooltipPrimitive.Arrow
      data-slot="tooltip-arrow"
      className={cn("fill-popover", className)}
      {...props}
    />
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipPopup, TooltipArrow };
