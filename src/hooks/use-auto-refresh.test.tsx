import { act, renderHook } from "@testing-library/react";
import { useAutoRefresh, useSyncedLocalResource } from "./use-auto-refresh";
import { REFRESH_INTERVALS } from "@/lib/live-refresh";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls on the configured cadence while the tab is visible", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { cadence: "fast" }));

    act(() => void vi.advanceTimersByTime(REFRESH_INTERVALS.fast - 1));
    expect(refresh).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => void vi.advanceTimersByTime(REFRESH_INTERVALS.fast * 2));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("does not poll a hidden tab, but refreshes as soon as it is shown again", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { intervalMs: 1_000 }));

    setVisibility("hidden");
    act(() => void vi.advanceTimersByTime(5_000));
    expect(refresh).not.toHaveBeenCalled();

    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the browser comes back online", () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { intervalMs: 1_000 }));

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops refreshing when disabled and honours refreshNow", () => {
    const refresh = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) => useAutoRefresh(refresh, { intervalMs: 1_000, enabled }),
      { initialProps: { enabled: true } },
    );

    act(() => void vi.advanceTimersByTime(1_000));
    expect(refresh).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    act(() => void vi.advanceTimersByTime(5_000));
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => result.current.refreshNow());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.lastRefreshedAt).not.toBeNull();
  });

  it("reports completion of an async refresh and survives a rejected one", async () => {
    let reject: (reason?: unknown) => void = () => {};
    const refresh = vi.fn(
      () => new Promise<void>((_, rej) => {
        reject = rej;
      }),
    );
    const { result } = renderHook(() => useAutoRefresh(refresh, { intervalMs: 1_000 }));

    act(() => void vi.advanceTimersByTime(1_000));
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      reject(new Error("offline"));
      await Promise.resolve();
    });
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.lastRefreshedAt).not.toBeNull();
  });
});

describe("useSyncedLocalResource", () => {
  const KEY = "test.store.v1";

  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const loader = () => localStorage.getItem(KEY) ?? "empty";

  it("re-reads when another tab writes the same key", () => {
    localStorage.setItem(KEY, "first");
    const { result } = renderHook(() => useSyncedLocalResource(loader, { storageKeys: [KEY] }));
    expect(result.current.data).toBe("first");

    act(() => {
      localStorage.setItem(KEY, "second");
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(result.current.data).toBe("second");
  });

  it("re-reads on the same-tab change event and ignores unrelated keys", () => {
    localStorage.setItem(KEY, "first");
    const { result } = renderHook(() =>
      useSyncedLocalResource(loader, { storageKeys: [KEY], events: ["test:changed"] }),
    );

    act(() => {
      localStorage.setItem(KEY, "ignored");
      window.dispatchEvent(new StorageEvent("storage", { key: "other.key" }));
    });
    expect(result.current.data).toBe("first");

    act(() => {
      localStorage.setItem(KEY, "third");
      window.dispatchEvent(new Event("test:changed"));
    });
    expect(result.current.data).toBe("third");
  });

  it("picks up writes that happened before it mounted", () => {
    const { result } = renderHook(() => useSyncedLocalResource(loader, { intervalMs: 1_000 }));
    expect(result.current.data).toBe("empty");

    act(() => {
      localStorage.setItem(KEY, "later");
      void vi.advanceTimersByTime(1_000);
    });
    expect(result.current.data).toBe("later");
  });
});
