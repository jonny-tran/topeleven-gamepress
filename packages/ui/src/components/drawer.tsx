import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "@topEleven-gamepress/ui/lib/utils";
import * as React from "react";

/* ─────────────────────────────────────────────────────────────────────────────
 * Drawer – dùng cho admin sidebar trên mobile (Sheet pattern)
 * ════════════════════════════════════════════════════════════════════════════ */

function Drawer({
  modal = true,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root data-slot="drawer" modal={modal} {...props}>
      {children}
    </DrawerPrimitive.Root>
  );
}

function DrawerTrigger({
  className,
  render,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return (
    <DrawerPrimitive.Trigger
      data-slot="drawer-trigger"
      className={cn("cursor-default", className)}
      render={render}
      {...props}
    />
  );
}

function DrawerBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Backdrop>) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-all",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DrawerPanel({
  className,
  side = "left",
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Popup> & { side?: "left" | "right" }) {
  return (
    <DrawerPrimitive.Popup
      data-slot="drawer-panel"
      data-side={side}
      className={cn(
        "fixed z-50 flex flex-col bg-background shadow-xl",
        "inset-y-0 w-64",
        side === "left" && "left-0 border-r",
        side === "right" && "right-0 border-l",
        "transition-transform duration-300 ease-out",
        "data-[state=open]:translate-x-0",
        side === "left" && "data-[state=closed]:-translate-x-full",
        side === "right" && "data-[state=closed]:translate-x-full",
        className,
      )}
      {...props}
    />
  );
}

function DrawerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex items-center justify-between border-b px-4 py-3", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-content"
      className={cn("flex-1 overflow-y-auto p-4", className)}
      {...props}
    />
  );
}

function DrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("border-t p-4", className)}
      {...props}
    />
  );
}

function DrawerClose({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return (
    <DrawerPrimitive.Close
      data-slot="drawer-close"
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-none text-muted-foreground",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerBackdrop,
  DrawerPanel,
  DrawerHeader,
  DrawerTitle,
  DrawerContent,
  DrawerFooter,
  DrawerClose,
};
