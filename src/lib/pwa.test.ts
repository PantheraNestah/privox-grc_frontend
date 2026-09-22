import { afterEach, describe, expect, it, vi } from "vitest";
import { isStandaloneDisplay, registerServiceWorker, supportsServiceWorker } from "./pwa";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window.navigator, "standalone");
});

describe("isStandaloneDisplay", () => {
  it("is false in a normal browser tab", () => {
    expect(isStandaloneDisplay()).toBe(false);
  });

  it("is true when the standalone display-mode query matches", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    expect(isStandaloneDisplay()).toBe(true);
  });

  it("is true for the iOS standalone navigator flag", () => {
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });
    expect(isStandaloneDisplay()).toBe(true);
  });
});

describe("supportsServiceWorker", () => {
  it("reflects navigator.serviceWorker availability", () => {
    expect(supportsServiceWorker()).toBe("serviceWorker" in navigator);
  });
});

describe("registerServiceWorker", () => {
  it("does nothing during development", () => {
    expect(import.meta.env.DEV).toBe(true);
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    registerServiceWorker();

    expect(register).not.toHaveBeenCalled();
  });
});
