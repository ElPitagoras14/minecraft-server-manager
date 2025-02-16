"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios, { isAxiosError } from "axios";
import { Trash } from "lucide-react";
import { Server } from "./columns";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { Icons } from "@/components/ui/icons";
import { ErrorResponse } from "@/utils/interfaces";
import { useErrorDialog } from "@/hooks/use-error-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const deleteServer = async (
  id: string,
  token: string,
  requesterId: string,
  requesterUser: string
) => {
  const deleteOptions = {
    url: `${API_URL}/servers/${id}`,
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterUser,
    },
  };

  const response = await axios.request(deleteOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

interface DeleteDialogProps {
  item: Server;
  updateData?: () => Promise<void>;
}

export default function DeleteDialog({ item, updateData }: DeleteDialogProps) {
  const { data: session } = useSession();
  const { user: { token = "", id = "", username = "" } = {} } = session || {};

  const { toast } = useToast();
  const { showError } = useErrorDialog();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

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
          title: "No data found",
        });
        return;
      }
      showError({
        response: data as ErrorResponse,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Uknown error",
      });
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await deleteServer(item.id, token, id, username);
      await updateData?.();
      toast({
        title: "Server deleted",
        description: `The server ${item.name} has been deleted.`,
      });
    } catch (error) {
      handleErrorResponse(error);
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Trash className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete Server {item.name}</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this server?
        </DialogDescription>
        <div className="flex justify-end space-x-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={async () => await handleDelete()}
          >
            {isLoading && <Icons.spinner className="animate-spin mr-1" />}
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
