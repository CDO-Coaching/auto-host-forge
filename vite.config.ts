import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Rediriger le client Supabase vers notre version avec les types complets
      "@/integrations/supabase/client": path.resolve(__dirname, "./src/lib/supabase.ts"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query", "react/jsx-runtime", "react/jsx-dev-runtime"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
}));
