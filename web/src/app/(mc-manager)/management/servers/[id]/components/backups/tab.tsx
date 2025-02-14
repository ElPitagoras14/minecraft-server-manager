"use client";

import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { Backup } from "./columns";
import axios, { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { ErrorResponse } from "@/utils/interfaces";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { useParams } from "next/navigation";
import CreateDialog from "./create-dialog";
import { CustomColumnDef, DataTable } from "@/components/ui/data-table";
import DeleteDialog from "./delete-dialog";
import { columns } from "./columns";
import RestoreDialog from "./restore-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface BackupResponse {
  items: Backup[];
  total: number;
}

const getData = async (
  serverId: string,
  token: string
): Promise<BackupResponse> => {
  const dataOptions = {
    method: "GET",
    url: `${API_URL}/servers/${serverId}/backups`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.request(dataOptions);
  const {
    data: { payload },
  } = response;
  return payload;
};

export default function BackupsTab() {
  const { data: session } = useSession();
  const { user: { token = "" } = {} } = session || {};

  const { toast } = useToast();
  const { showError } = useErrorDialog();
  const { id } = useParams();

  const [data, setData] = useState<BackupResponse>({
    items: [],
    total: 0,
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
          title: "No data found",
        });
        setData({
          items: [],
          total: 0,
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

  const loadData = async () => {
    try {
      const data = await getData(id as string, token);
      setData(data);
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const newColumns: CustomColumnDef<Backup>[] = [
    ...columns,
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => {
        const { original: item } = row;
        const { id } = item;
        return (
          <TooltipProvider>
            <div className="flex flex-row justify-center space-x-2 items-center">
              <Tooltip>
                <TooltipTrigger>
                  <Download
                    className="h-5 w-5 cursor-pointer hover:text-primary"
                    onClick={() =>
                      (window.location.href = `${API_URL}/servers/backups/${id}`)
                    }
                  />
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <RestoreDialog item={item} />
                </TooltipTrigger>
                <TooltipContent>Restore</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <DeleteDialog updateData={loadData} item={item} />
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        );
      },
    },
  ];

  useEffect(() => {
    if (!token) return;
    (async () => {
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between mt-2">
        <p className="text-lg font-semibold">Backups</p>
        <CreateDialog updateData={loadData} total={data.total} />
      </div>
      <DataTable columns={newColumns} data={data.items} />
    </div>
  );
}
