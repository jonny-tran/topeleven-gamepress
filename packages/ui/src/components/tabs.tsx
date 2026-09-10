import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@topEleven-gamepress/ui/lib/utils";
import * as React from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * Tabs
 * ════════════════════════════════════════════════════════════════════════════ */

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex items-center justify-center gap-0 border-b",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex items-center justify-center whitespace-nowrap px-4 py-2.5 text-xs font-medium transition-all",
        "text-muted-foreground",
        "border-b-2 border-transparent",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:opacity-50",
        // Active: primary underline
        "data-selected:text-foreground data-selected:border-b-2 data-selected:border-primary",
        className,
      )}
      {...props}
    />
  );
}

function TabsIndicator({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Indicator>) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        "absolute bottom-0 z-10 h-[2px] bg-primary transition-all duration-200",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("mt-4 flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsPanel };
