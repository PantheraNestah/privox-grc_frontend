import { act, render, screen } from "@testing-library/react";
import { AuthBackdrop } from "./AuthBackdrop";

const rings = () => screen.getAllByTestId("backdrop-ring");
const opacities = () => rings().map((r) => (r as HTMLElement).style.opacity);
const positions = () => rings().map((r) => `${(r as HTMLElement).style.left}/${(r as HTMLElement).style.top}`);

describe("AuthBackdrop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders decorative rings that start hidden", () => {
    render(<AuthBackdrop />);

    expect(rings()).toHaveLength(6);
    expect(opacities().every((o) => o === "0")).toBe(true);
    rings().forEach((r) => expect(r).toHaveAttribute("aria-hidden", "true"));
  });

  it("fades rings in and back out on their own schedule", () => {
    render(<AuthBackdrop />);

    act(() => vi.advanceTimersByTime(6000));
    expect(opacities().some((o) => o === "1")).toBe(true);

    // Long enough for every ring to have completed at least one full show/hide cycle.
    act(() => vi.advanceTimersByTime(60_000));
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      act(() => vi.advanceTimersByTime(1500));
      seen.add(opacities().join(","));
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it("moves a ring to a new random spot between appearances", () => {
    render(<AuthBackdrop />);
    const before = new Set(positions());

    act(() => vi.advanceTimersByTime(90_000));

    expect(new Set([...before, ...positions()]).size).toBeGreaterThan(before.size);
  });

  it("stops all timers when unmounted", () => {
    const { unmount } = render(<AuthBackdrop />);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows static rings and schedules nothing when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: true, media: query }) as MediaQueryList,
    );
    render(<AuthBackdrop />);

    expect(opacities().every((o) => o === "1")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
