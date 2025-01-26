"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios, { isAxiosError } from "axios";
import { Settings } from "lucide-react";
import { Server } from "./columns";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/ui/icons";
import { ErrorResponse, FieldInfo } from "@/utils/interfaces";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { fields } from "./util";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import CustomField from "@/components/form-fields/custom-field";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const updateFields = fields.filter((field) => field.update);

const initialValues = updateFields.reduce(
  (acc: Record<string, unknown>, field: FieldInfo) => {
    acc[field.name] = field.initValue;
    return acc;
  },
  {}
);

const validationSchema = z.object(
  updateFields.reduce((acc: Record<string, z.ZodTypeAny>, field: FieldInfo) => {
    acc[field.name] = field.validation;
    return acc;
  }, {})
);

const updateServer = async (
  id: number,
  data: z.infer<typeof validationSchema>,
  token: string,
  requesterId: string,
  requesterUser: string
) => {
  const updateOptions = {
    url: `${API_URL}/server/${id}`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      roleName: data.role,
      requesterId,
      requesterUser,
    },
  };

  const response = await axios.request(updateOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

interface DeleteDialogProps {
  item: Server;
  updateData?: () => Promise<void>;
}

export default function UpdateDialog({ item, updateData }: DeleteDialogProps) {
  const { data: session } = useSession();
  const { user: { token = "", id = "", username = "" } = {} } = session || {};

  const { toast } = useToast();
  const { showError } = useErrorDialog();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  const form = useForm<z.infer<typeof validationSchema>>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialValues,
  });

  const handleErrorResponse = (error: unknown) => {
    if (isAxiosError(error)) {
      const { response: { data, status } = {} } = error;
      if (status === 401) {
        const { detail } = data;
        toast({
          variant: "destructive",
          title: detail,
        });
        return;
      } else if (data.statusCode === 404) {
        toast({
          title: "No se encontraron datos",
        });
        return;
      }
      showError({
        response: data as ErrorResponse,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error desconocido",
      });
    }
  };

  const onSubmit = form.handleSubmit(
    async (data: z.infer<typeof validationSchema>) => {
      try {
        await updateServer(item.id, data, token, id, username);
        await updateData?.();
        toast({
          title: "Server updated",
          description: `The server ${item.name} has been updated.`,
        });
        setOpen(false);
      } catch (error) {
        handleErrorResponse(error);
      } finally {
        setIsLoading(false);
      }
    }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Settings className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Update Server {item.name}</DialogTitle>
        <Form {...form}>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col space-y-4">
              {updateFields.map((field) => (
                <CustomField
                  key={field.name}
                  formContext={form}
                  fieldInfo={field}
                />
              ))}
              <div className="flex justify-end space-x-4">
                <Button variant="secondary">Cancel</Button>
                <Button type="submit">
                  {isLoading && (
                    <Icons.spinner className="animate-spin h-5 w-5" />
                  )}
                  Update
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
