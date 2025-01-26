import { AppSidebar } from "@/components/app-sidebar";
import ErrorDialog from "@/components/error-dialog";
import { ErrorDialogProvider } from "@/hooks/use-error-dialog";

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ErrorDialogProvider>
        <AppSidebar />
        {children}
        <ErrorDialog/>
      </ErrorDialogProvider>
    </>
  );
}
