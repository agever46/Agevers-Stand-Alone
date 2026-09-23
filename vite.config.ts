import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Fallbacks to the project's publishable (public) backend connection, so a
  // build pipeline that doesn't inject env vars still produces a working app
  // instead of a blank page. These values are public by design.
  const supabaseUrl = env.VITE_SUPABASE_URL || "https://ppernxjnicippytjuxpz.supabase.co";
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc";

  // The project id is just the subdomain of the Supabase URL, so it's
  // derived here instead of requiring a third, easy-to-forget env var.
  const supabaseProjectId = supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";

  const define: Record<string, string> = {};
  if (supabaseUrl) {
    define["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(supabaseUrl);
  }
  if (supabaseKey) {
    define["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] = JSON.stringify(supabaseKey);
  }
  if (supabaseProjectId) {
    define["import.meta.env.VITE_SUPABASE_PROJECT_ID"] = JSON.stringify(supabaseProjectId);
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define,
    // lovable-tagger bundles a compatible Vite type from a separate package
    // tree, so keep the runtime-safe plugin list while avoiding duplicate-type
    // incompatibility during config checking.
    plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean) as any,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
