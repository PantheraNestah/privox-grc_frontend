/**
 * Cross-tab session consistency.
 *
 * The refresh token lives in `localStorage`, so all tabs of one browser share
 * it. A switch (or logout) in one tab therefore changes the session the other
 * tabs would reach on their next refresh. We broadcast those events so a tab
 * can stop using a session it no longer owns instead of silently writing to
 * the wrong organization.
 *
 * `BroadcastChannel` is the transport; a `localStorage` envelope is written as
 * well so browsers without it (and older sessions) still converge.
 */

export type SessionChange =
  | {
      type: "login";
      organizationName?: string;
      organizationId?: string;
      userId?: string;
    }
  | { type: "switched"; organizationName: string }
  | { type: "logout" };

export interface SessionChangeEnvelope {
  id: string;
  at: number;
  message: SessionChange;
}

export const SESSION_CHANNEL = "grc-session";
/** Written beside `grc_refresh_token` so the fallback shares its lifetime. */
export const SESSION_EVENT_KEY = "grc_session_event";

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel =
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(SESSION_CHANNEL);
  return channel;
}

/** Forget the cached channel (tests replace the global between cases). */
export function resetSessionChannel() {
  channel?.close();
  channel = undefined;
}

/** Tells other tabs that this tab changed the shared session. */
export function publishSessionChange(message: SessionChange) {
  const envelope: SessionChangeEnvelope = { id: newId(), at: Date.now(), message };

  try {
    getChannel()?.postMessage(envelope);
  } catch {
    // Closed/unavailable channel: the storage envelope below still covers it.
  }

  try {
    localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify(envelope));
  } catch {
    // Storage may be unavailable (private mode); BroadcastChannel still works.
  }
}

function parseEnvelope(raw: unknown): SessionChangeEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<SessionChangeEnvelope>;
  if (typeof value.id !== "string" || !value.message) return null;
  const type = (value.message as SessionChange).type;
  if (type !== "login" && type !== "switched" && type !== "logout") return null;
  return value as SessionChangeEnvelope;
}

/**
 * Subscribes to session changes from *other* tabs. Returns an unsubscribe
 * function. Messages are de-duplicated: `BroadcastChannel` and the storage
 * event normally deliver the same envelope.
 */
export function subscribeSessionChange(
  handler: (message: SessionChange) => void,
): () => void {
  const seen = new Set<string>();

  const deliver = (envelope: SessionChangeEnvelope | null) => {
    if (!envelope || seen.has(envelope.id)) return;
    seen.add(envelope.id);
    handler(envelope.message);
  };

  const onMessage = (event: MessageEvent) => deliver(parseEnvelope(event.data));
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
    try {
      deliver(parseEnvelope(JSON.parse(event.newValue)));
    } catch {
      // Ignore malformed envelopes rather than breaking the listener.
    }
  };

  const broadcast = getChannel();
  broadcast?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);

  return () => {
    broadcast?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}

// ─── Frozen tenant session ────────────────────────────────
// A tab that learns the shared session moved must not keep issuing requests
// with its stale access token: they would land in the new organization.

let frozen = false;

export function freezeTenantSession() {
  frozen = true;
}

export function isTenantSessionFrozen(): boolean {
  return frozen;
}

/** Thrown instead of sending a tenant request while the tab is frozen. */
export class SessionFrozenError extends Error {
  constructor() {
    super("The organization session changed in another tab. Reload to continue.");
    this.name = "SessionFrozenError";
  }
}

/** A reload is the only way out; the flag is intentionally memory-only. */
export function resetTenantSessionFreeze() {
  frozen = false;
}
