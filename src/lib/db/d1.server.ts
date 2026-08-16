/**
 * Server-only D1 access. This is the ONLY place that talks to the database.
 *
 * In production the Worker exposes the `DB` binding (see D1-SETUP.md). During
 * local development / preview, where no D1 binding exists, an ephemeral
 * in-memory store is used so the app is testable. That store is per-process,
 * never written to disk, and disappears on restart.
 */

type Row = Record<string, unknown>;

type D1Like = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first(): Promise<Row | null>;
      all(): Promise<{ results: Row[] }>;
      run(): Promise<unknown>;
    };
  };
};

let cached: D1Like | null | undefined;

export async function isSignupDisabled(): Promise<boolean> {
  try {
    let cloudflareEnv: Record<string, unknown> | undefined;
    try {
      const specifier = "cloudflare:workers";
      const mod = (await import(/* @vite-ignore */ specifier)) as {
        env?: Record<string, unknown>;
      };
      cloudflareEnv = mod.env;
    } catch {
      /* not workers */
    }

    const val =
      cloudflareEnv?.["DISABLE_SIGNUP"] ??
      cloudflareEnv?.["VITE_DISABLE_SIGNUP"] ??
      (typeof process !== "undefined" &&
        (process.env?.["DISABLE_SIGNUP"] ??
          process.env?.["VITE_DISABLE_SIGNUP"])) ??
      (typeof import.meta !== "undefined" &&
        import.meta.env?.["VITE_DISABLE_SIGNUP"]) ??
      (typeof globalThis !== "undefined" &&
        ((globalThis as unknown as Record<string, unknown>)["DISABLE_SIGNUP"] ??
          (globalThis as unknown as Record<string, unknown>)[
            "VITE_DISABLE_SIGNUP"
          ]));
    return val === true || val === "true" || val === "1";
  } catch {
    return false;
  }
}

export async function getD1(): Promise<D1Like | null> {
  if (cached !== undefined) return cached;
  cached = null;

  // 1. Direct global binding check (Cloudflare Workers / miniflare)
  const globalBinding =
    (globalThis as unknown as Record<string, unknown>)["DB"] ??
    (typeof process !== "undefined"
      ? (process.env as unknown as Record<string, unknown>)?.["DB"]
      : undefined);
  if (
    globalBinding &&
    typeof (globalBinding as D1Like).prepare === "function"
  ) {
    cached = globalBinding as D1Like;
    return cached;
  }

  // 2. cloudflare:workers module check
  try {
    const specifier = "cloudflare:workers";
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      env?: Record<string, unknown>;
    };
    const binding = mod.env?.["DB"];
    if (binding && typeof (binding as D1Like).prepare === "function") {
      cached = binding as D1Like;
    }
  } catch {
    /* not running on Workers */
  }
  return cached;
}

/* ---------------------------------------------------------------- dev store */

type Store = { accounts: Row[]; notes: Row[]; shares: Row[] };

const memory: Store = { accounts: [], notes: [], shares: [] };

/* ------------------------------------------------------------------- queries */

export type Action =
  | "get-account"
  | "create-account"
  | "list-notes"
  | "upsert-note"
  | "delete-note"
  | "list-shares"
  | "get-share"
  | "create-share"
  | "delete-share";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

export async function runAction(action: Action, body: Row): Promise<unknown> {
  const db = await getD1();
  const now = Date.now();

  switch (action) {
    case "get-account": {
      const email = str(body["email"]).toLowerCase();
      if (!email) return null;
      if (db)
        return await db
          .prepare(
            "SELECT email, salt, verifier, wrapped_iv, wrapped_data, created_at FROM accounts WHERE email = ?",
          )
          .bind(email)
          .first();
      return memory.accounts.find((a) => a["email"] === email) ?? null;
    }

    case "create-account": {
      if (await isSignupDisabled()) {
        throw new Error("Signups are currently disabled.");
      }
      const row = {
        email: str(body["email"]).toLowerCase(),
        salt: str(body["salt"]),
        verifier: str(body["verifier"]),
        wrapped_iv: str(body["wrapped_iv"]),
        wrapped_data: str(body["wrapped_data"]),
        created_at: num(body["created_at"]) || now,
      };
      if (!row.email || !row.salt || !row.verifier)
        throw new Error("Invalid account");
      if (db) {
        await db
          .prepare(
            `INSERT INTO accounts (email, salt, verifier, wrapped_iv, wrapped_data, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            row.email,
            row.salt,
            row.verifier,
            row.wrapped_iv,
            row.wrapped_data,
            row.created_at,
          )
          .run();
      } else {
        if (memory.accounts.some((a) => a["email"] === row.email))
          throw new Error("Account exists");
        memory.accounts.push(row);
      }
      return { ok: true };
    }

    case "list-notes": {
      const email = str(body["email"]).toLowerCase();
      if (!email) return [];
      if (db) {
        const { results } = await db
          .prepare(
            "SELECT id, email, iv, data, created_at, updated_at, pinned FROM notes WHERE email = ? ORDER BY pinned DESC, updated_at DESC",
          )
          .bind(email)
          .all();
        return results;
      }
      return memory.notes
        .filter((n) => n["email"] === email)
        .sort(
          (a, b) =>
            num(b["pinned"]) - num(a["pinned"]) ||
            num(b["updated_at"]) - num(a["updated_at"]),
        );
    }

    case "upsert-note": {
      const row = {
        id: str(body["id"]),
        email: str(body["email"]).toLowerCase(),
        iv: str(body["iv"]),
        data: str(body["data"]),
        created_at: num(body["created_at"]) || now,
        updated_at: num(body["updated_at"]) || now,
        pinned: body["pinned"] ? 1 : 0,
      };
      if (!row.id || !row.email || !row.iv || !row.data)
        throw new Error("Invalid note");
      if (db) {
        await db
          .prepare(
            `INSERT INTO notes (id, email, iv, data, created_at, updated_at, pinned)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               iv = excluded.iv, data = excluded.data,
               updated_at = excluded.updated_at, pinned = excluded.pinned
             WHERE notes.email = excluded.email`,
          )
          .bind(
            row.id,
            row.email,
            row.iv,
            row.data,
            row.created_at,
            row.updated_at,
            row.pinned,
          )
          .run();
      } else {
        const i = memory.notes.findIndex((n) => n["id"] === row.id);
        if (i >= 0 && memory.notes[i]?.["email"] !== row.email)
          throw new Error("Forbidden");
        if (i >= 0) memory.notes[i] = row;
        else memory.notes.push(row);
      }
      return { ok: true };
    }

    case "delete-note": {
      const id = str(body["id"]);
      const email = str(body["email"]).toLowerCase();
      if (db) {
        await db
          .prepare("DELETE FROM notes WHERE id = ? AND email = ?")
          .bind(id, email)
          .run();
        await db
          .prepare(
            "DELETE FROM shares WHERE note_id = ? AND note_id IN (SELECT id FROM notes WHERE email = ?)",
          )
          .bind(id, email)
          .run();
      } else {
        memory.notes = memory.notes.filter(
          (n) => !(n["id"] === id && n["email"] === email),
        );
        memory.shares = memory.shares.filter((s) => s["note_id"] !== id);
      }
      return { ok: true };
    }

    case "list-shares": {
      const noteId = str(body["note_id"]);
      if (db) {
        const { results } = await db
          .prepare(
            "SELECT id, expires_at, created_at FROM shares WHERE note_id = ? ORDER BY created_at DESC",
          )
          .bind(noteId)
          .all();
        return results;
      }
      return memory.shares
        .filter((s) => s["note_id"] === noteId)
        .map((s) => ({
          id: s["id"],
          expires_at: s["expires_at"],
          created_at: s["created_at"],
        }));
    }

    case "get-share": {
      const id = str(body["id"]);
      if (!id) return null;
      let row: Row | null;
      if (db) {
        row = await db
          .prepare(
            "SELECT id, salt, iv, data, expires_at FROM shares WHERE id = ?",
          )
          .bind(id)
          .first();
      } else {
        row = memory.shares.find((s) => s["id"] === id) ?? null;
      }
      if (!row) return null;
      const expires = row["expires_at"];
      // Expiry is enforced server-side: an expired link returns nothing at all.
      if (typeof expires === "number" && expires < now) {
        if (db)
          await db.prepare("DELETE FROM shares WHERE id = ?").bind(id).run();
        else memory.shares = memory.shares.filter((s) => s["id"] !== id);
        return null;
      }
      return {
        id: row["id"],
        salt: row["salt"],
        iv: row["iv"],
        data: row["data"],
        expires_at: typeof expires === "number" ? expires : null,
      };
    }

    case "create-share": {
      const row = {
        id: str(body["id"]),
        note_id: str(body["note_id"]),
        salt: str(body["salt"]),
        iv: str(body["iv"]),
        data: str(body["data"]),
        expires_at:
          typeof body["expires_at"] === "number"
            ? (body["expires_at"] as number)
            : null,
        created_at: num(body["created_at"]) || now,
      };
      if (row.id.length < 10 || !row.note_id || !row.salt || !row.data)
        throw new Error("Invalid share");
      if (db) {
        await db
          .prepare(
            `INSERT INTO shares (id, note_id, salt, iv, data, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            row.id,
            row.note_id,
            row.salt,
            row.iv,
            row.data,
            row.expires_at,
            row.created_at,
          )
          .run();
      } else {
        memory.shares.push(row);
      }
      return { ok: true };
    }

    case "delete-share": {
      const id = str(body["id"]);
      if (db)
        await db.prepare("DELETE FROM shares WHERE id = ?").bind(id).run();
      else memory.shares = memory.shares.filter((s) => s["id"] !== id);
      return { ok: true };
    }

    default:
      throw new Error("Unknown action");
  }
}
