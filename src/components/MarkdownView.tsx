import { useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export function MarkdownView({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  return (
    <div
      className={cn("prose-note", className)}
      // Sanitized with DOMPurify in renderMarkdown().
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
