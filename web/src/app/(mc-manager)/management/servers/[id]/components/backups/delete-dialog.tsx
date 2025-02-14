"use client";

import { Trash } from "lucide-react";
import { Backup } from "./columns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios from "axios";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const deleteBackup = async (
  id: number,
  requesterId: string,
  requesterUser: string,
  token: string
) => {
  const deleteOptions = {
    url: `${API_URL}/servers/backups/${id}`,
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterUser,
    },
  };

  await axios.request(deleteOptions);
};

interface DeleteDialogProps {
  updateData: () => Promise<void>;
  item: Backup;
}

export default function DeleteDialog({ updateData, item }: DeleteDialogProps) {
  const { data: session } = useSession();
  const { user: { token = "", id: userId = "", username = "" } = {} } =
    session || {};

  const { name } = item;
  const { toast } = useToast();

  const [open, setOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await deleteBackup(item.id, userId, username, token);
      await updateData();
      toast({
        title: "Backup deleted",
        description: `The backup ${name} has been deleted.`,
      });
      setOpen(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Trash className="h-5 w-5 cursor-pointer hover:text-primary" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this backup?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-4">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleDelete} disabled={isLoading}>
            {isLoading && <Icons.spinner className="animate-spin mr-2" />}{" "}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
