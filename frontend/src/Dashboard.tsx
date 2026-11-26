import { useEffect, useState, type ReactNode } from "react";
import App from "./App";
import GeminiChat from "./GeminiChat";
import DocumentChat from "./document-chat/DocumentChat";

// To add a new test page: add an entry here.
type Tool = { path: string; label: string; render: () => ReactNode };

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
    <main className="chat panel">
      <h1>Backend health</h1>
      <button type="button" className="primary" onClick={check} disabled={loading}>
        {loading ? "Checking..." : "Run health check"}
      </button>
      {result && <pre>{result}</pre>}
    </main>
  );
}

const TOOLS: Tool[] = [
  { path: "/", label: "Basic Chat", render: () => <App /> },
  { path: "/gemini-chat", label: "Gemini Support (FAQ + Orders)", render: () => <GeminiChat /> },
  { path: "/document-chat", label: "Document Chat", render: () => <DocumentChat /> },
  { path: "/health", label: "Health", render: () => <Health /> }
];

function currentTool(): Tool {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return TOOLS.find((t) => t.path === path) ?? TOOLS[0];
}

export default function Dashboard() {
  const [active, setActive] = useState<Tool>(currentTool);

  // Keep tab in sync with browser back/forward
  useEffect(() => {
    const onPop = () => setActive(currentTool());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function open(tool: Tool) {
    window.history.pushState(null, "", tool.path);
    setActive(tool);
  }

  return (
    <div className="dash">
      <nav className="dash-nav">
        <strong>Test Dashboard</strong>
        {TOOLS.map((t) => (
          <button
            key={t.path}
            type="button"
            className={t.path === active.path ? "tab active" : "tab"}
            onClick={() => open(t)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {/* key remounts the tool so each tab starts fresh */}
      <div className="dash-content" key={active.path}>{active.render()}</div>
    </div>
  );
}
