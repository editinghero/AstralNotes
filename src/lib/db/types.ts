/**
 * Storage contract. Everything here is ciphertext-only: the D1 database (and
 * therefore anyone with database access) sees random ids, salts, IVs and
 * AES-GCM blobs — never a title, body, tag or password.
 */

export type SealedBlob = { iv: string; data: string };

export type AccountRow = {
  email: string;
  /** PBKDF2 salt for the master password (base64). */
  salt: string;
  /** Verifier hash of the derived key — never the password itself. */
  verifier: string;
  /** Data-encryption key, wrapped with the master-password key. */
  wrapped_iv: string;
  wrapped_data: string;
  created_at: number;
};

/** A note row: title/body/tags all live inside one encrypted payload. */
export type NoteRow = {
  id: string;
  email: string;
  /** Encrypted JSON: { title, body, tags, folder }. */
  iv: string;
  data: string;
  created_at: number;
  updated_at: number;
  pinned: 0 | 1;
};

export type ShareRow = {
  id: string;
  note_id: string;
  /** PBKDF2 salt for the share password (base64). */
  salt: string;
  /** Encrypted JSON: { title, body }. */
  iv: string;
  data: string;
  expires_at: number | null;
  created_at: number;
};

/**
 * What a share visitor is allowed to receive. Deliberately omits `note_id`,
 * `created_at` and anything that could link the link back to its owner.
 */
export type SharePublic = Pick<
  ShareRow,
  "id" | "salt" | "iv" | "data" | "expires_at"
>;

export interface Database {
  getAccount(email: string): Promise<AccountRow | null>;
  createAccount(row: AccountRow): Promise<void>;

  listNotes(email: string): Promise<NoteRow[]>;
  upsertNote(row: NoteRow): Promise<void>;
  deleteNote(email: string, id: string): Promise<void>;

  listShares(
    noteId: string,
  ): Promise<Pick<ShareRow, "id" | "expires_at" | "created_at">[]>;
  getShare(id: string): Promise<SharePublic | null>;
  createShare(row: ShareRow): Promise<void>;
  deleteShare(id: string): Promise<void>;
}
