"use client";

import { useState } from "react";
import { Icons } from "./ui/icons";
import { cn } from "@/lib/utils";

interface LoadableIconProps {
  icon: React.ReactNode;
  func: () => Promise<void>;
  classname?: string;
}

export default function LoadableIcon({
  icon,
  func,
  classname,
}: LoadableIconProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (isLoading) {
    return <Icons.spinner className={cn("animate-spin h-5 w-5", classname)} />;
  }

  const handleFunc = async () => {
    try {
      setIsLoading(true);
      await func();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={async () => await handleFunc()}
      className={cn("flex items-center justify-center", classname)}
    >
      {icon}
    </button>
  );
}
