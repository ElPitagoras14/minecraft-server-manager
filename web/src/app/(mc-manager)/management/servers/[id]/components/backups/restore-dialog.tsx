import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Backup } from "./columns";
import { ArchiveRestore } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const restoreBackup = async (
  backupId: number,
  requesterId: string,
  requesterUser: string,
  token: string
) => {
  const dataOptions = {
    method: "PUT",
    url: `${API_URL}/servers/backups/${backupId}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterUser,
    },
  };

  await axios.request(dataOptions);
};

interface RestoreDialogProps {
  item: Backup;
}

export default function RestoreDialog({ item }: RestoreDialogProps) {
  const { data: session } = useSession();
  const { user: { token = "", id: userId = "", username = "" } = {} } =
    session || {};

  const { id, name } = item;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      await restoreBackup(id, userId, username, token);
      setIsLoading(false);
      toast({
        title: "Backup restored",
        description: `The backup ${name} has been restored successfully`,
      });
      setOpen(false);
    } catch {
      toast({
        title: "Error",
        description: "An error occurred while restoring the backup",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <ArchiveRestore className="h-5 w-5 cursor-pointer hover:text-primary" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore backup {name}</DialogTitle>
          <DialogDescription>
            Are you sure you want to restore the backup {name}?
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
          <Button onClick={handleRestore} disabled={isLoading}>
            {isLoading && <Icons.spinner className="animate-spin mr-2" />}{" "}
            Restore
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
