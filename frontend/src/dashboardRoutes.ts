export const DASHBOARD_ROUTES = {
  home: "/",
  basicChat: "/basic-chat",
  supportChat: "/gemini-chat",
  documentChat: "/document-chat"
} as const;

export type DashboardRoute = typeof DASHBOARD_ROUTES[keyof typeof DASHBOARD_ROUTES];
