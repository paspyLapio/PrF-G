import { cpSync, mkdirSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Worker build: copy site/ (homepage, presentation page) to the top of dist/, next to the demo in dist/demo/, plus Lenis. */
function copySite(): Plugin {
  return {
    name: "prfg-copy-site",
    apply: "build",
    closeBundle() {
      cpSync("site", "dist", { recursive: true });
      // Lenis smooth scrolling for the homepage, shipped with the site (no CDN).
      mkdirSync("dist/vendor", { recursive: true });
      cpSync("node_modules/lenis/dist/lenis.min.js", "dist/vendor/lenis.min.js");
      cpSync("node_modules/lenis/dist/lenis.css", "dist/vendor/lenis.css");
      // pdf.js renders the team's PDF deck inside the Presentation section (legacy build: wider browser support).
      const pdf = "node_modules/pdfjs-dist/legacy/build";
      mkdirSync("dist/vendor/pdfjs", { recursive: true });
      cpSync(`${pdf}/pdf.min.mjs`, "dist/vendor/pdfjs/pdf.min.js");
      cpSync(`${pdf}/pdf.worker.min.mjs`, "dist/vendor/pdfjs/pdf.worker.min.js");
      cpSync("node_modules/pdfjs-dist/cmaps", "dist/vendor/pdfjs/cmaps", { recursive: true });
      cpSync("node_modules/pdfjs-dist/standard_fonts", "dist/vendor/pdfjs/standard_fonts", { recursive: true });
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
