"use client";

import CustomBreadcrumb from "@/components/custom-breadcrumb";
import { columns, User } from "./components/columns";
import { DataTable } from "@/components/ui/data-table";
import { useState } from "react";

interface UsersResponse {
  items: User[];
  total: number;
}


export default function UsersPage() {
  const [data] = useState<UsersResponse>({
    items: [],
    total: 0,
  });

  return (
    <div className="flex flex-col w-full">
      <CustomBreadcrumb />
      <main className="flex flex-col m-5 space-y-4">
        <div className="flex justify-between">
          <div className="flex flex-col space-y-1">
            <p className="text-lg font-semibold">Users</p>
            <p className="text-muted-foreground text-sm">
              A list of all users
            </p>
          </div>
        </div>
        <DataTable columns={columns} data={data.items} />
      </main>
    </div>
  );
}
