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
import { Plus } from "lucide-react";
import { fields } from "./utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import CustomField from "@/components/form-fields/custom-field";
import { useState } from "react";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icons } from "@/components/ui/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const initialValues = fields.reduce((acc: Record<string, unknown>, field) => {
  acc[field.name] = field.initValue;
  return acc;
}, {});

const validationSchema = z.object(
  fields.reduce((acc: Record<string, z.ZodTypeAny>, field) => {
    acc[field.name] = field.validation;
    return acc;
  }, {})
);

const createOperator = async (
  data: z.infer<typeof validationSchema>,
  serverId: string,
  requesterId: string,
  requesterUser: string,
  token: string
) => {
  const createOptions = {
    method: "POST",
    url: `${API_URL}/servers/${serverId}/operators`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      ...data,
      requesterId,
      requesterUser,
    },
  };

  await axios.request(createOptions);
};

interface CreateDialogProps {
  updateData: () => Promise<void>;
}

export default function CreateDialog({ updateData }: CreateDialogProps) {
  const { data: session } = useSession();
  const { user: { token = "", id: userId = "", username = "" } = {} } =
    session || {};

  const { toast } = useToast();
  const { id } = useParams();

  const [open, setOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const form = useForm<z.infer<typeof validationSchema>>({
    defaultValues: initialValues,
    resolver: zodResolver(validationSchema),
    mode: "onChange",
  });

  const onSubmit = form.handleSubmit(
    async (data: z.infer<typeof validationSchema>) => {
      setIsLoading(true);
      try {
        await createOperator(data, id as string, userId, username, token);
        form.reset();
        await updateData();
        setOpen(false);
        toast({
          title: "Operator created",
        });
      } catch (error: unknown) {
        console.error("error", error);
        toast({
          title: "Error",
          description: "Failed to create operator",
        });
      } finally {
        setIsLoading(false);
      }
    }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Plus /> Add Operator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Operator</DialogTitle>
          <DialogDescription>
            Add a new operator to the server.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form>
            {fields.map((field) => (
              <CustomField
                key={field.name}
                fieldInfo={field}
                formContext={form}
              />
            ))}
            <div className="flex justify-end">
              <Button className="mt-4" type="button" onClick={onSubmit}>
                {isLoading && <Icons.spinner className="animate-spin mr-2" />}
                Create
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
