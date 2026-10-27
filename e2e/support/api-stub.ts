import type { Page, Route } from "@playwright/test";

/**
 * Hermetic `/v1/**` stub registry.
 *
 * Every API request is intercepted: a request without a registered handler is
 * answered with 501 and recorded as `unstubbed`, so a forgotten endpoint fails
 * loudly instead of hanging or reaching a real backend.
 */

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RecordedCall {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
  headers: Record<string, string>;
}

export interface StubContext {
  route: Route;
  call: RecordedCall;
  params: Record<string, string>;
}

export type StubHandler = (context: StubContext) => void | Promise<void>;

interface Entry {
  method: ApiMethod;
  pattern: RegExp;
  keys: string[];
  handler: StubHandler;
}

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
};

/** `/v1/organizations/:orgId/members/:userId` → regex + param keys. */
function compile(template: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = template
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
      keys.push(key);
      return "([^/]+)";
    });
  return { pattern: new RegExp(`^${source}$`), keys };
}

/** The API base may end in `/api` (`.env`) or be relative (`.env.example`). */
const pathOf = (url: string): string => new URL(url).pathname.replace(/^\/api(?=\/)/, "");

export class ApiStubs {
  private readonly entries: Entry[] = [];
  readonly calls: RecordedCall[] = [];
  /** Requests that had no registered handler; the fixture fails the test on them. */
  readonly unstubbed: string[] = [];

  constructor(private readonly page: Page) {
    void page.route("**/v1/**", (route) => this.dispatch(route));
  }

  /** Register a handler. Path templates use `:param` placeholders. */
  on(method: ApiMethod, path: string, handler: StubHandler): this {
    const { pattern, keys } = compile(path);
    this.entries.push({ method, pattern, keys, handler });
    return this;
  }

  /** Shorthand: always answer with the same JSON body (and optional status). */
  reply(method: ApiMethod, path: string, body: unknown, status = 200): this {
    return this.on(method, path, ({ route }) => this.json(route, body, status));
  }

  /** Shorthand: answer with a JSON error the app can branch on. */
  fail(method: ApiMethod, path: string, status: number, message = "Request failed"): this {
    return this.reply(method, path, { message }, status);
  }

  json(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
    return route.fulfill({
      status,
      headers: {
        ...CORS_HEADERS,
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  /** Calls recorded for one method/path, in order. */
  callsTo(method: ApiMethod, path: string): RecordedCall[] {
    const { pattern } = compile(path);
    return this.calls.filter(
      (call) => call.method === method && pattern.test(call.path),
    );
  }

  private async dispatch(route: Route) {
    const request = route.request();
    const method = request.method().toUpperCase();

    // Cross-origin API base: answer preflights ourselves.
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
      return;
    }

    const url = new URL(request.url());
    const path = pathOf(request.url());
    let body: unknown = undefined;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }

    const call: RecordedCall = {
      method,
      path,
      search: url.searchParams,
      body,
      headers: request.headers(),
    };
    this.calls.push(call);

    for (const entry of [...this.entries].reverse()) {
      if (entry.method !== method) continue;
      const match = entry.pattern.exec(path);
      if (!match) continue;

      const params = Object.fromEntries(
        entry.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]),
      );
      await entry.handler({ route, call, params });
      return;
    }

    await this.json(
      route,
      {
        message: `No stub registered for ${method} ${path}`,
        unstubbed: true,
      },
      501,
    );
    this.unstubbed.push(`${method} ${path}`);
  }
}

export function stubsFor(page: Page): ApiStubs {
  return new ApiStubs(page);
}
