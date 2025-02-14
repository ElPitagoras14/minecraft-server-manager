import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { useToast } from "@/hooks/use-toast";
import { ErrorResponse } from "@/utils/interfaces";
import axios, { isAxiosError } from "axios";
import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const createBackup = async (
  serverId: string,
  requesterId: string,
  requesterUser: string,
  token: string
) => {
  const dataOptions = {
    method: "POST",
    url: `${API_URL}/servers/${serverId}/backups`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterUser,
    },
  };

  const response = await axios.request(dataOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

interface CreateDialogProps {
  updateData: () => Promise<void>;
  total: number;
}

export default function CreateDialog({ updateData, total }: CreateDialogProps) {
  const { data: session } = useSession();
  const { user: { token = "", username = "", id: userId = "" } = {} } =
    session || {};

  const { toast } = useToast();
  const { id } = useParams();
  const { showError } = useErrorDialog();

  const [open, setOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
        title: "Unknown error",
      });
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const response = await createBackup(
        id as string,
        userId,
        username,
        token
      );
      const { backupName } = response;
      await updateData();
      setOpen(false);
      toast({
        title: `Backup ${backupName} created`
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>
          <Plus /> Create Backup
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Backup</DialogTitle>
          <DialogDescription>
            Are you sure you want to create a backup?{" "}
            <span className="font-semibold">Limit to 3 backups</span>
          </DialogDescription>
        </DialogHeader>
        {total === 3 && (
          <span className="text-red-500 font-semibold">
            You have reached the maximum number of backups. Please delete a
            backup before.
          </span>
        )}
        <div className="flex justify-end space-x-4">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading || total === 3}>
            {isLoading && <Icons.spinner className="animate-spin mr-2" />}{" "}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
