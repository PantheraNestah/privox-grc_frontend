/**
 * Turns a failed request into something a person can act on.
 *
 * The point is to keep "there is nothing here yet" away from the error path:
 * an empty list is a `200` with `[]` or `204`, never an error. Only a real
 * failure reaches this module, and each kind gets its own wording so a missing
 * feature or a missing permission does not look like a broken server.
 */

import { isAxiosError } from "axios";

export type LoadFailureKind = "offline" | "forbidden" | "not-found" | "server" | "failed";

export interface LoadFailure {
  kind: LoadFailureKind;
  title: string;
  message: string;
  /** Worth offering "Try again": transient problems and server faults. */
  retryable: boolean;
}

/**
 * @param subject what could not be loaded, lower case, e.g. "initiatives".
 */
export function classifyLoadFailure(error: unknown, subject: string): LoadFailure {
  if (!isAxiosError(error)) {
    return { kind: "failed", title: `Couldn't load ${subject}`, message: "Please try again.", retryable: true };
  }
  if (!error.response) {
    return {
      kind: "offline",
      title: "Can't reach the server",
      message: `Check your connection, then try again. ${capitalise(subject)} will appear once the server answers.`,
      retryable: true,
    };
  }
  const status = error.response.status;
  if (status === 401) {
    return { kind: "forbidden", title: "Session expired", message: "Sign in again to continue.", retryable: false };
  }
  if (status === 403) {
    return {
      kind: "forbidden",
      title: `No access to ${subject}`,
      message: `Your role does not include ${subject}. Ask an organization administrator if you need it.`,
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      kind: "not-found",
      title: `${capitalise(subject)} isn't available here`,
      message: "This server does not offer it yet, or it was turned off. Nothing is wrong with your data.",
      retryable: false,
    };
  }
  if (status >= 500) {
    return {
      kind: "server",
      title: `Couldn't load ${subject}`,
      message: "The server had a problem. Try again in a moment.",
      retryable: true,
    };
  }
  return { kind: "failed", title: `Couldn't load ${subject}`, message: "Please try again.", retryable: true };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
