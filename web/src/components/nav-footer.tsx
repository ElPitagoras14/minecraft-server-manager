"use client";

import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogOut, User2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { signOut } from "next-auth/react";

export function NavFooter() {
  const { data } = useSession();
  const { user: { name = "", isAdmin = false } = {} } = data || {};
  const { state } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center space-x-2 justify-between">
          <div className="flex items-center flex-row space-x-2">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground rounded-sm p-1.5">
              <User2 className="h-5 w-5" />
            </div>
            {state === "expanded" && (
              <div className="flex flex-col">
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? "Administrator" : "User"}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () =>
              await signOut({
                redirectTo: "/login",
              })
            }
          >
            <LogOut />
          </Button>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
