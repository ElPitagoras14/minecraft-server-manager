"use client";

import { Column, ColumnFiltersState, Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Separator } from "./separator";
import { FilterItem } from "@/utils/interfaces";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Icons } from "./icons";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  filterControl?: {
    table: Table<TData>;
    filterOptions: FilterItem[];
    fetchOptions?: (token: string) => Promise<FilterItem[]>;
  };
}

const hasSearchItem = (
  columnFilters: ColumnFiltersState,
  column: string,
  value: unknown
) => {
  return columnFilters.some(
    (item) => item.id === column && item.value === value
  );
};

const toggleFilterValue = (
  columnFilters: ColumnFiltersState,
  column: string,
  value: unknown
) => {
  const searchItem = { id: column, value };
  if (hasSearchItem(columnFilters, column, value)) {
    return columnFilters.filter((v) => v.id !== column || v.value !== value);
  } else {
    return [...columnFilters, searchItem];
  }
};

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  filterControl,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { table, filterOptions, fetchOptions } = filterControl || {};
  const sortDirection = column.getIsSorted();
  const canSort = column.getCanSort();
  const columnFilters = table ? table.getState().columnFilters : [];

  const { data: session } = useSession() || {};
  const { user: { token = "" } = {} } = session || {};

  const [options, setOptions] = useState<FilterItem[]>(filterOptions || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!token || !fetchOptions) {
      return;
    }
    (async () => {
      try {
        setIsLoading(true);
        const fetchedOptions = await fetchOptions(token);
        setOptions(fetchedOptions);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fetchOptions, token]);

  return (
    <div className="px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="px-2">
            {title} <Settings2 />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className={cn(
            filterOptions ? "flex flex-row" : "",
            "m-0 p-0",
            className
          )}
        >
          {canSort && (
            <div className="min-w-[110px]">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="pr-1">
                <DropdownMenuCheckboxItem
                  checked={sortDirection === false}
                  onClick={() => {
                    column.clearSorting();
                  }}
                >
                  Ninguno
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortDirection === "asc"}
                  onClick={() => column.toggleSorting(false)}
                >
                  Asc
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortDirection === "desc"}
                  onClick={() => column.toggleSorting(true)}
                >
                  Desc
                </DropdownMenuCheckboxItem>
              </div>
            </div>
          )}
          {filterControl && canSort && (
            <div className="flex flex-row">
              <Separator orientation="vertical" className="h-full" />
            </div>
          )}
          {filterControl && (
            <div className="min-w-[110px]">
              <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Icons.spinner className="h-8 w-8 animate-spin"></Icons.spinner>
                </div>
              ) : (
                <div className="max-h-72 custom-scrollbar">
                  <DropdownMenuCheckboxItem
                    checked={column.getFilterValue() === undefined}
                    onClick={() => {
                      column.setFilterValue(undefined);
                    }}
                  >
                    Todos
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator className="m-0 p-0" />
                  {options!.map((option) => {
                    const { label, value } = option;
                    return (
                      <DropdownMenuCheckboxItem
                        key={value as string}
                        checked={hasSearchItem(columnFilters, column.id, value)}
                        onClick={() => {
                          const newFilterValues = toggleFilterValue(
                            columnFilters,
                            column.id,
                            value
                          );
                          table!.setColumnFilters(newFilterValues);
                        }}
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
