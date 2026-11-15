import { cpSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Worker build: copy site/ (main menu, presentation page) to the top of dist/, next to the demo in dist/demo/. */
function copySite(): Plugin {
  return {
    name: "prfg-copy-site",
    apply: "build",
    closeBundle() {
      cpSync("site", "dist", { recursive: true });
    },
  };
}

// base "./" lets the built app run from any path (Render static site, /demo/ on the Worker, a local file server).
// `vite build --mode worker` (npm run build:worker) puts the demo in dist/demo and adds the menu around it.
export default defineConfig(({ mode }) => {
  const worker = mode === "worker";
  return {
    plugins: [react(), ...(worker ? [copySite()] : [])],
    base: "./",
    build: { outDir: worker ? "dist/demo" : "dist", emptyOutDir: true, sourcemap: false },
  };
});
