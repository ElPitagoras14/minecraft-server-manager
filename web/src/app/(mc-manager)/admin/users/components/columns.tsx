import { CustomColumnDef } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-header";
import { toCapitalize } from "@/utils/utils";

export interface User {
  id: string;
  username: string;
  status: "INACTIVE" | "ACTIVE";
  isAdmin: boolean;
  createdAt: Date;
}

export const columns: CustomColumnDef<User>[] = [
  {
    accessorKey: "username",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
    cell: ({ row }) => {
      const {
        original: { username },
      } = row;
      return <div className="px-2">{username}</div>;
    },
  },
  {
    accessorKey: "status",
    header: ({ column, table }) => (
      <DataTableColumnHeader
        column={column}
        title="Status"
        filterControl={{
          table,
          filterOptions: [
            {
              label: "Active",
              value: "ACTIVE",
            },
            {
              label: "Inactive",
              value: "INACTIVE",
            },
          ],
        }}
      />
    ),
    cell: ({ row }) => {
      const {
        original: { status },
      } = row;
      return <div className="px-2">{toCapitalize(status)}</div>;
    },
  },
  {
    accessorKey: "isAdmin",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Is Admin" />
    ),
    cell: ({ row }) => {
      const {
        original: { isAdmin },
      } = row;
      return <div className="px-2">{isAdmin ? "Yes" : "No"}</div>;
    },
  },
  {
    accessorKey: "createdAt",
    header: () => <div className="px-2">Created At</div>,
    cell: ({ row }) => {
      const {
        original: { createdAt },
      } = row;
      return (
        <div className="px-2">
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
];
