import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * `vite build --mode analyze` prints the biggest modules inside each emitted
 * chunk. It runs against the real build config (aliases, manual chunks and
 * all), so the report always describes the bundle that actually ships — a
 * separate analyzer config inevitably drifts and starts measuring fiction.
 */
function moduleReport(): Plugin {
  return {
    name: "module-report",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = Object.entries(bundle).filter(([, out]) => out.type === "chunk");
      console.log("\n=== CHUNK COMPOSITION (top 6 chunks) ===");
      chunks
        .sort((a, b) => (b[1].code?.length ?? 0) - (a[1].code?.length ?? 0))
        .slice(0, 6)
        .forEach(([name, out]) => {
          console.log(`\n--- ${name} (${out.code?.length ?? 0} bytes) ---`);
          Object.entries(out.modules ?? {})
            .map(([id, mod]) => ({ id, size: mod.renderedLength ?? 0 }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 14)
            .forEach((mod) => console.log(String(mod.size).padStart(8), mod.id.replace(`${process.cwd()}/`, "")));
        });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET ?? "https://fac.firstadvantageconsulting.com:9001";
  const apiProxy = {
    "/api": {
      target: apiProxyTarget,
      changeOrigin: true,
      secure: false,
    },
  };

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: apiProxy,
    },
    preview: {
      host: "::",
      port: 8080,
      proxy: apiProxy,
    },
    plugins: [react(), ...(mode === "analyze" ? [moduleReport()] : [])],
    build: {
      // Long-lived chunks for code that every route needs. Only React/react-dom
      // are pinned explicitly: grouping whole library families (all of Radix,
      // all icons) would drag page-only modules onto the initial path, because
      // the shell's static imports make those chunks eager. Everything else is
      // left to Rollup, which already shares modules between lazy routes.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
            // React Flow, dagre and friends are only reachable through the
            // lazily imported organisation map; keeping them together avoids
            // dagre being re-inlined into two graph chunks.
            if (/node_modules\/(@xyflow|dagre|graphlib|d3-[a-z]+|lodash)\//.test(id)) return "vendor-graph";
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // A single instance of the Radix layer context is what stops the
      // `pointer-events: none` body lock from leaking after a Dialog opened
      // from a DropdownMenu (see issue #16). Without this, Vite's dev
      // pre-bundler can inline its own copy of `@radix-ui/react-dismissable-layer`
      // into each Radix entry, giving dialog and dropdown-menu separate contexts.
      dedupe: ["@radix-ui/react-dismissable-layer"],
    },
  };
});
