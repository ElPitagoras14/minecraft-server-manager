"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { Button } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { FormControl } from "../ui/form";
import { ComboboxItem } from "@/utils/interfaces";

interface ComboboxProps {
  options: ComboboxItem[];
  formValue: string;
  setFormValue: (value: string) => void;
  disabled?: boolean;
}

export default function ControlAutocomplete({
  options,
  formValue,
  setFormValue,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  const handleSelect = (value: string) => {
    setFormValue(value);
    setOpen(false);
    setSearch("");
  };

  const filteredItems = options.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-row items-center justify-center space-x-2">
      <Popover open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              className="flex flex-row justify-between w-full"
              disabled={disabled}
            >
              {formValue && (
                <div className="flex flex-row items-center justify-start w-full">
                  {options.find((item) => item.value === formValue)?.label}
                </div>
              )}
              <span></span>
              <ChevronsUpDown className="opacity-50 self-end" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="p-0 h-52">
          <Command shouldFilter={false}>
            <CommandInput
              tabIndex={0}
              value={search}
              onValueChange={(value) => setSearch(value)}
              placeholder="Buscar item..."
            />
            <CommandList>
              <CommandEmpty>No hay resultados.</CommandEmpty>
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    onSelect={(currentValue) => handleSelect(currentValue)}
                  >
                    {item.label}
                    {formValue === item.value && (
                      <Check
                        className={cn(
                          "ml-auto",
                          formValue === item.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {formValue && !disabled && (
        <X
          className="opacity-50 hover:opacity-100 hover:cursor-pointer h-5 w-5"
          onClick={() => {
            setFormValue("");
          }}
        />
      )}
    </div>
  );
}
