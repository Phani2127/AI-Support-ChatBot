import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Serves the React frontend in /frontend on port 5173 and forwards API calls to the backend
export default defineConfig({
  root: "frontend",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3003",
      "/health": "http://localhost:3003"
    }
  }
});
