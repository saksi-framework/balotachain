/**
 * A stubbed `fetch` for the presenter tests: each route answers from a
 * fixture file, and every call is recorded with its init. The same fixture
 * files feed the screenshot script, which serves them by network
 * interception; nothing here is part of the built page.
 */
import { vi } from "vitest";

export type Answer = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

const views = import.meta.glob("./fixtures/live/views/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Answer>;
const answers = import.meta.glob("./fixtures/live/answers/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Answer>;

/** A deep copy of a view fixture, so a test may change it. */
export function view(name: string): Answer {
  const a = views[`./fixtures/live/views/${name}.json`];
  if (!a) throw new Error(`no view fixture ${name}`);
  return JSON.parse(JSON.stringify(a)) as Answer;
}

export function answer(name: string): Answer {
  const a = answers[`./fixtures/live/answers/${name}.json`];
  if (!a) throw new Error(`no answer fixture ${name}`);
  return JSON.parse(JSON.stringify(a)) as Answer;
}

/** A route's answer: fixed, or computed per call; "hang" never answers. */
export type Route = Answer | (() => Answer | "hang" | Error) | "hang";

export type Call = { method: string; path: string; init?: RequestInit };

export function respond(a: Answer): Response {
  const text = typeof a.body === "string" ? a.body : JSON.stringify(a.body);
  return new Response(text, {
    status: a.status,
    headers: { "Content-Type": "application/json", ...(a.headers ?? {}) },
  });
}

/**
 * Installs the stub. `routes` keys are "GET /api/live/election" etc.; a
 * route missing from it answers 404 plain text.
 */
export function stubFetch(routes: Record<string, Route>) {
  const calls: Call[] = [];
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, path, init });
    const route = routes[`${method} ${path}`];
    const signal = init?.signal;
    const resolved = typeof route === "function" ? route() : route;
    if (resolved instanceof Error) return Promise.reject(resolved);
    if (resolved === "hang") {
      return new Promise<Response>((_, reject) => {
        // As a browser's fetch: it rejects with the signal's reason.
        signal?.addEventListener("abort", () =>
          reject(signal.reason ?? new DOMException("aborted", "AbortError")),
        );
      });
    }
    if (!resolved)
      return Promise.resolve(
        new Response("404 page not found", { status: 404 }),
      );
    return Promise.resolve(respond(resolved));
  });
  vi.stubGlobal("fetch", fn);
  return {
    calls,
    routes,
    /** The calls to one route. */
    to: (method: string, path: string) =>
      calls.filter((c) => c.method === method && c.path === path),
  };
}
