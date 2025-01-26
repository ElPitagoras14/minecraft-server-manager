"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "./ui/sidebar";

export function ThemeToogle({ className }: Readonly<{ className?: string }>) {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();

  if (state === "collapsed") {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className={cn("relative", className)}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] dark:rotate-0 dark:scale-100 transition-all -rotate-90 scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] dark:rotate-90 dark:scale-0 transition-all rotate-0 scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
