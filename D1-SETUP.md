# Connecting Astral Notes to Cloudflare D1

Astral Notes has exactly one storage backend: a Cloudflare D1 database reached
through the server route `src/routes/api/public/db/$action.ts`. Nothing is kept
in browser storage except the optional device lock password wrapper.

Until a `DB` binding exists, that route falls back to an ephemeral in-memory
store so the app is usable in preview. Restarting the server clears it. Bind D1
and everything persists — no code changes.

## 1. Create the database

```bash
npm install -g wrangler
wrangler login
wrangler d1 create astral-notes
```

Wrangler prints a `database_id`. Keep it.

## 2. Push the schema

```bash
wrangler d1 execute astral-notes --remote --file=./d1/schema.sql
```

Local development copy (optional):

```bash
wrangler d1 execute astral-notes --local --file=./d1/schema.sql
```

## 3. Bind it as `DB`

`wrangler.toml` in the project root:

```toml
name = "astral-notes"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "astral-notes"
database_id = "<database_id from step 1>"
```

Cloudflare Pages instead of Workers: Pages project → Settings → Functions →
D1 database bindings → variable name `DB`, database `astral-notes`. Add it for
both Production and Preview.

The binding name must be `DB` — that is what `src/lib/db/d1.server.ts` reads.

## 4. Build and deploy

```bash
npm run build
wrangler deploy          # Workers
# or
wrangler pages deploy    # Pages
```

## 5. Verify

```bash
curl -X POST https://<your-domain>/api/public/db/get-account \
  -H 'content-type: application/json' \
  -d '{"email":"nobody@example.com"}'
# -> null   (a real 200 means the binding works)
```

Then sign up in the app and check that only ciphertext landed in the database:

```bash
wrangler d1 execute astral-notes --remote --command "SELECT id, length(data) FROM notes LIMIT 5;"
```

## What the database can and cannot see

Stored: random ids, PBKDF2 salts, IVs, AES-GCM ciphertext, timestamps, expiry,
account email, and a verifier hash of the master-password-derived key.

Never stored: note titles, bodies, tags, folders, the master password, the
share password, or any encryption key. All crypto runs in the browser
(AES-GCM-256, PBKDF2-SHA256, 310,000 iterations).

Share rows are not linked back to an owner in any response: `get-share`
returns only `id`, `salt`, `iv`, `data` and `expires_at` — never `note_id`,
never an email.

## Recommended hardening

The endpoint already applies an action allow-list, a body size cap, per-IP rate
limiting on `get-share` / `get-account`, server-side expiry deletion, and
`no-store` responses. On top of that:

- Add a Cloudflare Rate Limiting rule on `/api/public/db/*` (for example 60
  requests per minute per IP) so limits survive across Worker isolates.
- Turn on Cloudflare Bot Fight Mode for the same path.
- Require long share passwords when sharing sensitive notes; the link id alone
  is 11 random characters and the password is the real gate.

## Useful commands

```bash
# Row counts
wrangler d1 execute astral-notes --remote --command "SELECT COUNT(*) FROM notes;"

# Purge expired shares
wrangler d1 execute astral-notes --remote \
  --command "DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < unixepoch()*1000;"

# Backup
wrangler d1 export astral-notes --remote --output backup.sql

# Restore
wrangler d1 execute astral-notes --remote --file=./backup.sql
```
