"use client";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import axios, { isAxiosError } from "axios";
import { useSession } from "next-auth/react";
import { Operator } from "./columns";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ErrorResponse } from "@/utils/interfaces";
import { columns } from "./columns";
import { CustomColumnDef, DataTable } from "@/components/ui/data-table";
import { Trash } from "lucide-react";
import LoadableIcon from "@/components/loadable-icon";
import CreateDialog from "./create-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface OperatorsResponse {
  items: Operator[];
  total: number;
}

const deleteOperator = async (
  serverId: string,
  username: string,
  requesterId: string,
  requesterUser: string,
  token: string
) => {
  const deleteOptions = {
    method: "DELETE",
    url: `${API_URL}/servers/${serverId}/operators/${username}`,
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

const getData = async (
  serverId: string,
  token: string
): Promise<OperatorsResponse> => {
  const dataOptions = {
    method: "GET",
    url: `${API_URL}/servers/${serverId}/operators`,
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

const getServerData = async (serverId: string, token: string) => {
  const dataOptions = {
    method: "GET",
    url: `${API_URL}/servers/${serverId}`,
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

export default function OperatorsTab() {
  const { data: session } = useSession();
  const { user: { token = "", id: userId = "" } = {} } = session || {};

  const { id } = useParams();

  const { toast } = useToast();
  const { showError } = useErrorDialog();

  const [data, setData] = useState<OperatorsResponse>({
    items: [],
    total: 0,
  });
  const [status, setStatus] = useState<string>("");

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
      const serverData = await getServerData(id as string, token);
      setStatus(serverData.status);
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const handleDelete = async (username: string) => {
    try {
      await deleteOperator(id as string, username, userId, username, token);
      await loadData();
      toast({
        title: "Operator deleted",
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const newColumns: CustomColumnDef<Operator>[] = [
    ...columns,
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => {
        const { original: { name } = {} } = row;
        return (
          <div className="flex justify-center">
            <LoadableIcon
              icon={
                <Trash className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
              }
              func={async () => await handleDelete(name as string)}
            />
          </div>
        );
      },
    },
  ];

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      try {
        await loadData();
      } catch (error) {
        handleErrorResponse(error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between mt-2">
        <div>
          <p className="text-lg font-semibold">Operator</p>
          <p className="text-muted-foreground text-sm">
            Server must be running to manage operators.
          </p>
        </div>
        <CreateDialog updateData={loadData} serverStatus={status}/>
      </div>
      <DataTable columns={newColumns} data={data.items} />
    </div>
  );
}
