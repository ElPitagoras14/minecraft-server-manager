"use client";

import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Layers } from "lucide-react";
import { ThemeToogle } from "./theme-toggle";

export function NavHeader() {
  const { state } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center space-x-2 justify-between">
          <div className="flex items-center flex-row space-x-2">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground rounded-sm p-1.5">
              <Layers className="h-5 w-5" />
            </div>
            {state === "expanded" && (
              <div className="flex flex-col">
                <p className="text-sm font-semibold">MC Manager</p>
                <p className="text-xs text-muted-foreground">Server Manager</p>
              </div>
            )}
          </div>
          {state === "expanded" && <ThemeToogle />}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
