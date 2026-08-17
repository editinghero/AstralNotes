import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/** Render Markdown to sanitized HTML. Runs client-side only. */

// Ensure the 'start' attribute on ordered lists is not stripped by ALLOWED_URI_REGEXP
if (typeof window !== "undefined") {
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "start") {
      data.forceKeepAttr = true;
    }
  });
}

export function renderMarkdown(source: string): string {
  const html = marked.parse(source ?? "", { async: false }) as string;
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "rel", "start"],
    FORBID_TAGS: ["style", "iframe", "form", "input"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/)/i,
  });
}

export function plainPreview(source: string, length = 140): string {
  return (source ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length);
}
