import { useEffect, useState, type ReactNode } from "react";
import App from "./App";
import GeminiChat from "./GeminiChat";
import DocumentChat from "./document-chat/DocumentChat";
import Icon, { type IconName } from "./Icon";

// To add a new test page: add an entry here.
type Tool = {
  path: string;
  label: string;
  icon: IconName;
  render: () => ReactNode;
};

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "supportDesk.theme";

function Health() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    try {
      const res = await fetch("/health");
      setResult(`${res.status}\n${JSON.stringify(await res.json(), null, 2)}`);
    } catch {
      setResult("Could not reach the backend. Is it running (and does the proxy port match)?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="chat health-panel">
      <div className="health-heading">
        <span className="chat-title-icon"><Icon name="activity" size={21} /></span>
        <div>
          <h1>Backend health</h1>
          <p>Check that the API is reachable.</p>
        </div>
      </div>
      <button type="button" className="button button-primary" onClick={check} disabled={loading}>
        <Icon name="activity" />
        {loading ? "Checking..." : "Run health check"}
      </button>
      {result && <pre>{result}</pre>}
    </main>
  );
}

const TOOLS: Tool[] = [
  { path: "/", label: "Basic chat", icon: "chat", render: () => <App /> },
  { path: "/gemini-chat", label: "FAQ + orders", icon: "headset", render: () => <GeminiChat /> },
  { path: "/document-chat", label: "Documents", icon: "file", render: () => <DocumentChat /> },
  { path: "/health", label: "API status", icon: "activity", render: () => <Health /> }
];

function currentTool(): Tool {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return TOOLS.find((t) => t.path === path) ?? TOOLS[0];
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
  const [active, setActive] = useState<Tool>(currentTool);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Keep tab in sync with browser back/forward
  useEffect(() => {
    const onPop = () => setActive(currentTool());
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

  function open(tool: Tool) {
    window.history.pushState(null, "", tool.path);
    setActive(tool);
  }

  return (
    <div className="dash">
      <nav className="app-nav" aria-label="Main navigation">
        <div className="app-brand">
          <span className="brand-mark"><Icon name="sparkles" size={22} /></span>
          <span className="brand-copy">
            <strong>Support<span>Desk</span></strong>
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
              onClick={() => open(tool)}
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

      <div className="dash-content" key={active.path}>{active.render()}</div>
    </div>
  );
}
