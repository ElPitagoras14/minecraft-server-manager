import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { FormLabel } from "../ui/form";
import { useState } from "react";

interface FormTooltipProps {
  info: string | undefined;
  label: string;
  isDirty: boolean;
}

export default function CustomFormLabel({
  info,
  label,
  isDirty,
}: FormTooltipProps) {
  const [open, setOpen] = useState<boolean>(false);

  if (!info)
    return (
      <FormLabel>
        {label} {isDirty && "*"}
      </FormLabel>
    );

  return (
    <div className="flex items-end space-x-2 py-1">
      <FormLabel>{label} {isDirty && "*"}</FormLabel>
      <TooltipProvider>
        <Tooltip open={open}>
          <TooltipTrigger
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <Info className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{info}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
