import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "./db";
import type { NoteRow, ShareRow } from "./db/types";
import {
  createVaultKeys,
  deriveKey,
  open,
  passwordVerifier,
  randomBytes,
  randomId,
  seal,
  toB64,
  unlockVaultKey,
  fromB64,
  exportDek,
  importDek,
} from "./crypto";

export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  folder: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

type NotePayload = Pick<Note, "title" | "body" | "tags" | "folder">;

const SESSION_EMAIL = "cn:session-email";
const QUICK_LOCK = "cn:quick-lock";

/**
 * Device-only quick lock: the data key is re-wrapped with a short secondary
 * password and kept in localStorage. It never reaches the database, so
 * clearing site data (or signing out) forces a fresh setup with the master
 * password.
 */
type QuickLockRecord = {
  email: string;
  salt: string;
  iv: string;
  data: string;
};

function readQuickLock(): QuickLockRecord | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUICK_LOCK);
    return raw ? (JSON.parse(raw) as QuickLockRecord) : null;
  } catch {
    return null;
  }
}

async function decodeNote(key: CryptoKey, row: NoteRow): Promise<Note> {
  const payload = JSON.parse(
    await open(key, { iv: row.iv, data: row.data }),
  ) as NotePayload;
  return {
    id: row.id,
    title: payload.title ?? "",
    body: payload.body ?? "",
    tags: payload.tags ?? [],
    folder: payload.folder ?? "",
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortNotes(notes: Note[]) {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
  );
}

/** Whole-app state: auth + decrypted notes. Plain React hooks, no data lib. */
export function useVault() {
  const [email, setEmail] = useState<string | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [quickLock, setQuickLock] = useState<QuickLockRecord | null>(null);

  useEffect(() => {
    setEmail(sessionStorage.getItem(SESSION_EMAIL));
    setQuickLock(readQuickLock());
    setReady(true);
  }, []);

  const load = useCallback(async (account: string, dek: CryptoKey) => {
    const rows = await db.listNotes(account);
    const decoded: Note[] = [];
    for (const row of rows) {
      try {
        decoded.push(await decodeNote(dek, row));
      } catch {
        /* row not decryptable with this key — skip */
      }
    }
    setNotes(sortNotes(decoded));
  }, []);

  const signUp = useCallback(async (account: string, password: string) => {
    const existing = await db.getAccount(account);
    if (existing) throw new Error("An account with that email already exists.");
    const keys = await createVaultKeys(password);
    await db.createAccount({
      email: account,
      salt: keys.salt,
      verifier: keys.verifier,
      wrapped_iv: keys.wrappedKey.iv,
      wrapped_data: keys.wrappedKey.data,
      created_at: Date.now(),
    });
    sessionStorage.setItem(SESSION_EMAIL, account);
    setEmail(account);
    setKey(keys.dek);
    setNotes([]);
  }, []);

  const signIn = useCallback(
    async (account: string, password: string) => {
      const row = await db.getAccount(account);
      if (!row) throw new Error("No vault found for that email.");
      const verifier = await passwordVerifier(password, fromB64(row.salt));
      if (verifier !== row.verifier)
        throw new Error("Incorrect master password.");
      const dek = await unlockVaultKey(password, row.salt, {
        iv: row.wrapped_iv,
        data: row.wrapped_data,
      });
      sessionStorage.setItem(SESSION_EMAIL, account);
      setEmail(account);
      setKey(dek);
      await load(account, dek);
    },
    [load],
  );

  /** Save the secondary (device-only) lock password and wrap the key with it. */
  const enableQuickLock = useCallback(
    async (password: string) => {
      if (!email || !key) throw new Error("Vault is not unlocked.");
      const salt = randomBytes(16);
      const quickKey = await deriveKey(password, salt);
      const sealed = await seal(quickKey, toB64(await exportDek(key)));
      const record: QuickLockRecord = {
        email,
        salt: toB64(salt),
        iv: sealed.iv,
        data: sealed.data,
      };
      localStorage.setItem(QUICK_LOCK, JSON.stringify(record));
      setQuickLock(record);
    },
    [email, key],
  );

  /** Lock the screen: keeps the wrapped key on this device when quick lock is set. */
  const lock = useCallback(() => {
    setKey(null);
    setNotes([]);
    if (!readQuickLock()) {
      sessionStorage.removeItem(SESSION_EMAIL);
      setEmail(null);
    }
  }, []);

  const quickUnlock = useCallback(
    async (password: string) => {
      const record = readQuickLock();
      if (!record) throw new Error("No lock password set on this device.");
      const quickKey = await deriveKey(password, fromB64(record.salt));
      let dek: CryptoKey;
      try {
        dek = await importDek(
          fromB64(await open(quickKey, { iv: record.iv, data: record.data })),
        );
      } catch {
        throw new Error("Incorrect lock password.");
      }
      sessionStorage.setItem(SESSION_EMAIL, record.email);
      setEmail(record.email);
      setKey(dek);
      await load(record.email, dek);
    },
    [load],
  );

  /** Full sign out: forgets the device lock too, so it must be set again. */
  const signOut = useCallback(() => {
    localStorage.removeItem(QUICK_LOCK);
    sessionStorage.removeItem(SESSION_EMAIL);
    setQuickLock(null);
    setKey(null);
    setEmail(null);
    setNotes([]);
  }, []);

  const saveNote = useCallback(
    async (note: Note) => {
      if (!email || !key) return;
      const payload: NotePayload = {
        title: note.title,
        body: note.body,
        tags: note.tags,
        folder: note.folder,
      };
      const sealed = await seal(key, JSON.stringify(payload));
      const row: NoteRow = {
        id: note.id,
        email,
        iv: sealed.iv,
        data: sealed.data,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
        pinned: note.pinned ? 1 : 0,
      };
      await db.upsertNote(row);
      setNotes((prev) =>
        sortNotes([...prev.filter((n) => n.id !== note.id), note]),
      );
    },
    [email, key],
  );

  const createNote = useCallback((): Note => {
    const now = Date.now();
    return {
      id: randomId(8),
      title: "",
      body: "",
      tags: [],
      folder: "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  const removeNote = useCallback(
    async (id: string) => {
      if (!email) return;
      await db.deleteNote(email, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [email],
  );

  /** Create a share link protected by its own password (never the master one). */
  const createShare = useCallback(
    async (
      note: Note,
      sharePassword: string,
      expiresInHours: number | null,
    ) => {
      const salt = randomBytes(16);
      const shareKey = await deriveKey(sharePassword, salt);
      const sealed = await seal(
        shareKey,
        JSON.stringify({ title: note.title, body: note.body }),
      );
      const row: ShareRow = {
        id: randomId(11),
        note_id: note.id,
        salt: toB64(salt),
        iv: sealed.iv,
        data: sealed.data,
        expires_at: expiresInHours
          ? Date.now() + expiresInHours * 3_600_000
          : null,
        created_at: Date.now(),
      };
      await db.createShare(row);
      return row;
    },
    [],
  );

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes)
      for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  return {
    ready,
    email,
    unlocked: Boolean(key),
    notes,
    tags,
    signIn,
    signUp,
    lock,
    signOut,
    quickUnlock,
    enableQuickLock,
    quickLockEmail: quickLock?.email ?? null,
    hasQuickLock: Boolean(quickLock),
    createNote,
    saveNote,
    removeNote,
    createShare,
  };
}
