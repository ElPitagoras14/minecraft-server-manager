import { CustomColumnDef } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-header";

export type Server = {
  id: number;
  name: string;
  version: string;
  port: number;
  status: "DOWN" | "INITIALIZING" | "READY";
  roleName: string;
};

export const columns: CustomColumnDef<Server>[] = [
  {
    accessorKey: "id",
    label: "ID",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"ID"} />
    ),
  },
  {
    accessorKey: "name",
    label: "Name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Name"} />
    ),
  },
  {
    accessorKey: "roleName",
    label: "Role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Role"} />
    ),
  },
  {
    accessorKey: "version",
    label: "Version",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Version"} />
    ),
  },
  {
    accessorKey: "port",
    label: "Port",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Port"} />
    ),
  },
  {
    accessorKey: "status",
    label: "Status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Status"} />
    ),
  },
];
