"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns, Log } from "./columns";
import { useEffect, useState } from "react";
import axios, { isAxiosError } from "axios";
import { ErrorResponse, QueryParams } from "@/utils/interfaces";
import { useErrorDialog } from "@/hooks/use-error-dialog";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "next/navigation";
import {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useSession } from "next-auth/react";
import { getQueryParamsOptions } from "@/utils/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface LogsResponse {
  items: Log[];
  total: number;
}

const getData = async (
  serverId: string,
  token: string,
  params: QueryParams
): Promise<LogsResponse> => {
  const dataOptions = {
    method: "GET",
    url: `${API_URL}/servers/${serverId}/logs`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: getQueryParamsOptions(params),
  };

  const response = await axios.request(dataOptions);
  const {
    data: { payload },
  } = response;

  return payload;
};

export default function LogsTab() {
  const { data: session } = useSession();
  const { user: { token = "" } = {} } = session || {};

  const { id } = useParams();

  const { toast } = useToast();
  const { showError } = useErrorDialog();

  const [data, setData] = useState<LogsResponse>({
    items: [],
    total: 0,
  });
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
        title: "Uknown error",
      });
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await getData(id as string, token, {
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

  useEffect(() => {
    if (!token) {
      return;
    }
    (async () => {
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, pagination, sorting, filter]);

  return (
    <div className="flex flex-col space-y-4">
      <p className="text-lg font-semibold mt-2">Logs</p>
      <DataTable
        columns={columns}
        data={data.items}
        serverSide={{
          totalRows: data.total,
          isLoading,
          setServerColumnFilters: setFilter,
          setServerPagination: setPagination,
          setServerSorting: setSorting,
        }}
      />
    </div>
  );
}
