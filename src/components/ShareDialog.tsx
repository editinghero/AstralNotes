import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Note } from "@/lib/vault";
import { Button, Field, Input, Modal } from "./ui-kit";
import { shareUrl } from "@/lib/share-link";
import type { ShareRow } from "@/lib/db/types";

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "Never", hours: null },
] as const;

export function ShareDialog({
  note,
  open,
  onClose,
  onCreate,
}: {
  note: Note | null;
  open: boolean;
  onClose: () => void;
  onCreate: (
    password: string,
    expiresInHours: number | null,
  ) => Promise<ShareRow>;
}) {
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState<number | null>(24);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  function close() {
    setPassword("");
    setLink(null);
    setCopied(false);
    onClose();
  }

  async function create() {
    if (password.length < 6) return;
    setBusy(true);
    try {
      const row = await onCreate(password, expiry);
      setLink(shareUrl(row.id, window.location.origin));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Share this note"
      description={
        link
          ? "Send the link and the password separately. Recipients get a read-only copy — no account details travel with it."
          : `A separate password encrypts the shared copy of "${note?.title || "Untitled note"}". Your master password is never shared.`
      }
    >
      {link ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/50 p-2">
            <span className="flex-1 truncate font-mono text-xs">{link}</span>
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button variant="outline" className="w-full" onClick={close}>
            Done
          </Button>
        </>
      ) : (
        <>
          <Field label="Share password">
            <Input
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder="at least 6 characters"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Expires">
            <div className="flex flex-wrap gap-1.5">
              {EXPIRY_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  size="sm"
                  variant={expiry === option.hours ? "primary" : "outline"}
                  onClick={() => setExpiry(option.hours)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </Field>
          <Button
            variant="primary"
            className="w-full"
            disabled={busy || password.length < 6}
            onClick={create}
          >
            {busy ? "Encrypting…" : "Create link"}
          </Button>
        </>
      )}
    </Modal>
  );
}
