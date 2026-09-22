import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt, type InstallOutcome } from "./use-install-prompt";
import type { BeforeInstallPromptEvent } from "@/lib/pwa";

function makePromptEvent(outcome: "accepted" | "dismissed") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  Object.assign(event, {
    platforms: ["web"],
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  return { event, prompt };
}

afterEach(() => vi.restoreAllMocks());

describe("useInstallPrompt", () => {
  it("exposes the prompt after beforeinstallprompt and reports the choice", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);

    const { event, prompt } = makePromptEvent("accepted");
    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);

    let outcome: InstallOutcome | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe("accepted");
    expect(result.current.canInstall).toBe(false);
  });

  it("returns 'unavailable' when no prompt was captured", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    let outcome: InstallOutcome | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(outcome).toBe("unavailable");
  });

  it("marks the app installed after appinstalled fires", () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(result.current.installed).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });
});
