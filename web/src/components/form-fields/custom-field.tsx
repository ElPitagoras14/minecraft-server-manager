import { FieldInfo } from "@/utils/interfaces";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "../ui/input";
import { UseFormReturn } from "react-hook-form";
import ControlAutocomplete from "./control-autocomplete";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ControlSelect from "./control-select";
import CustomFormLabel from "./custom-form-label";

interface CustomFieldProps {
  fieldInfo: FieldInfo;
  formContext: UseFormReturn;
  className?: string;
  disabled?: boolean;
  isUpdate?: boolean;
}

export default function CustomField({
  fieldInfo,
  formContext,
  className,
  disabled,
  isUpdate,
}: CustomFieldProps) {
  const { name, label, placeholder, type, fetchOptions, info } =
    fieldInfo || {};
  const { data: session } = useSession() || {};
  const { user: { token = "" } = {} } = session || {};

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (fetchOptions && token) {
      setIsLoading(true);
      (async () => {
        const options = await fetchOptions(token);
        fieldInfo.options = options;
        setIsLoading(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOptions, token]);

  if (isLoading) {
    return (
      <FormItem className={className}>
        <CustomFormLabel
          info={info}
          label={label}
          isDirty={isUpdate && formContext.formState.dirtyFields[name]}
        />
        <FormControl>
          <Input
            type="text"
            placeholder="Cargando..."
            className="w-full"
            disabled
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )
  };

  if (type === "autocomplete") {
    return (
      <FormField
        control={formContext.control}
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            <CustomFormLabel
              info={info}
              label={label}
              isDirty={isUpdate && formContext.formState.dirtyFields[name]}
            />
            <ControlAutocomplete
              options={fieldInfo.options!}
              formValue={field.value}
              initValue={fieldInfo.initValue as string}
              setFormValue={(value: string) =>
                formContext.setValue(name, value, { shouldDirty: true })
              }
              disabled={disabled}
            ></ControlAutocomplete>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  if (type === "select") {
    return (
      <FormField
        control={formContext.control}
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            <CustomFormLabel
              info={info}
              label={label}
              isDirty={isUpdate && formContext.formState.dirtyFields[name]}
            />
            <ControlSelect
              options={fieldInfo.options!}
              formValue={field.value}
              initValue={fieldInfo.initValue as string}
              onFormValueChange={field.onChange}
              setFormValue={(value: string) =>
                formContext.setValue(name, value, { shouldDirty: true })
              }
              disabled={disabled}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  return (
    <FormField
      control={formContext.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <CustomFormLabel
            info={info}
            label={label}
            isDirty={isUpdate && formContext.formState.dirtyFields[name]}
          />
          <FormControl>
            <Input
              {...field}
              value={field.value}
              type={type}
              placeholder={placeholder}
              className="w-full"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
