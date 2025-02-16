"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Plus } from "lucide-react";
import { fields } from "./util";
import { ComboboxItem, FieldInfo } from "@/utils/interfaces";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import CustomField from "@/components/form-fields/custom-field";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import axios from "axios";
import { useState } from "react";
import { Icons } from "@/components/ui/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const createFields = fields.filter((field) => field.create);

const initialValues = createFields.reduce(
  (acc: Record<string, unknown>, field: FieldInfo) => {
    acc[field.name] = field.initValue;
    return acc;
  },
  {}
);

const validationSchema = z.object(
  createFields.reduce((acc: Record<string, z.ZodTypeAny>, field: FieldInfo) => {
    acc[field.name] = field.validation;
    return acc;
  }, {})
);

const createServer = async (
  data: z.infer<typeof validationSchema>,
  token: string,
  requesterId: string,
  requesterUser: string
) => {
  const createOptions = {
    url: `${API_URL}/servers`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      serverProperties: data,
      requesterId,
      requesterUser,
    },
  };

  const response = await axios.request(createOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

interface CreateDialogProps {
  updateData: () => Promise<void>;
  formData: {
    versions: ComboboxItem[];
  };
}

export default function CreateDialog({
  updateData,
  formData,
}: CreateDialogProps) {
  const { data: session } = useSession();
  const { user: { token = "", username = "", id = "" } = {} } = session || {};
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  createFields.find((field) => field.name === "version")!.options =
    formData.versions;

  const form = useForm<z.infer<typeof validationSchema>>({
    defaultValues: initialValues,
    resolver: zodResolver(validationSchema),
  });

  const onSubmit = form.handleSubmit(
    async (data: z.infer<typeof validationSchema>) => {
      setIsLoading(true);
      try {
        await createServer(data, token, id, username);
        form.reset();
        await updateData();
        setOpen(false);
        toast({
          title: "Server created",
          description: "It will be ready shortly.",
        });
      } catch (error: unknown) {
        console.error("error", error);
        toast({
          title: "Error",
          description: "An error occurred while creating the server.",
        });
      } finally {
        setIsLoading(false);
      }
    }
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          form.reset();
          form.setValue("version", "");
        }
      }}
    >
      <DialogTrigger>
        <Button>
          <Plus />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-[50vw]">
        <DialogHeader>
          <DialogTitle>Create a new server</DialogTitle>
          <DialogDescription>
            Fill the form below to create a new server.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pb-4">
              {createFields.map((field) => (
                <CustomField
                  key={field.name}
                  formContext={form}
                  fieldInfo={field}
                />
              ))}
            </div>
            <div className="w-full pt-2">
              <Button
                type="button"
                className="w-full"
                disabled={!form.formState.isDirty && form.formState.isValid}
                onClick={onSubmit}
              >
                {isLoading && (
                  <Icons.spinner className="animate-spin mr-1 h-11" />
                )}
                Create
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
