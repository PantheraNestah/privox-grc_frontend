import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { DeferredRender } from "./DeferredRender";

/** Minimal IntersectionObserver stand-in that lets a test fire visibility. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  disconnect() {
    this.disconnected = true;
  }

  unobserve() {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  fire(isIntersecting: boolean) {
    this.callback(
      this.observed.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

const withObserver = (enabled: boolean) => {
  FakeObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", enabled ? FakeObserver : undefined);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeferredRender", () => {
  it("holds children back until the wrapper approaches the viewport", () => {
    withObserver(true);
    render(
      <DeferredRender fallback={<span>placeholder</span>}>
        <span>heavy widget</span>
      </DeferredRender>,
    );

    expect(screen.getByText("placeholder")).toBeInTheDocument();
    expect(screen.queryByText("heavy widget")).not.toBeInTheDocument();

    act(() => FakeObserver.instances[0].fire(true));

    expect(screen.getByText("heavy widget")).toBeInTheDocument();
    // The observer is dropped once mounted: scrolling away must not unmount.
    expect(FakeObserver.instances[0].disconnected).toBe(true);
  });

  it("ignores entries that are still off screen", () => {
    withObserver(true);
    render(
      <DeferredRender fallback={<span>placeholder</span>}>
        <span>heavy widget</span>
      </DeferredRender>,
    );

    act(() => FakeObserver.instances[0].fire(false));

    expect(screen.getByText("placeholder")).toBeInTheDocument();
    expect(screen.queryByText("heavy widget")).not.toBeInTheDocument();
  });

  it("mounts immediately where IntersectionObserver is unavailable", () => {
    withObserver(false);
    render(
      <DeferredRender fallback={<span>placeholder</span>}>
        <span>heavy widget</span>
      </DeferredRender>,
    );

    expect(screen.getByText("heavy widget")).toBeInTheDocument();
  });
});
