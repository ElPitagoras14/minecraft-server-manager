import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default async function CustomNotFound() {
  return (
    <>
      <AppSidebar />
      <div className="w-full">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>
        <div className="flex space-x-4 items-center justify-center h-[calc(100vh-4rem)] w-full">
          <span className="text-2xl font-medium">404</span>
          <Separator orientation="vertical" className="h-4"></Separator>
          <span>Page not found</span>
        </div>
      </div>
    </>
  );
}
