import { CustomColumnDef } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-header";

export interface Operator {
  uuid: string;
  name: string;
  level: number;
  bypassesPlayerLimit: boolean;
}

export const columns: CustomColumnDef<Operator>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
    cell: ({ row }) => <div className="pl-2">{row.original.name}</div>,
  },
  {
    accessorKey: "level",
    header: () => <div className="text-center">Level</div>,
    cell: ({ row }) => <div className="text-center">{row.original.level}</div>,
  },
  {
    accessorKey: "bypassesPlayerLimit",
    header: () => <div className="text-center">Bypass Player Limit</div>,
    cell: ({ row }) => (
      <div className="pl-2">
        {row.original.bypassesPlayerLimit ? "Yes" : "No"}
      </div>
    ),
  },
];
