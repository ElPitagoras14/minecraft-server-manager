export interface PageInfo {
  label: string;
  url: string;
  isMenu: boolean;
}

const managementRoutes = [
  {
    label: "Management",
    url: "/management",
    isMenu: true,
  },
  {
    label: "Servers",
    url: "/management/servers",
    isMenu: false,
  },
  {
    label: "Item",
    url: "/management/servers/*",
    isMenu: false,
  },
  {
    label: "Backups",
    url: "/management/backups",
    isMenu: false,
  },
];

const adminRoutes = [
  {
    label: "Administrate",
    url: "/admin",
    isMenu: true,
  },
  {
    label: "Users",
    url: "/admin/users",
    isMenu: false,
  },
];

const routes = [...managementRoutes, ...adminRoutes];

export const indexedRoutes = routes.reduce(
  (acc: Record<string, PageInfo>, pageInfo: PageInfo) => {
    acc[pageInfo.url] = pageInfo;
    return acc;
  },
  {}
) as Record<string, PageInfo>;
