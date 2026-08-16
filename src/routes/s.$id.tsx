import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { Button, Field, Input } from "@/components/ui-kit";
import { db } from "@/lib/db";
import type { SharePublic } from "@/lib/db/types";
import { deriveKey, fromB64, open } from "@/lib/crypto";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/s/$id")({
  head: () => ({
    meta: [
      { title: "Shared encrypted note — Astral Notes" },
      {
        name: "description",
        content:
          "This note is encrypted end-to-end. Enter the share password to decrypt and read it in your browser.",
      },
      { property: "og:title", content: "Shared encrypted note — Astral Notes" },
      {
        property: "og:description",
        content:
          "Password-protected, end-to-end encrypted note. Decryption happens in your browser.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { id } = Route.useParams();
  useTheme();
  const [row, setRow] = useState<SharePublic | null | "loading">("loading");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<{ title: string; body: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Only the ciphertext + salt come back from the database. No owner data.
    void db
      .getShare(id)
      .then(setRow)
      .catch(() => setRow(null));
  }, [id]);

  const expired =
    row &&
    row !== "loading" &&
    row.expires_at !== null &&
    row.expires_at < Date.now();

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!row || row === "loading") return;
    setBusy(true);
    setError(null);
    try {
      const key = await deriveKey(password, fromB64(row.salt));
      const json = await open(key, { iv: row.iv, data: row.data });
      setNote(JSON.parse(json) as { title: string; body: string });
    } catch {
      setError("Incorrect password.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  if (row === "loading") return <div className="min-h-screen" />;

  if (!row || expired) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold tracking-tight">
          {expired ? "This link has expired" : "Link not found"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ask the sender for a fresh share link.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-primary underline"
        >
          Go to Astral Notes
        </Link>
      </Shell>
    );
  }

  if (note) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10">
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> Decrypted in your browser
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {note.title || "Untitled note"}
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Read-only shared copy
        </p>
        <div className="card-surface mt-6 p-5 sm:p-7">
          <MarkdownView source={note.body} />
        </div>
      </main>
    );
  }

  return (
    <Shell>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <KeyRound className="size-4" />
      </span>
      <h1 className="mt-4 text-lg font-semibold tracking-tight">
        Password required
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        This note is encrypted. Enter the share password to decrypt it locally.
        {row.expires_at
          ? ` Link expires ${new Date(row.expires_at).toLocaleString()}.`
          : ""}
      </p>
      <form onSubmit={unlock} className="mt-5 space-y-3">
        <Field label="Share password">
          <Input
            type="password"
            required
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={busy}
        >
          {busy ? "Decrypting…" : "Decrypt note"}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="card-surface w-full max-w-sm p-6">{children}</div>
    </main>
  );
}
