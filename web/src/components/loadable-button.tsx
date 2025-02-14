"use client";

import { useState } from "react";
import { Icons } from "./ui/icons";
import { Button } from "./ui/button";

interface LoadableIconProps {
  label: string;
  func: () => Promise<void>;
  classname?: string;
}

export default function LoadableButton({
  label,
  func,
  classname,
}: LoadableIconProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFunc = async () => {
    try {
      setIsLoading(true);
      await func();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={async () => await handleFunc()} className={classname}>
      {isLoading && <Icons.spinner className="animate-spin h-5 w-5" />}
      {label}
    </Button>
  );
}
