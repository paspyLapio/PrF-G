import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" lets the built app run from any path (Render static site, GitHub Pages, a local file server).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", sourcemap: false },
});
