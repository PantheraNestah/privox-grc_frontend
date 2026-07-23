/**
 * Environment configuration helper.
 * All public variables must be prefixed with VITE_ per Vite convention.
 */

function required(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Add it to your .env file (see .env.example for reference).`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return import.meta.env[name] ?? fallback;
}

export const config = {
  /** Backend API base URL (your server that connects to PostgreSQL) */
  apiUrl: required("VITE_API_URL"),

  /** API request timeout in milliseconds */
  apiTimeout: Number(optional("VITE_API_TIMEOUT", "30000")),

  /** Application display name */
  appName: optional("VITE_APP_NAME", "GRC Platform"),
} as const;
