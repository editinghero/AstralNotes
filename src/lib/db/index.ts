import { remoteDb } from "./remote";
import type { Database } from "./types";

/**
 * Single storage backend: Cloudflare D1, reached through the JSON API at
 * `/api/public/db/:action`. Nothing about a note is ever kept in the browser —
 * the only local secret is the optional device lock (see `src/lib/vault.ts`).
 */
export const db: Database = remoteDb;

export type * from "./types";
