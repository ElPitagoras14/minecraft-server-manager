import CustomBreadcrumb from "@/components/custom-breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeneralTab from "./components/general/tab";
import OperatorsTab from "./components/operators/tab";
import BackupsTab from "./components/backups/tab";
import LogsTab from "./components/logs-tab/tab";

export default async function ServerPage() {
  return (
    <div className="flex flex-col w-full">
      <CustomBreadcrumb dynamicItems={[{ label: "Item" }]} />
      <main className="flex flex-col m-5 space-y-4">
        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="w-full">
              General
            </TabsTrigger>
            <TabsTrigger value="backups" className="w-full">
              Backups
            </TabsTrigger>
            <TabsTrigger value="operators" className="w-full">
              Operators
            </TabsTrigger>
            <TabsTrigger value="logs" className="w-full">
              Logs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <GeneralTab />
          </TabsContent>
          <TabsContent value="backups">
            <BackupsTab />
          </TabsContent>
          <TabsContent value="operators">
            <OperatorsTab />
          </TabsContent>
          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
