import { createFileRoute } from "@tanstack/react-router";
import { runAction, type Action } from "@/lib/db/d1.server";

/**
 * The only database endpoint. It stores and returns opaque ciphertext, so a
 * compromised endpoint still cannot read a single note.
 *
 * Hardening implemented here:
 *  - allow-list of actions, JSON body size cap, no error details leaked
 *  - share reads are rate limited per IP to slow guessing of link ids and
 *    offline attacks on share passwords
 *  - expired shares are deleted and reported as "not found"
 *  - responses are never cached
 */

const ACTIONS = new Set<Action>([
  "get-account",
  "create-account",
  "list-notes",
  "upsert-note",
  "delete-note",
  "list-shares",
  "get-share",
  "create-share",
  "delete-share",
]);

const SENSITIVE: Action[] = ["get-share", "get-account"];
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(key: string) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body ?? null), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });

export const Route = createFileRoute("/api/public/db/$action")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const action = params.action as Action;
        if (!ACTIONS.has(action))
          return new Response("Not found", { status: 404 });

        const raw = await request.text();
        if (raw.length > 2_000_000)
          return new Response("Payload too large", { status: 413 });

        if (SENSITIVE.includes(action)) {
          const ip = request.headers.get("cf-connecting-ip") ?? "local";
          if (rateLimited(`${action}:${ip}`))
            return new Response("Too many requests", { status: 429 });
        }

        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw || "{}") as Record<string, unknown>;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        try {
          return json(await runAction(action, body));
        } catch {
          return new Response("Request failed", { status: 400 });
        }
      },
    },
  },
});
