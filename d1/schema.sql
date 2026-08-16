-- Cloudflare D1 schema for Astral Notes.
-- Every payload column holds AES-GCM ciphertext produced in the browser,
-- so the database never sees note titles, bodies, tags, or passwords.
--
--   wrangler d1 create astral-notes
--   wrangler d1 execute astral-notes --remote --file=./d1/schema.sql
--   wrangler d1 execute astral-notes --local --file=./d1/schema.sql

CREATE TABLE IF NOT EXISTS accounts (
  email        TEXT PRIMARY KEY,
  salt         TEXT NOT NULL,          -- PBKDF2 salt (base64)
  verifier     TEXT NOT NULL,          -- hash of derived key, not the password
  wrapped_iv   TEXT NOT NULL,          -- data key wrapped with master-password key
  wrapped_data TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL REFERENCES accounts(email) ON DELETE CASCADE,
  iv         TEXT NOT NULL,
  data       TEXT NOT NULL,            -- encrypted { title, body, tags, folder }
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  pinned     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS notes_by_owner ON notes (email, pinned DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS shares (
  id         TEXT PRIMARY KEY,         -- random, unguessable link id
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  salt       TEXT NOT NULL,            -- PBKDF2 salt for the share password
  iv         TEXT NOT NULL,
  data       TEXT NOT NULL,            -- encrypted { title, body }
  expires_at INTEGER,                  -- NULL = never expires
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS shares_by_note ON shares (note_id);
