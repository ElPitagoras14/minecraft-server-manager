import { X } from "lucide-react";
import { FormControl } from "../ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ComboboxItem } from "@/utils/interfaces";

interface ControlSelectProps {
  options: ComboboxItem[];
  formValue: string;
  onFormValueChange: (value: string) => void;
  setFormValue: (value: string) => void;
  disabled?: boolean;
}

export default function ControlSelect({
  options,
  formValue,
  onFormValueChange,
  setFormValue,
  disabled,
}: ControlSelectProps) {
  return (
    <div className="flex flex-row items-center justify-center space-x-2">
      <Select value={formValue} onValueChange={onFormValueChange}>
        <FormControl>
          <SelectTrigger disabled={disabled}>
            <SelectValue></SelectValue>
          </SelectTrigger>
        </FormControl>
        <SelectContent className="w-96 max-h-72">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
