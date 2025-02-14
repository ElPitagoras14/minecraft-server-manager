"use client";

import CustomBreadcrumb from "@/components/custom-breadcrumb";
import { CustomColumnDef, DataTable } from "@/components/ui/data-table";
import { useSession } from "next-auth/react";
import { columns, Server } from "./components/columns";
import axios, { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import CreateDialog from "./components/create-dialog";
import { Button } from "@/components/ui/button";
import { CloudDownload, Pencil, Play, RotateCcw, Square } from "lucide-react";
import DeleteDialog from "./components/delete-dialog";
import { toast } from "@/hooks/use-toast";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { ComboboxItem, ErrorResponse, QueryParams } from "@/utils/interfaces";
import { Icons } from "@/components/ui/icons";
import LoadableIcon from "@/components/loadable-icon";
import { useRouter } from "next/navigation";
import { startServer, stopServer, restartServer } from "./components/util";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTableColumnHeader } from "@/components/ui/data-table-header";
import {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { getQueryParamsOptions } from "@/utils/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ServerResponse {
  items: Server[];
  total: number;
}

const getData = async (
  token: string,
  requesterId: string,
  params: QueryParams
): Promise<ServerResponse> => {
  const dataOptions = {
    url: `${API_URL}/servers`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      requesterId,
      ...getQueryParamsOptions(params),
    }
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
  const {
    data: { result },
  } = response;

  const parsedItems = result.map((version: string) => ({
    label: version,
    value: version,
  }));

  return [
    {
      label: "Latest",
      value: "LATEST",
    },
    ...parsedItems,
  ];
};

export default function ServersPage() {
  const { data: session } = useSession();
  const {
    user: { token = "", id: userId = "", username = "", isAdmin = false } = {},
  } = session || {};

  const { showError } = useErrorDialog();
  const router = useRouter();

  const [data, setData] = useState<ServerResponse>({
    items: [],
    total: 0,
  });
  const [versions, setVersions] = useState<ComboboxItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState<ColumnFiltersState>([]);

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
        title: "Unknown error",
      });
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getData(token, userId, {
        pagination,
        sorting,
        filter,
      });
      setData(data);
    } catch (error: unknown) {
      handleErrorResponse(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartServer = async (id: string, name: string) => {
    try {
      await startServer(id, token, userId, username);
      await loadData();
      toast({
        title: `Server ${name} started`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    } finally {
    }
  };

  const handleStopServer = async (id: string, name: string) => {
    try {
      await stopServer(id, token, userId, username);
      await loadData();
      toast({
        title: `Server ${name} stopped`,
      });
    } catch (error: unknown) {
      handleErrorResponse(error);
    }
  };

  const handleRestartServer = async (id: string, name: string) => {
    try {
      await restartServer(id, token, userId, username);
      await loadData();
      toast({
        title: `Server ${name} restarted`,
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
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => {
        const { original: item } = row;
        const { status, id, name } = item;
        return (
          <TooltipProvider>
            <div className="flex flex-row space-x-2 justify-center">
              {status === "RUNNING" && (
                <Tooltip>
                  <TooltipTrigger>
                    <LoadableIcon
                      icon={
                        <Square className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
                      }
                      func={async () => await handleStopServer(id, name)}
                    />
                  </TooltipTrigger>
                  <TooltipContent>Stop</TooltipContent>
                </Tooltip>
              )}
              {status === "STARTING" && (
                <Icons.spinner className="animate-spin h-5 w-5" />
              )}
              {status === "STOPPED" && (
                <Tooltip>
                  <TooltipTrigger>
                    <LoadableIcon
                      icon={
                        <Play className="h-5 w-5 hover:cursor-pointer hover:text-primary" />
                      }
                      func={async () =>
                        await handleStartServer(id as string, name)
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent>Start</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger>
                  <RotateCcw
                    onClick={async () => await handleRestartServer(id, name)}
                    className="h-5 w-5 hover:cursor-pointer hover:text-primary"
                  />
                </TooltipTrigger>
                <TooltipContent>Restart</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <Pencil
                    onClick={() => router.push(`/management/servers/${id}`)}
                    className="h-5 w-5 hover:cursor-pointer hover:text-primary"
                  />
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <DeleteDialog item={item} updateData={loadData} />
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        );
      },
    },
  ];

  const finalColumns: CustomColumnDef<Server>[] = isAdmin
    ? [
        ...newColumns.splice(0, 1),
        {
          accessorKey: "username",
          header: ({ column }) => (
            <DataTableColumnHeader column={column} title={"Owner"} />
          ),
        },
        ...newColumns.splice(0),
      ]
    : newColumns;

  useEffect(() => {
    (async () => {
      const versions = await getVersions();
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

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination, sorting, filter]);

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
              <CloudDownload className="h-5 w-5" />
              Refresh
            </Button>
            <CreateDialog updateData={loadData} formData={{ versions }} />
          </div>
        </div>
        <DataTable
          columns={finalColumns}
          data={data.items}
          serverSide={{
            totalRows: data.total,
            isLoading,
            setServerColumnFilters: setFilter,
            setServerPagination: setPagination,
            setServerSorting: setSorting,
          }}
        />
      </main>
    </div>
  );
}
