import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
    plugins: [react()],
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
