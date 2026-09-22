import { useCallback, useEffect, useState } from "react";
import { isStandaloneDisplay, type BeforeInstallPromptEvent } from "@/lib/pwa";

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

/**
 * Captures Chrome's `beforeinstallprompt` event so the app can offer an
 * in-app "Install app" action, and reports when the app has been installed.
 *
 * On browsers that don't fire the event (e.g. iOS Safari, or when the PWA
 * criteria aren't met) `canInstall` stays false and the UI can hide the button.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Stop Chrome's mini-infobar and keep the event for a later user gesture.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  return { canInstall: !!deferredPrompt && !installed, installed, promptInstall };
}
