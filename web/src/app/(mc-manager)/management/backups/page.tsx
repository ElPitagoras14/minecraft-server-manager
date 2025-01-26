import { auth } from "@/auth";
import CustomBreadcrumb from "@/components/custom-breadcrumb";

export default async function BackupsPage() {
  const session = await auth();

  if (!session) {
    return <div className="p-4">Redirecting...</div>;
  }

  return (
    <div className="flex flex-col w-full">
      <CustomBreadcrumb />
      <main className="flex flex-col m-5 space-y-4">

      </main>
    </div>
  );
}
