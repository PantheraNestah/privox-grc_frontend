import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** The fields of a rendered chunk that the report reads. */
interface ChunkLike {
  code?: string;
  modules?: Record<string, { renderedLength?: number }>;
}

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
      const chunks: Array<[string, ChunkLike]> = [];
      for (const [name, out] of Object.entries(bundle)) {
        if (out.type === "chunk") chunks.push([name, out]);
      }
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
      // Vite 8 (Rolldown) splits every small shared module into its own file,
      // and the eager shell then pulls a dozen of them into the first load.
      // Explicit groups keep React and the graph libraries in stable chunks
      // while leaving everything else to the bundler. Only React/react-dom are
      // pinned to the entry: grouping whole library families would drag
      // page-only modules onto the initial path.
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "vendor-react", test: /node_modules\/(react|react-dom|scheduler)\//, priority: 20 },
              // Data layer: always on the first load, and as separate chunks the
              // small query/api modules cost more in per-file overhead than they hold.
              { name: "vendor-data", test: /node_modules\/(@tanstack|axios)\//, priority: 15 },
              // React Flow, dagre and friends are only reachable through the
              // lazily imported organisation map.
              { name: "vendor-graph", test: /node_modules\/(@xyflow|dagre|graphlib|d3-[a-z]+|lodash)\//, priority: 10 },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
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
