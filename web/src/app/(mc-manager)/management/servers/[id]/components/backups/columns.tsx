import { CustomColumnDef } from "@/components/ui/data-table";

export interface Backup {
  id: number;
  name: string;
  version: string;
  size: string;
  createdAt: string;
}

export const columns: CustomColumnDef<Backup>[] = [
  {
    accessorKey: "name",
    header: () => <div className="px-2">Name</div>,
  },
  {
    accessorKey: "version",
    header: () => <div className="px-2">Version</div>,
  },
  {
    accessorKey: "size",
    header: () => <div className="px-2">Size</div>,
  },
  {
    accessorKey: "createdAt",
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
];
