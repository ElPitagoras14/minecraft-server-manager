"use client";

import CustomBreadcrumb from "@/components/custom-breadcrumb";
import { CustomColumnDef, DataTable } from "@/components/ui/data-table";
import { useSession } from "next-auth/react";
import { columns, Server } from "./components/columns";
import axios, { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import CreateDialog from "./components/create-dialog";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Square } from "lucide-react";
import DeleteDialog from "./components/delete-dialog";
import { toast } from "@/hooks/use-toast";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { ComboboxItem, ErrorResponse } from "@/utils/interfaces";
import { Icons } from "@/components/ui/icons";
import LoadableIcon from "@/components/loadable-icon";
import UpdateDialog from "./components/update-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ServerResponse {
  items: Server[];
  total: number;
}

const startServer = async (
  id: number,
  token: string,
  requesterId: string
): Promise<void> => {
  const dataOptions = {
    url: `${API_URL}/server/start/${id}`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterRoles: [],
    },
  };

  await axios.request(dataOptions);
};

const stopServer = async (
  id: number,
  token: string,
  requesterId: string
): Promise<void> => {
  const dataOptions = {
    url: `${API_URL}/server/stop/${id}`,
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      requesterId,
      requesterRoles: [],
    },
  };

  await axios.request(dataOptions);
};

const getData = async (
  token: string,
  requesterId: string
): Promise<ServerResponse> => {
  const dataOptions = {
    url: `${API_URL}/server`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      requesterId,
    },
  };

  const response = await axios.request(dataOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

const getVersions = async (): Promise<ComboboxItem[]> => {
  const dataOptions = {
    url: "https://mc-versions-api.net/api/java",
    method: "GET",
  };

  const response = await axios.request(dataOptions);
  console.log(response.data);
  const {
    data: { result },
  } = response;

  const parsedItems = result.map((version: string) => ({
    label: version,
    value: version,
  }));

  return parsedItems;
};

export default function ServersPage() {
  const { data: session } = useSession();
  const { user: { token = "", id: userId = "" } = {} } = session || {};

  const { showError } = useErrorDialog();

  const [data, setData] = useState<ServerResponse>({
    items: [],
    total: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [versions, setVersions] = useState<ComboboxItem[]>([]);
  // const [pagination, setPagination] = useState<PaginationState>({
  //   pageIndex: 0,
  //   pageSize: 10,
  // });
  // const [sorting, setSorting] = useState<SortingState>([]);
  // const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

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
        title: "Error desconocido",
      });
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getData(token, userId);
      setData(data);
    } catch (error: unknown) {
      handleErrorResponse(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartServer = async (id: number, name: string) => {
    try {
      await startServer(id, token, userId);
      await loadData();
      toast({
        title: `Server ${name} started`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    } finally {
    }
  };

  const handleStopServer = async (id: number, name: string) => {
    try {
      await stopServer(id, token, userId);
      await loadData();
      toast({
        title: `Server ${name} stopped`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const newColumns: CustomColumnDef<Server>[] = [
    ...columns,
    {
      id: "actions",
      label: "Actions",
      header: "Actions",
      cell: ({ row }) => {
        const { original: item } = row;
        const { status, id, name } = item;
        return (
          <div className="flex flex-row space-x-2">
            {status === "READY" && (
              <LoadableIcon
                icon={
                  <Square className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
                }
                func={async () => await handleStopServer(id, name)}
              />
            )}
            {status === "INITIALIZING" && (
              <Icons.spinner className="animate-spin h-5 w-5" />
            )}
            {status === "DOWN" && (
              <LoadableIcon
                icon={
                  <Play className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
                }
                func={async () => await handleStartServer(id, name)}
              />
            )}
            <UpdateDialog item={item} updateData={loadData} />
            <DeleteDialog item={item} updateData={loadData} />
          </div>
        );
      },
    },
  ];

  useEffect(() => {
    (async () => {
      const versions = await getVersions();
      console.log(versions);
      setVersions(versions);
    })();
    if (!token) {
      return;
    }
    (async () => {
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col w-full">
      <CustomBreadcrumb />
      <main className="flex flex-col m-5 space-y-4">
        <div className="flex justify-between">
          <div className="flex flex-col space-y-1">
            <p className="text-lg font-semibold">Servers</p>
            <p className="text-muted-foreground text-sm">
              List of all server that you own.
            </p>
          </div>
          <div className="flex flex-row items-center space-x-2">
            <Button variant="secondary" disabled={isLoading} onClick={loadData}>
              <RotateCcw />
              Refresh
            </Button>
            <CreateDialog updateData={loadData} formData={{ versions }} />
          </div>
        </div>
        <DataTable columns={newColumns} data={data.items} />
      </main>
    </div>
  );
}
