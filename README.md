# Astral Notes - End-to-end encrypted Markdown notes with shareable links

A small, fast, dark notes app. Your notes are encrypted in your browser before
they ever leave it, so the database only ever holds unreadable ciphertext. Made
for anyone who wants private notes without trusting a server.

## Features

- **End-to-end encryption** - AES-GCM-256 keys derived from your master password with PBKDF2-SHA256 (310,000 iterations). Nothing leaves the browser unencrypted.
- **Password-protected sharing** - Share a single note with its own password and an optional expiry. The link never carries the note or your identity.
- **Full Markdown** - Headings, lists, tables, code blocks, blockquotes, links and images by URL, sanitized on render.
- **Search, folders and tags** - Instant client-side filtering over decrypted notes.
- **Device lock** - Set a short secondary password to unlock quickly on a device you trust, without typing the master password.
- **Four dark themes as an installable app** - Peach, Mauve, Teal and Sky, each with its own icon and install identity.
- **Configurable Signups** - Disable or allow new vault creation seamlessly via environment variables (`VITE_DISABLE_SIGNUP` / `DISABLE_SIGNUP`).

## Getting Started

### 1. Create your vault

- Open the app and choose Create vault.
- Enter your email and a strong master password.
- The password is never sent anywhere and cannot be reset. Write it down somewhere safe.

### 2. Set up unlocking

**Option A: Master password only**

1. Lock the app whenever you step away.
2. Enter your email and master password to unlock.
3. Nothing about your key stays on the device.

**Option B: Add a device lock password**

1. Unlock your vault.
2. Open the lock menu and set a short secondary password.
3. Use that short password to unlock on this device from now on.

> **Note:** The device lock lives only in this browser's storage. Signing out or clearing site data removes it, and you set it again after unlocking with the master password.

### 3. Write and share

**Writing:**

- Press New note, type Markdown in the editor, and watch the live preview.
- Notes autosave, encrypted, a moment after you stop typing.
- Add tags, a folder, or pin a note to keep it on top.

**Sharing:**

- Open a note, choose Share, set a share password and an expiry.
- Copy the short link and send the password through a different channel.
- Recipients get a read-only copy, with no way to see your email, tags or other notes.

### 4. Quick Tips

- **Images:** Paste a public image URL with `![alt](https://...)`.
- **Search:** Search covers titles, bodies and tags at once.
- **Expiry:** Pick the shortest expiry that works; expired links are deleted server-side.
- **Backups:** Keep a copy of important notes elsewhere. Losing the master password means losing the notes.

## Install as App

**On Desktop:**

- Chrome or Edge: click the install icon in the address bar, then Install.
- The installed icon and colors follow whichever theme you were using.

**On Mobile:**

- iOS Safari: Share, then Add to Home Screen.
- Android Chrome: menu, then Install app.

## Security & Privacy

- **Zero-knowledge storage:** The server sees random ids, salts, IVs and ciphertext only.
- **No password on the wire:** Only a verifier hash of a derived key is stored, never a password.
- **Isolated sharing:** Share copies are encrypted with their own password and contain only a title and body.
- **No owner leakage:** A share response returns just the ciphertext, salt, IV and expiry, so a link cannot be traced to an account.
- **Hardened endpoint:** Action allow-list, request size cap, per-IP rate limiting on lookups, server-side expiry enforcement, no-store responses.
- **Local secrets stay local:** The optional device lock wrapper never reaches the database.

## Use Cases

- **Personal journal:** Long-form private writing that no host can read.
- **Credential handoff:** Send a colleague one secret note that expires in an hour.
- **Research notes:** Markdown tables and code snippets, organized by folder and tag.

## Need Help?

**Link not found or expired?**

- The link expired or was deleted. Ask the sender for a fresh one; expired shares are removed permanently.

**Forgot the master password?**

- It cannot be recovered by design. Without it the ciphertext stays unreadable.

**Notes missing on another device?**

- Sign in with the same email and master password. If the app has no D1 database bound yet, storage is temporary; see `D1-SETUP.md`.

---

## For Developers

Want to run your own instance or contribute?

### Tech Stack

- **Frontend:** React 19, TanStack Start (Vite 8), Tailwind CSS v4
- **Crypto:** WebCrypto (AES-GCM-256, PBKDF2-SHA256)
- **Markdown:** marked plus DOMPurify
- **Backend:** Cloudflare Worker / TanStack Start server route `/api/public/db/:action`
- **Database:** Cloudflare D1
- **State:** Plain React hooks, WebCrypto

### Quick Setup

```bash
npm install
npm run dev
```

Without a D1 binding the API keeps data in memory so you can click through the
app immediately.

### Database Setup

1. Create database:

```bash
wrangler d1 create astral-notes
```

2. Update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "astral-notes"
database_id = "<your-database-id>"
```

3. Push schema:

```bash
wrangler d1 execute astral-notes --remote --file=./d1/schema.sql
```

Full walkthrough, including Pages bindings and verification: `D1-SETUP.md`.

### Deploy to Cloudflare

**Via GitHub:**

1. Push this repository to GitHub.
2. Cloudflare dashboard, Workers and Pages, Create, connect the repository.
3. Add the `DB` binding for Production and Preview, then deploy.

**Direct Deploy:**

```bash
npm run build
wrangler deploy
```

### Environment Variables

Configure in `.env`:

```env
# Disable or enable new vault registrations (sign ups)
VITE_DISABLE_SIGNUP=false
DISABLE_SIGNUP=false
```

- If `VITE_DISABLE_SIGNUP=true` / `DISABLE_SIGNUP=true`, all new user registration flows in the UI and API are disabled.

### Database Management

```bash
# View data
wrangler d1 execute astral-notes --remote --command "SELECT id, updated_at FROM notes LIMIT 20;"

# Backup
wrangler d1 export astral-notes --remote --output backup.sql

# Restore
wrangler d1 execute astral-notes --remote --file=./backup.sql
```

### Project Structure

```
d1/
  schema.sql                     accounts, notes and shares tables
src/
  lib/crypto.ts                  WebCrypto key derivation, seal and open
  lib/vault.ts                   vault state, notes CRUD, share creation
  lib/db/                        storage contract, D1 client and server access
  lib/markdown.ts                Markdown render plus sanitizing
  lib/theme.ts                   four dark themes, icons and manifests
  components/                    UI kit, editor, share dialog, auth screen
  routes/index.tsx               the vault
  routes/s.$id.tsx               read-only shared note
  routes/api/public/db/          the database endpoint
D1-SETUP.md                      connecting Cloudflare D1
wrangler.toml                    Cloudflare D1 & Worker configuration
```

---

**Built with ❤️ for people who like their notes private**
