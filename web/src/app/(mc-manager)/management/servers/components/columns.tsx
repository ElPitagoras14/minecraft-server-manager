import { CustomColumnDef } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-header";

export type Server = {
  id: string;
  containerId: string;
  name: string;
  version: string;
  port: number;
  status: "TO SETUP" | "STARTING" | "RUNNING" | "STOPPED";
  roleName: string;
};

export const columns: CustomColumnDef<Server>[] = [
  {
    accessorKey: "id",
    label: "ID",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"ID"} />
    ),
    cell: ({ row }) => {
      const {
        original: { id },
      } = row;
      return <div className="px-2">{id}</div>;
    },
  },
  {
    accessorKey: "name",
    label: "Name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Name"} />
    ),
    cell: ({ row }) => {
      const {
        original: { name },
      } = row;
      return <div className="px-2">{name}</div>;
    },
  },
  {
    accessorKey: "roleName",
    label: "Role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Role"} />
    ),
    cell: ({ row }) => {
      const {
        original: { roleName },
      } = row;
      return <div className="px-2">{roleName}</div>;
    },
  },
  {
    accessorKey: "version",
    label: "Version",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Version"} />
    ),
    cell: ({ row }) => {
      const {
        original: { version },
      } = row;
      return <div className="px-2">{version}</div>;
    },
  },
  {
    accessorKey: "port",
    label: "Port",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={"Port"} />
    ),
    cell: ({ row }) => {
      const {
        original: { port },
      } = row;
      return <div className="px-2">{port}</div>;
    },
  },
  {
    accessorKey: "status",
    label: "Status",
    header: ({ column, table }) => (
      <DataTableColumnHeader
        column={column}
        title={"Status"}
        filterControl={{
          table,
          filterOptions: [
            { label: "TO SETUP", value: "TO SETUP" },
            { label: "STARTING", value: "STARTING" },
            { label: "RUNNING", value: "RUNNING" },
            { label: "STOPPED", value: "STOPPED" },
          ],
        }}
      />
    ),
    cell: ({ row }) => {
      const {
        original: { status },
      } = row;
      return <div className="px-2">{status}</div>;
    },
  },
];
