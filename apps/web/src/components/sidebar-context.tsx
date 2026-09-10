"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SidebarContextValue {
  collapsed: boolean;
  hidden: boolean;
  toggle: () => void;
  setHidden: (hidden: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  hidden: false,
  toggle: () => {},
  setHidden: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  return (
    <SidebarContext.Provider value={{ collapsed, hidden, toggle, setHidden }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
