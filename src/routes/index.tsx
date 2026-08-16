import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Lock, Plus, Search } from "lucide-react";
import { AuthScreen } from "@/components/AuthScreen";
import { NoteEditor } from "@/components/NoteEditor";
import { ShareDialog } from "@/components/ShareDialog";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { Button, Field, Input, Modal } from "@/components/ui-kit";
import { Logo } from "@/components/Logo";
import { plainPreview } from "@/lib/markdown";
import { useTheme } from "@/lib/theme";
import { useVault, type Note } from "@/lib/vault";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Astral Notes — End-to-end encrypted Markdown notes" },
      {
        name: "description",
        content:
          "A fast, minimal, dark notes app. Markdown notes encrypted in your browser with AES-GCM, plus password-protected share links that expire.",
      },
      {
        property: "og:title",
        content: "Astral Notes — End-to-end encrypted Markdown notes",
      },
      {
        property: "og:description",
        content:
          "Markdown notes encrypted in your browser with AES-GCM, plus password-protected share links that expire.",
      },
    ],
  }),
  component: VaultPage,
});

function VaultPage() {
  const { theme, setTheme } = useTheme();
  const vault = useVault();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Note | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sharing, setSharing] = useState<Note | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [lockSetup, setLockSetup] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveRef = useRef(vault.saveNote);
  saveRef.current = vault.saveNote;

  const active = useMemo(
    () => draft ?? vault.notes.find((n) => n.id === activeId) ?? null,
    [draft, vault.notes, activeId],
  );

  // Debounced autosave — encrypt + persist shortly after typing stops.
  useEffect(() => {
    if (!draft) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveRef.current(draft);
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vault.notes.filter((note) => {
      if (tagFilter && !note.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q) ||
        note.tags.some((t) => t.includes(q))
      );
    });
  }, [vault.notes, query, tagFilter]);

  if (!vault.ready) return <div className="min-h-screen" />;

  if (!vault.unlocked) {
    return (
      <AuthScreen
        theme={theme}
        onTheme={setTheme}
        onSignIn={vault.signIn}
        onSignUp={vault.signUp}
        hasQuickLock={vault.hasQuickLock}
        quickLockEmail={vault.quickLockEmail}
        onQuickUnlock={vault.quickUnlock}
        onForgetDevice={vault.signOut}
      />
    );
  }

  function selectNote(note: Note) {
    setDraft(null);
    setActiveId(note.id);
    setListOpen(false);
  }

  function newNote() {
    const note = vault.createNote();
    setDraft(note);
    setActiveId(note.id);
    setListOpen(false);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setListOpen((v) => !v)}
          className="flex items-center gap-2 md:pointer-events-none"
        >
          <Logo className="size-8 text-primary" />
          <span className="text-sm font-semibold tracking-tight">
            Astral Notes
          </span>
        </button>

        <span className="ml-auto hidden truncate text-xs text-muted-foreground sm:block">
          {vault.email}
        </span>
        <ThemeSwitcher theme={theme} onChange={setTheme} />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            vault.hasQuickLock ? vault.lock() : setLockSetup(true)
          }
        >
          <Lock className="size-3.5" /> Lock
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={vault.signOut}
          aria-label="Sign out"
        >
          <LogOut className="size-3.5" />
        </Button>
      </header>

      <Modal
        open={lockSetup}
        onClose={() => {
          setLockSetup(false);
          setLockPassword("");
          setLockError(null);
        }}
        title="Set a lock password"
        description="This secondary password only unlocks this device. It is stored locally, never in the database — clear your site data or sign out and you will set it again with your master password."
      >
        <Field label="Lock password">
          <Input
            type="password"
            value={lockPassword}
            autoComplete="new-password"
            placeholder="at least 4 characters"
            onChange={(e) => setLockPassword(e.target.value)}
          />
        </Field>
        {lockError ? (
          <p className="text-sm text-destructive">{lockError}</p>
        ) : null}
        <Button
          variant="primary"
          className="w-full"
          disabled={lockPassword.length < 4}
          onClick={async () => {
            try {
              await vault.enableQuickLock(lockPassword);
              setLockPassword("");
              setLockSetup(false);
              vault.lock();
            } catch (err) {
              setLockError(
                err instanceof Error
                  ? err.message
                  : "Could not save lock password.",
              );
            }
          }}
        >
          Save and lock
        </Button>
      </Modal>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "flex w-full min-w-0 flex-col border-border md:flex md:w-80 md:border-r",
            listOpen ? "flex" : "hidden",
          )}
        >
          <div className="space-y-2.5 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes"
                className="pl-9"
              />
            </div>
            <Button variant="primary" className="w-full" onClick={newNote}>
              <Plus className="size-4" /> New note
            </Button>
            {vault.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {vault.tags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-xs transition-colors",
                      tagFilter === tag
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-2 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    #{tag} <span className="opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {vault.notes.length === 0
                  ? "Your vault is empty."
                  : "No notes match."}
              </p>
            ) : (
              filtered.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => selectNote(note)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    note.id === active?.id
                      ? "border-primary/50 bg-surface-2/70"
                      : "border-border hover:border-border-strong hover:bg-surface-2/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium">
                      {note.title || "Untitled note"}
                    </span>
                    {note.pinned ? (
                      <span className="text-xs text-primary">●</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {plainPreview(note.body) || "No content"}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1",
            listOpen ? "hidden md:flex" : "flex",
          )}
        >
          {active ? (
            <NoteEditor
              note={active}
              onChange={setDraft}
              onDelete={async () => {
                await vault.removeNote(active.id);
                setDraft(null);
                setActiveId(null);
                setListOpen(true);
              }}
              onBack={() => setListOpen(true)}
              onShare={() => setSharing(active)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Select a note, or start a new encrypted one.
              </p>
              <Button variant="primary" onClick={newNote}>
                <Plus className="size-4" /> New note
              </Button>
            </div>
          )}
        </main>
      </div>

      <ShareDialog
        note={sharing}
        open={Boolean(sharing)}
        onClose={() => setSharing(null)}
        onCreate={async (password, hours) => {
          const note = sharing!;
          await vault.saveNote(note);
          return vault.createShare(note, password, hours);
        }}
      />
    </div>
  );
}
