/**
 * Environment configuration helper.
 * All public variables must be prefixed with VITE_ per Vite convention.
 *
 * Resolution order: `window.__ENV__` (injected at container start by
 * docker/entrypoint.d/50-generate-runtime-env.sh, so one built image can be
 * reconfigured per deployment) then `import.meta.env` (baked in at build
 * time, used for local dev and non-container builds).
 */

declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>;
  }
}

function readEnv(name: string): string | undefined {
  const runtimeValue = typeof window !== "undefined" ? window.__ENV__?.[name] : undefined;
  return runtimeValue || import.meta.env[name];
}

function required(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Add it to your .env file for local dev (see .env.example), or set it ` +
        `on the container so it is written into env.js at startup.`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return readEnv(name) ?? fallback;
}

export const config = {
  /** Backend API base URL (your server that connects to PostgreSQL) */
  apiUrl: required("VITE_API_URL"),

  /** API request timeout in milliseconds */
  apiTimeout: Number(optional("VITE_API_TIMEOUT", "30000")),

  /** Application display name */
  appName: optional("VITE_APP_NAME", "GRC Platform"),
} as const;
