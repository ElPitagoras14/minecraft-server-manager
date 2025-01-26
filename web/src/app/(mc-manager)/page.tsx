import { auth } from "@/auth";
import CustomBreadcrumb from "@/components/custom-breadcrumb";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return <div className="p-4">Redirecting...</div>;
  }

  return (
    <div className="flex flex-col w-full">
      <CustomBreadcrumb/>
      <main></main>
    </div>
  );
}