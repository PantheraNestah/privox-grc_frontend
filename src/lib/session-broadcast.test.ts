import {
  SESSION_EVENT_KEY,
  publishSessionChange,
  resetSessionChannel,
  subscribeSessionChange,
  type SessionChangeEnvelope,
} from "./session-broadcast";

const envelope = (
  id: string,
  message: SessionChangeEnvelope["message"],
): SessionChangeEnvelope => ({ id, at: Date.now(), message });

const dispatchStorage = (value: string) => {
  window.dispatchEvent(
    new StorageEvent("storage", { key: SESSION_EVENT_KEY, newValue: value }),
  );
};

describe("session broadcast", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSessionChannel();
  });

  afterEach(() => resetSessionChannel());

  it("writes an envelope other tabs can read (BroadcastChannel fallback)", () => {
    publishSessionChange({ type: "switched", organizationName: "GNC Holdings" });

    const stored = JSON.parse(localStorage.getItem(SESSION_EVENT_KEY) ?? "{}");
    expect(stored.message).toEqual({ type: "switched", organizationName: "GNC Holdings" });
    expect(typeof stored.id).toBe("string");
  });

  it("delivers storage events to subscribers and de-duplicates them", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeSessionChange(handler);
    const event = envelope("evt-1", { type: "switched", organizationName: "GNC Holdings" });

    dispatchStorage(JSON.stringify(event));
    dispatchStorage(JSON.stringify(event));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: "switched",
      organizationName: "GNC Holdings",
    });
    unsubscribe();
  });

  it("delivers logout and login events", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeSessionChange(handler);

    dispatchStorage(JSON.stringify(envelope("evt-2", { type: "logout" })));
    dispatchStorage(
      JSON.stringify(
        envelope("evt-3", {
          type: "login",
          organizationId: "org-2",
          userId: "user-1",
          organizationName: "GNC Holdings",
        }),
      ),
    );

    expect(handler.mock.calls.map(([message]) => message.type)).toEqual(["logout", "login"]);
    unsubscribe();
  });

  it("ignores malformed envelopes and stops after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeSessionChange(handler);

    dispatchStorage("not json");
    dispatchStorage(JSON.stringify({ id: "x", message: { type: "unknown" } }));

    expect(handler).not.toHaveBeenCalled();

    unsubscribe();
    dispatchStorage(JSON.stringify(envelope("evt-4", { type: "logout" })));
    expect(handler).not.toHaveBeenCalled();
  });
});
