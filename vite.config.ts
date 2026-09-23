import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // No hardcoded fallbacks on purpose: this repo only ever talks to the
  // independent Supabase project, and a build that doesn't get real env vars
  // must fail loudly rather than silently connect to the wrong (or a
  // retired) backend. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
  // as real build environment variables in your hosting provider's project
  // settings.
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set as build environment variables — set them in your hosting provider's project settings."
    );
  }

  // The project id is just the subdomain of the Supabase URL, so it's
  // derived here instead of requiring a third, easy-to-forget env var.
  const supabaseProjectId = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";

  const define: Record<string, string> = {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
  };

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
