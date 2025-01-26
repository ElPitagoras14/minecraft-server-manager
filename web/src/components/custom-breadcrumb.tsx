"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "./ui/breadcrumb";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";
import Link from "next/link";
import React from "react";
import { indexedRoutes } from "@/route-definitions";

interface CustomBreadCrumbProps {
  dynamicItems?: {
    label: string;
    url?: string;
  }[];
}

export default function CustomBreadcrumb({
  dynamicItems = [],
}: CustomBreadCrumbProps) {
  const pathname = usePathname();
  const parts = pathname
    .split("/")
    .filter((part) => part !== "" && part !== "app");
  const levels = parts.reduce<string[]>((acc, part, index) => {
    const currentPath = `/${parts.slice(0, index + 1).join("/")}`;
    acc.push(currentPath);
    return acc;
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b-2">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {levels.map((level: string, index: number) => {
              const info = indexedRoutes[level];
              const { label, url, isMenu } = info || {};
              if (index >= levels.length - Math.max(dynamicItems.length, 1)) {
                if (dynamicItems.length === 0) {
                  return (
                    <BreadcrumbItem key={index}>
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    </BreadcrumbItem>
                  );
                }

                const idx =
                  index - (levels.length - Math.max(dynamicItems.length, 1));
                const { label: dynamicLabel, url } = dynamicItems[idx];
                return (
                  <BreadcrumbItem key={index}>
                    {url ? (
                      <Link
                        href={url}
                        className="transition-colors hover:text-foreground"
                      >
                        {dynamicLabel}
                      </Link>
                    ) : (
                      <BreadcrumbPage>{dynamicLabel}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                );
              }
              if (!isMenu) {
                return (
                  <React.Fragment key={index}>
                    <BreadcrumbItem>
                      <Link
                        href={url}
                        className="transition-colors hover:text-foreground"
                      >
                        {label}
                      </Link>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-muted-foreground">
                      {label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
