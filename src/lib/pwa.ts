/**
 * PWA / WebAPK helpers.
 *
 * Chrome only mints a WebAPK — the real Android package it installs from the
 * browser — for a site that is a valid, installable PWA: served over HTTPS,
 * with a web app manifest (name, 192/512 icons, start_url, standalone display)
 * and a registered service worker that has a `fetch` handler. This module
 * registers that worker and exposes the install prompt to the UI.
 */

/** Chrome's non-standard install prompt event (`beforeinstallprompt`). */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

/** True when the app is already running as an installed app (standalone). */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

export function supportsServiceWorker(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Register the app-shell service worker. Skipped during development so Vite's
 * HMR and the dev server are never shadowed by a cached response.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !supportsServiceWorker()) return;

  const base = import.meta.env.BASE_URL || "/";
  const register = () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch((error) => console.warn("[pwa] service worker registration failed", error));
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
