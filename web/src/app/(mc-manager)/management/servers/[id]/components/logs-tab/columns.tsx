import { CustomColumnDef } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-header";
import { toCapitalize } from "@/utils/utils";

export interface Log {
  id: number;
  requestId: string;
  serverId: number;
  username: string;
  action: string;
  status: string;
  createdAt: string;
}

export const columns: CustomColumnDef<Log>[] = [
  {
    accessorKey: "username",
    label: "Username",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
  },
  {
    accessorKey: "action",
    label: "Action",
    header: ({ column, table }) => (
      <DataTableColumnHeader
        column={column}
        title="Action"
        filterControl={{
          table,
          filterOptions: [],
        }}
      />
    ),
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
            {
              label: "Success",
              value: "SUCCESS",
            },
            {
              label: "Failed",
              value: "FAILED",
            },
          ],
        }}
      />
    ),
    cell: ({ row }) => {
      const {
        original: { status },
      } = row;

      return toCapitalize(status);
    },
  },
  {
    accessorKey: "createdAt",
    label: "Created At",
    header: () => <div className="px-2">Created At</div>,
    cell: ({ row }) => {
      const {
        original: { createdAt },
      } = row;

      return (
        <div>
          {new Date(createdAt).toLocaleString("es-ES", {
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      );
    },
  },
  {
    accessorKey: "requestId",
    label: "Request ID",
    header: () => <div className="px-2">Request ID</div>,
  },
];
