import {
  ChevronRight,
  FileSliders,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { auth } from "@/auth";

const items = [
  {
    title: "Management",
    Icon: FileSliders as LucideIcon,
    items: [
      {
        title: "Servers",
        url: "/management/servers",
      },
      {
        title: "Backups",
        url: "/management/backups",
      },
    ],
  },
];

const adminItems = [
  {
    title: "Administrate",
    Icon: LockKeyhole,
    items: [
      {
        title: "Users",
        url: "/admin/users",
      },
    ],
  },
];

export async function NavMain() {
  const session = await auth();

  if (!session?.user) return null;

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const { title, Icon, items } = item;
          return (
            <Collapsible key={title} asChild className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={title}>
                    {<Icon />}
                    <span>{title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {items.map((subItem) => {
                      const { title, url } = subItem;
                      return (
                        <SidebarMenuSubItem key={title}>
                          <SidebarMenuSubButton asChild>
                            <Link href={url}>
                              <span>{title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
        {session.user.isAdmin &&
          adminItems.map((item) => {
            const { title, Icon, items } = item;
            return (
              <Collapsible key={title} asChild className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={title}>
                      {<Icon />}
                      <span>{title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {items.map((subItem) => {
                        const { title, url } = subItem;
                        return (
                          <SidebarMenuSubItem key={title}>
                            <SidebarMenuSubButton asChild>
                              <Link href={url}>
                                <span>{title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
