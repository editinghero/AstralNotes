import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  ImagePlus,
  Pencil,
  Pin,
  Share2,
  Trash2,
} from "lucide-react";
import type { Note } from "@/lib/vault";
import { MarkdownView } from "./MarkdownView";
import { Button } from "./ui-kit";
import { cn } from "@/lib/utils";

export function NoteEditor({
  note,
  onChange,
  onDelete,
  onShare,
  onBack,
}: {
  note: Note;
  onChange: (next: Note) => void;
  onDelete: () => void;
  onShare: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"write" | "read">("write");
  const [tagDraft, setTagDraft] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTagDraft("");
  }, [note.id]);

  function patch(partial: Partial<Note>) {
    onChange({ ...note, ...partial, updatedAt: Date.now() });
  }

  function insertImage() {
    const url = window.prompt("Image URL (https://…)");
    if (!url) return;
    const alt = window.prompt("Alt text (optional)") ?? "";
    const snippet = `\n![${alt}](${url})\n`;
    const el = bodyRef.current;
    const at = el ? el.selectionStart : note.body.length;
    patch({ body: note.body.slice(0, at) + snippet + note.body.slice(at) });
  }

  function addTag(value: string) {
    const tag = value.trim().replace(/^#/, "").toLowerCase();
    if (!tag || note.tags.includes(tag)) return setTagDraft("");
    patch({ tags: [...note.tags, tag] });
    setTagDraft("");
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-1.5 border-b border-border px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Back to notes"
          onClick={onBack}
          className="md:hidden"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-1 items-center gap-1 rounded-xl border border-border bg-surface-2/40 p-1">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-medium transition-colors",
              mode === "write"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            <Pencil className="size-3.5" /> Write
          </button>
          <button
            type="button"
            onClick={() => setMode("read")}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-medium transition-colors",
              mode === "read"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            <Eye className="size-3.5" /> Preview
          </button>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          title="Insert image URL"
          onClick={insertImage}
        >
          <ImagePlus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={note.pinned ? "Unpin" : "Pin"}
          onClick={() => patch({ pinned: !note.pinned })}
          className={note.pinned ? "text-primary" : undefined}
        >
          <Pin className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Share link"
          onClick={onShare}
        >
          <Share2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Delete note"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <input
            value={note.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Untitled note"
            className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
          />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {note.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  patch({ tags: note.tags.filter((t) => t !== tag) })
                }
                title="Remove tag"
                className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                #{tag}
              </button>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagDraft);
                }
              }}
              onBlur={() => addTag(tagDraft)}
              placeholder="add tag"
              className="w-20 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="mt-5">
            {mode === "write" ? (
              <textarea
                ref={bodyRef}
                value={note.body}
                onChange={(e) => patch({ body: e.target.value })}
                spellCheck={false}
                placeholder={
                  "# Markdown supported\n\n- lists, tables, code blocks\n- ![image](https://…)"
                }
                className="min-h-[60vh] w-full resize-none bg-transparent font-mono text-[0.9rem] leading-relaxed outline-none placeholder:text-muted-foreground/50"
              />
            ) : note.body.trim() ? (
              <MarkdownView source={note.body} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing to preview yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-6">
        Encrypted locally · updated {new Date(note.updatedAt).toLocaleString()}
      </footer>
    </section>
  );
}
