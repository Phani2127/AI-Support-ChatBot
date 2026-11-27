import { useEffect, useState } from "react";
import App from "./App";
import GeminiChat from "./GeminiChat";
import DocumentChat from "./document-chat/DocumentChat";
import DashboardHome from "./DashboardHome";
import { DASHBOARD_ROUTES, type DashboardRoute } from "./dashboardRoutes";
import Icon, { type IconName } from "./Icon";

type Tool = {
  path: DashboardRoute;
  label: string;
  icon: IconName;
};

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "supportDesk.theme";

const TOOLS: Tool[] = [
  { path: DASHBOARD_ROUTES.home, label: "Dashboard", icon: "sparkles" },
  { path: DASHBOARD_ROUTES.basicChat, label: "Basic chat", icon: "chat" },
  { path: DASHBOARD_ROUTES.supportChat, label: "FAQ + orders", icon: "headset" },
  { path: DASHBOARD_ROUTES.documentChat, label: "Documents", icon: "file" }
];

function currentPath(): DashboardRoute {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return TOOLS.find((tool) => tool.path === path)?.path ?? DASHBOARD_ROUTES.home;
}

function getInitialTheme(): Theme {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch {
    // Use the system preference when browser storage is unavailable.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function Dashboard() {
  const [activePath, setActivePath] = useState(currentPath);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const active = TOOLS.find((tool) => tool.path === activePath) ?? TOOLS[0];

  // Keep tab in sync with browser back/forward
  useEffect(() => {
    const onPop = () => setActivePath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies for this session.
    }
  }, [theme]);

  function open(path: DashboardRoute) {
    window.history.pushState(null, "", path);
    setActivePath(path);
  }

  function renderActivePage() {
    switch (active.path) {
      case DASHBOARD_ROUTES.basicChat:
        return <App />;
      case DASHBOARD_ROUTES.supportChat:
        return <GeminiChat />;
      case DASHBOARD_ROUTES.documentChat:
        return <DocumentChat />;
      default:
        return <DashboardHome onNavigate={open} />;
    }
  }

  return (
    <div className="dash">
      <nav className="app-nav" aria-label="Main navigation">
        <div className="app-brand">
          <span className="brand-mark"><Icon name="sparkles" size={22} /></span>
          <span className="brand-copy">
            <strong><span>AI</span> Customer Support</strong>
            <small>AI workspace</small>
          </span>
        </div>

        <div className="nav-links" role="navigation" aria-label="Assistant tools">
          {TOOLS.map((tool) => (
            <button
              key={tool.path}
              type="button"
              className={tool.path === active.path ? "tab active" : "tab"}
              aria-current={tool.path === active.path ? "page" : undefined}
              aria-label={tool.label}
              title={tool.label}
              onClick={() => open(tool.path)}
            >
              <Icon name={tool.icon} size={17} />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-tools">
          <span className="workspace-status"><i />Workspace</span>
          <button
            type="button"
            className="theme-toggle"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
          >
            <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>
        </div>
      </nav>

      <div className="dash-content" key={active.path}>{renderActivePage()}</div>
    </div>
  );
}
