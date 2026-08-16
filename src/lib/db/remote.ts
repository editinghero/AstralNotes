import type {
  AccountRow,
  Database,
  NoteRow,
  SharePublic,
  ShareRow,
} from "./types";

/**
 * Cloudflare D1 adapter. Talks to the JSON API served by
 * `src/routes/api/public/db/$action.ts`, which is the only thing that touches
 * the database. Payloads are encrypted in the browser before they get here.
 */

const BASE = "/api/public/db";

async function rpc<T>(action: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${action} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const remoteDb: Database = {
  getAccount: (email) => rpc<AccountRow | null>("get-account", { email }),
  createAccount: (row) => rpc<void>("create-account", row),

  listNotes: (email) => rpc<NoteRow[]>("list-notes", { email }),
  upsertNote: (row) => rpc<void>("upsert-note", row),
  deleteNote: (email, id) => rpc<void>("delete-note", { email, id }),

  listShares: (noteId) =>
    rpc<Pick<ShareRow, "id" | "expires_at" | "created_at">[]>("list-shares", {
      note_id: noteId,
    }),
  getShare: (id) => rpc<SharePublic | null>("get-share", { id }),
  createShare: (row) => rpc<void>("create-share", row),
  deleteShare: (id) => rpc<void>("delete-share", { id }),
};
