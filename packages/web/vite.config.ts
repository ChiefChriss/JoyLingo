import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const workspace = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // Backend API (npm run api). The web app falls back to the static
    // manifest in public/episodes/ when the API isn't running.
    proxy: {
      "/api": { target: "http://127.0.0.1:5174", changeOrigin: true },
    },
  },
  resolve: {
    // Point workspace packages at their TypeScript source so dev/HMR picks
    // up edits without a rebuild (package.json main points at dist/).
    alias: {
      "@joylingo/player-core": workspace("../player-core/src/index.ts"),
      "@joylingo/shared": workspace("../shared/src/index.ts"),
    },
  },
});
